import * as child_process from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';

export interface PlantUmlConfig {
  jarPath?: string;
  command?: string;
}

export interface PlantUmlExecutionOptions {
  timeoutMs?: number;
  config?: PlantUmlConfig;
}

export class PlantUmlRenderer {
  private cache = new Map<string, string>();
  private availabilityCache: boolean | null = null;

  constructor(private configGetter: () => PlantUmlConfig = () => ({})) {}

  /**
   * Resets internal caches (useful for testing or config updates).
   */
  public resetCache(): void {
    this.cache.clear();
    this.availabilityCache = null;
  }

  /**
   * Resolves the executable and arguments for PlantUML.
   * Order of precedence:
   * 1. Explicit jarPath in config (if file exists)
   * 2. PLANTUML_JAR environment variable (if file exists)
   * 3. Explicit command in config
   * 4. System 'plantuml' command
   * 5. Fallback 'java' if a standard plantuml.jar is found
   */
  public resolveExecution(): { command: string; args: string[] } | null {
    const config = this.configGetter();

    // 1. Explicit jarPath
    if (config.jarPath && config.jarPath.trim() !== '') {
      const jar = config.jarPath.trim();
      if (fs.existsSync(jar)) {
        return { command: 'java', args: ['-jar', jar, '-tsvg', '-pipe'] };
      }
    }

    // 2. PLANTUML_JAR environment variable
    const envJar = process.env.PLANTUML_JAR;
    if (envJar && envJar.trim() !== '') {
      if (fs.existsSync(envJar.trim())) {
        return { command: 'java', args: ['-jar', envJar.trim(), '-tsvg', '-pipe'] };
      }
    }

    // 3. Explicit command
    if (config.command && config.command.trim() !== '') {
      const cmd = config.command.trim();
      return { command: cmd, args: ['-tsvg', '-pipe'] };
    }

    // 4. Default 'plantuml' command on PATH
    return { command: 'plantuml', args: ['-tsvg', '-pipe'] };
  }

  /**
   * Checks if PlantUML execution environment is available.
   * If not available, returns false silently without throwing errors.
   */
  public async isAvailable(): Promise<boolean> {
    if (this.availabilityCache !== null) {
      return this.availabilityCache;
    }

    const execInfo = this.resolveExecution();
    if (!execInfo) {
      this.availabilityCache = false;
      return false;
    }

    // Test run with -version
    return new Promise<boolean>((resolve) => {
      try {
        const testArgs = execInfo.command === 'java' 
          ? [execInfo.args[0], execInfo.args[1], '-version']
          : ['-version'];

        const proc = child_process.spawn(execInfo.command, testArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 2000,
        });

        proc.on('error', () => {
          this.availabilityCache = false;
          resolve(false);
        });

        proc.on('close', (code) => {
          const available = code === 0 || code === null;
          this.availabilityCache = available;
          resolve(available);
        });
      } catch {
        this.availabilityCache = false;
        resolve(false);
      }
    });
  }

  /**
   * Renders PlantUML source code into SVG.
   * Returns empty string if unavailable or on error.
   */
  public async renderSvg(source: string, options?: PlantUmlExecutionOptions): Promise<string> {
    if (!source || source.trim() === '') {
      return '';
    }

    // Normalize source: if it already begins with @start... (case-insensitive), do not wrap in @startuml
    let normalizedSource = source.trim();
    if (!/^@start[a-z]+/i.test(normalizedSource)) {
      normalizedSource = `@startuml\n${normalizedSource}\n@enduml`;
    }

    // Check cache
    const hash = crypto.createHash('sha256').update(normalizedSource).digest('hex');
    const cached = this.cache.get(hash);
    if (cached) {
      return cached;
    }

    const execInfo = options?.config 
      ? new PlantUmlRenderer(() => options.config!).resolveExecution()
      : this.resolveExecution();

    if (!execInfo) {
      return '';
    }

    const timeoutMs = options?.timeoutMs ?? 5000;

    return new Promise<string>((resolve, reject) => {
      let stdout = '';
      let timedOut = false;

      let proc: child_process.ChildProcess;
      try {
        proc = child_process.spawn(execInfo.command, execInfo.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        return resolve('');
      }

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          proc.kill('SIGKILL');
        } catch {
          // ignore
        }
        reject(new Error(`PlantUML render timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });

      proc.on('error', () => {
        clearTimeout(timer);
        if (!timedOut) {
          // Process failed to spawn or execute
          resolve('');
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          return;
        }

        if (code === 0 && stdout.includes('<svg')) {
          // Extract SVG part if extra text exists
          const svgStart = stdout.indexOf('<svg');
          const svgEnd = stdout.lastIndexOf('</svg>');
          const finalSvg = svgStart >= 0 && svgEnd >= 0
            ? stdout.substring(svgStart, svgEnd + 6)
            : stdout;

          this.cache.set(hash, finalSvg);
          resolve(finalSvg);
        } else {
          // Process exited with non-zero or invalid SVG
          resolve('');
        }
      });

      try {
        proc.stdin?.write(normalizedSource, 'utf-8');
        proc.stdin?.end();
      } catch {
        clearTimeout(timer);
        resolve('');
      }
    });
  }
}

let defaultInstance: PlantUmlRenderer | null = null;

export function getDefaultPlantUmlRenderer(configGetter?: () => PlantUmlConfig): PlantUmlRenderer {
  if (!defaultInstance) {
    defaultInstance = new PlantUmlRenderer(configGetter);
  }
  return defaultInstance;
}
