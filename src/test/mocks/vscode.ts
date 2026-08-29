/**
 * Minimal vscode shim for unit tests that exercise Extension Host modules
 * outside the real Extension Development Host.
 */

type Listener<T> = (e: T) => unknown;

class EventEmitter<T> {
  private readonly listeners: Listener<T>[] = [];

  readonly event = (listener: Listener<T>): { dispose: () => void } => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
          this.listeners.splice(index, 1);
        }
      },
    };
  };

  fire(data: T): void {
    for (const listener of [...this.listeners]) {
      listener(data);
    }
  }

  dispose(): void {
    this.listeners.length = 0;
  }
}

class Uri {
  readonly scheme: string;
  readonly path: string;
  readonly fsPath: string;

  private constructor(scheme: string, path: string) {
    this.scheme = scheme;
    this.path = path;
    this.fsPath = path;
  }

  static file(path: string): Uri {
    return new Uri('file', path);
  }

  static parse(value: string): Uri {
    if (value.startsWith('file:')) {
      return new Uri('file', value.replace(/^file:\/\//, ''));
    }
    return new Uri('file', value);
  }

  toString(): string {
    return `${this.scheme}://${this.path}`;
  }
}

const fileContents = new Map<string, Uint8Array>();

export function setMockFile(uri: Uri, content: string): void {
  fileContents.set(uri.fsPath, Buffer.from(content, 'utf8'));
}

export function clearMockFiles(): void {
  fileContents.clear();
}

const workspace = {
  fs: {
    readFile: async (uri: Uri): Promise<Uint8Array> => {
      const data = fileContents.get(uri.fsPath);
      if (!data) {
        throw new Error(`ENOENT: ${uri.fsPath}`);
      }
      return data;
    },
    writeFile: async (uri: Uri, content: Uint8Array): Promise<void> => {
      fileContents.set(uri.fsPath, content);
    },
  },
};

const window = {
  showErrorMessage: async (_message: string): Promise<undefined> => undefined,
  createOutputChannel: (_name: string) => ({
    appendLine: (_line: string): void => undefined,
    name: _name,
    dispose: (): void => undefined,
  }),
};

export { EventEmitter, Uri, workspace, window };
