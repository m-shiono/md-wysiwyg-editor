import * as path from 'path';
import Mocha from 'mocha';
import { globSync } from 'glob';

/**
 * VS Code Extension Host runner — integration tests only.
 * Mocha 10 (CJS): Mocha 12+ is ESM-only and breaks under Electron's extension host.
 */
export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', timeout: 120000, color: true });
  const testsRoot = path.resolve(__dirname, 'integration');

  const files = globSync('**/*.test.js', { cwd: testsRoot, absolute: true });
  files.forEach((f) => mocha.addFile(f));

  return new Promise((resolve, reject) => {
    mocha.run((failures: number) => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
      } else {
        resolve();
      }
    });
  });
}
