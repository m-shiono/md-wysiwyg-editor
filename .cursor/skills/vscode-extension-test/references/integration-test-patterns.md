# VS Code 拡張機能 統合テストパターン

## runTest.ts テンプレート

```typescript
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions'], // 他拡張を無効化
    });
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

main();
```

## suite/index.ts（Mocha）

```typescript
import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', timeout: 60000 });
  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) return reject(err);
      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
      try {
        mocha.run((failures) => {
          failures ? reject(new Error(`${failures} tests failed.`)) : resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}
```

## フィクスチャ

```typescript
import * as path from 'path';
import * as vscode from 'vscode';

const fixturePath = path.join(__dirname, '../../test-fixtures/sample.md');

test('opens markdown file', async () => {
  const doc = await vscode.workspace.openTextDocument(fixturePath);
  assert.strictEqual(doc.languageId, 'markdown');
});
```

`test-fixtures/` はリポジトリにコミット。大容量バイナリは避ける。

## waitFor ヘルパー

```typescript
async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('waitFor timeout');
}
```

## 設定の save/restore

```typescript
const config = vscode.workspace.getConfiguration('mdEditor');
const previous = config.get<string>('previewTheme');
try {
  await config.update('previewTheme', 'dark', vscode.ConfigurationTarget.Global);
  // assert ...
} finally {
  await config.update('previewTheme', previous, vscode.ConfigurationTarget.Global);
}
```

## Webview の検証

Webview DOM はテストから直接触れない。代替:

1. コマンド実行後に **ワークスペースファイル / Output チャンネル** の変化を assert
2. Custom Editor なら `document.getText()` でモデル変更を検証
3. 可能なら Webview ロジックを **pure function** に抽出しユニットテスト

## CI 向け

- `launchArgs: ['--disable-extensions', '--user-data-dir=...']` で隔離
- `vscode-test-electron` が VS Code をダウンロード — キャッシュパスを CI に設定
- headless Linux では `--no-sandbox` が必要な場合あり（CI ドキュメント参照）

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-08-29 | 初版 |
