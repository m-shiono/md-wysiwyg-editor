---
name: vscode-extension-dev
description: >
  VS Code 拡張機能の開発 — スキャフォールド、contributes 定義、コマンド・Webview・カスタムエディタ、
  Language Features、Tree View、設定、バンドル、Extension Host デバッグ。
  「VS Code 拡張」「extension.ts」「package.json contributes」「Webview」「Custom Editor」
  「コマンド登録」「activationEvents」「Extension Host」で使用。拡張機能の新規作成・機能追加・不具合調査に必須。
---

# VS Code Extension Development

**目的:** VS Code Extension API に沿って、保守しやすい拡張機能を実装する。

**開始時:** [_shared/read-stack.md](../_shared/read-stack.md) → [doc/stack.md](../../../doc/stack.md) → 本スキルの references を必要に応じて読む。

## 他スキルとの関係

| 状況 | スキル |
|------|--------|
| 要件・振る舞い未定義 | `project-systemspec-authoring` |
| **拡張機能の実装** | **本スキル** |
| 統合テスト | `vscode-extension-test` |
| パッケージ・Marketplace | `vscode-extension-publish` |
| 原因調査 | `project-debugging` |
| リファクタ | `project-refactoring` |

---

## Phase 0: 現状把握

1. `package.json` の `contributes` / `activationEvents` / `engines.vscode` を確認
2. エントリポイント（通常 `src/extension.ts` の `activate` / `deactivate`）を特定
3. `doc/systemspec.md` と contributes の整合を確認 — **仕様と manifest の二重管理を避ける**

---

## Phase 1: スキャフォールド（新規・大規模追加時）

### 最小構成

```text
src/
  extension.ts          # activate / deactivate
  commands/             # コマンドハンドラ
  providers/            # Language Features, Tree Data Provider 等
  webviews/             # Webview パネル・サイドバー
  utils/
package.json            # contributes, scripts, engines
.vscode/
  launch.json           # Extension Development Host
  tasks.json            # compile watch
```

### package.json 必須項目

| 項目 | 注意 |
|------|------|
| `engines.vscode` | 利用 API バージョンに合わせる（過度に新しくしない） |
| `main` | バンドル出力（例: `./dist/extension.js`） |
| `activationEvents` | 必要最小限 — `onStartupFinished` は最終手段 |
| `contributes` | コマンド ID は `publisher.name.command` 形式で統一 |

詳細: [references/contributes-reference.md](references/contributes-reference.md)

### バンドル

- 推奨: **esbuild** または **webpack**（`vscode` を external）
- `npm run compile` / `watch` を stack.md の quality commands に登録
- Webview 用アセットは `media/` 等に分離し、`.vscodeignore` で不要ファイルを除外

---

## Phase 2: 実装パターン

### activate / deactivate

```typescript
export function activate(context: vscode.ExtensionContext): void {
  // context.subscriptions に push して Disposable を一元管理
}
export function deactivate(): void { /* 同期クリーンアップのみ */ }
```

- **Disposable パターン必須** — リスナー・タイマー・プロセスは `context.subscriptions` に登録
- 重い初期化は lazy（コマンド実行時・該当ファイル open 時）

詳細: [references/api-patterns.md](references/api-patterns.md)

### よく使う contributes

| 種別 | 用途 |
|------|------|
| `commands` + `menus` | コマンド登録・コンテキストメニュー |
| `configuration` | ユーザー設定（default / scope を明示） |
| `views` / `viewsContainers` | サイドバー Tree View |
| `customEditors` | カスタムエディタ（Markdown プレビュー拡張等） |
| `languages` / `grammars` | 言語・シンタックス |
| `keybindings` | ショートカット（when 句でスコープ限定） |

### Webview / Custom Editor

- `enableScripts: true` 時は **CSP** と `localResourceRoots` を設定
- `vscode.Uri.joinPath(context.extensionUri, 'media', ...)` でリソース URI を生成
- メッセージングは型付き payload（`postMessage` / `onDidReceiveMessage`）
- 状態復元: `retainContextWhenHidden` は必要時のみ（メモリコスト）

### Language Features

- `register*Provider` は document selector を狭く（不要なファイルで発火させない）
- 非同期 Provider は `CancellationToken` を尊重
- 診断（Diagnostic）は debounce を検討

---

## Phase 3: デバッグ

1. **F5** — Extension Development Host（`.vscode/launch.json`）
2. **Output チャンネル** — `createOutputChannel` で拡張ログを分離
3. **Developer: Toggle Developer Tools** — Webview 内 JS のデバッグ

よくある原因: [references/debug-checklist.md](references/debug-checklist.md)

| 症状 | 初動 |
|------|------|
| コマンドが出ない | contributes と `registerCommand` の ID 一致 |
| activate されない | activationEvents とトリガー条件 |
| Webview 真っ白 | CSP / リソース URI / JS バンドル path |
| 設定が効かない | `configuration` schema と `getConfiguration` の section 名 |

Extension Host デバッグ後、統合テストで再現手順を固定 → `vscode-extension-test` へ。

---

## Phase 4: 完了前チェック

- [ ] `contributes` と実装のコマンド ID が一致
- [ ] すべての Disposable が `context.subscriptions` に登録
- [ ] `engines.vscode` が利用 API と整合
- [ ] `npm run compile` 成功
- [ ] stack.md の `test_single` / `typecheck` 実行
- [ ] 仕様変更時は **doc/systemspec.md を先に更新**（spec-first）

---

## 参照

| ファイル | いつ読むか |
|----------|------------|
| [contributes-reference.md](references/contributes-reference.md) | manifest 追加・変更時 |
| [api-patterns.md](references/api-patterns.md) | コマンド・Provider・Webview 実装時 |
| [debug-checklist.md](references/debug-checklist.md) | 不具合・動作しない報告時 |
