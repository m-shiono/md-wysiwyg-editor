import * as path from 'path';
import Mocha from 'mocha';

async function main(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', timeout: 30000, color: true });
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
