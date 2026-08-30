import * as path from 'path';
import Mocha from 'mocha';

function readGrepPattern(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--grep' || arg === '-g') {
      return argv[i + 1];
    }
    if (arg.startsWith('--grep=')) {
      return arg.slice('--grep='.length);
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  const grep = readGrepPattern(process.argv.slice(2));
  const mocha = new Mocha({
    ui: 'tdd',
    timeout: 30000,
    color: true,
    grep,
  });
  mocha.addFile(path.resolve(__dirname, 'unit-bundle.js'));
  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} unit tests failed.`));
      } else {
        resolve();
      }
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
