import * as esbuild from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');
const sourcemap = process.env.SOURCEMAP !== '0';

const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap,
  target: 'node18',
  logLevel: 'info',
};

const mediaConfig = {
  entryPoints: ['media/editor.ts'],
  bundle: true,
  outfile: 'media/editor.js',
  format: 'iife',
  platform: 'browser',
  sourcemap,
  target: 'es2020',
  logLevel: 'info',
};

const unitTestConfig = {
  entryPoints: ['src/test/unit-entry.ts'],
  bundle: true,
  outfile: 'out/test/unit-bundle.js',
  // vscode is external + resolved to the unit mock in runUnit so dynamic
  // require('out/commands/*.js') shares the same vscode instance tests patch.
  // jsdom / dompurify: Node 上で Mermaid SVG sanitize 実行検証（mermaid-contrast-readable）
  external: ['mocha', 'vscode', 'jsdom', 'dompurify'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
  target: 'node18',
  logLevel: 'info',
};

async function build() {
  if (watch) {
    const extCtx = await esbuild.context(extensionConfig);
    const mediaCtx = await esbuild.context(mediaConfig);
    await extCtx.watch();
    await mediaCtx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(extensionConfig);
    await esbuild.build(mediaConfig);
    await esbuild.build(unitTestConfig);
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
