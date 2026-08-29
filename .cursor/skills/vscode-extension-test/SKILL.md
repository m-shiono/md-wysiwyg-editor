---
name: vscode-extension-test
description: >
  VS Code 拡張機能の統合テスト — @vscode/test-electron、Extension Development Host 上の
  シナリオテスト、コマンド・Webview・Editor の E2E 検証。
  「拡張機能のテスト」「@vscode/test-electron」「integration test」「Extension Test Runner」
  「F5 での動作をテストで固定」で使用。testspec からのテスト実装にも使用。
---

# VS Code Extension Testing

**目的:** Extension Development Host 上で拡張機能の振る舞いを自動検証する。

**開始時:** [_shared/read-stack.md](../_shared/read-stack.md) → [doc/stack.md](../../../doc/stack.md) → [references/integration-test-patterns.md](references/integration-test-patterns.md)

## 他スキルとの関係

| 状況 | スキル |
|------|--------|
| testspec 設計 | `spec-test-design` |
| **拡張機能統合テスト実装** | **本スキル** |
| 一般テストコード（ユニット） | `testspec-implementation` |
| バグ再現 TC | `bug-regression-test` |
| 実装側の修正 | `vscode-extension-dev` |

---

## テスト構成

```text
src/test/
  runTest.ts              # @vscode/test-electron エントリ
  suite/
    extension.test.ts     # テストスイート
    index.ts              # Mocha runner
```

stack.md 例:

```yaml
test_runner: "@vscode/test-electron"
test_all: "npm run test"
test_single: "npm run test -- --grep '{pattern}'"
```

---

## ワークフロー

### 1. テスト実行基盤

`@vscode/test-electron` で VS Code を子プロセス起動し Mocha でテスト:

```typescript
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, '../../');
  const extensionTestsPath = path.resolve(__dirname, './suite/index');
  await runTests({ extensionDevelopmentPath, extensionTestsPath });
}
```

### 2. テスト本体

```typescript
import * as vscode from 'vscode';
import * as assert from 'assert';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start tests.');

  test('command registers', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('acme.mdEditor.format'));
  });
});
```

### 3. よくあるシナリオ

| シナリオ | アプローチ |
|----------|------------|
| コマンド実行 | `vscode.commands.executeCommand` |
| ドキュメント操作 | `vscode.workspace.openTextDocument` + edit |
| 設定変更 | `vscode.workspace.getConfiguration().update` + テスト後 restore |
| Webview | DOM アクセス不可 — メッセージングまたは side effect（Output / ファイル）で検証 |
| Custom Editor | `vscode.commands.executeCommand('vscode.openWith', uri, viewType)` |

詳細: [references/integration-test-patterns.md](references/integration-test-patterns.md)

---

## テスト設計原則

- **TC ID** を testspec / テスト名に含める（例: `'TC-010: format command updates document'`）
- テストは **What**（期待結果）を名前に — 実装手順ではない
- 外部ネットワーク・Marketplace 依存を避ける — モックまたは fixture ファイル
- テスト間で globalState / workspaceState を汚さない — テスト後 cleanup
- フレーク対策: `waitFor` ヘルパーで条件待ち（固定 sleep は最小限）

---

## 完了前チェック

- [ ] `npm run compile` 後に `npm run test` が通る
- [ ] 新コマンド・contributes 変更にテスト追加
- [ ] testspec の TC とテスト名が対応
- [ ] CI（あれば）で headless 実行可能

---

## 参照

| ファイル | いつ読むか |
|----------|------------|
| [integration-test-patterns.md](references/integration-test-patterns.md) | シナリオ実装・モック |
