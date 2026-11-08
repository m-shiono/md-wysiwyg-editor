import * as path from 'path';
import type Mocha from 'mocha';
import { globSync } from 'glob';

/** Load ESM-only mocha from compiled CJS; tsconfig would otherwise downlevel to require(). */
const importEsm = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<{ default: typeof Mocha }>;

/** VS Code Extension Host runner — integration tests only. */
export async function run(): Promise<void> {
  const { default: MochaCtor } = await importEsm('mocha');
  const mocha = new MochaCtor({ ui: 'tdd', timeout: 120000, color: true });
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
