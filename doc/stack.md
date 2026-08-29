# Stack Profile

VS Code 拡張 **vsc-md-editor** のスタック定義。AI エージェント（build-agent / test-agent / review-agent / vscode-extension-agent）は **本ファイルを正本** として規約・コマンドを読む。

---

## Status

```yaml
status: active
profile: vscode-extension
```

## Languages & runtime

```yaml
languages:
  - TypeScript
runtime: VS Code Extension Host (Node.js)
package_manager: npm
```

## Source layout

```yaml
source_roots:
  - src/
layout: |
  src/extension.ts       — activate / deactivate entry
  src/commands/          — command handlers
  src/providers/         — CustomEditorProvider, CustomDocument
  src/webviews/          — Webview UI, postMessage bridge
  src/serializers/       — remark/unified Markdown ↔ model
  src/utils/             — pure helpers
  media/                 — Webview bundles (TipTap, Mermaid, Marp)
  src/test/              — @vscode/test-electron integration tests
test_roots:
  - src/test/
test_file_glob: "src/test/suite/**/*.test.ts"
source_glob: "src/**/*.ts"
```

## Test runner

```yaml
test_runner: "@vscode/test-electron + mocha (unit bundle)"
test_all: "npm run test"
test_unit: "npm run test:unit"
test_integration: "npm run test:integration"
test_single: "npm run test:unit -- --grep '{pattern}'"
```

## Quality commands

```yaml
typecheck: "npm run typecheck"
lint: "npm run lint"
format: "npm run format"
compile: "npm run compile"
```

## Secrets & config

```yaml
secrets_policy: |
  - ローカル VS Code 拡張。秘密情報の外部送信なし
  - Marketplace 公開用トークンは CI シークレットまたはローカル環境変数のみ — git に含めない
tracked_config_paths:
  - package.json
  - tsconfig.json
forbidden_secret_paths:
  - .env
  - *.vsix.publish.token
```

## Active Cursor rules

`templates/rules/` から `.cursor/rules/` にコピー済み:

```yaml
cursor_rules:
  - .cursor/rules/vscode-extension.mdc
  - .cursor/rules/tests-vscode-extension.mdc
```

## Stack-specific review notes

```markdown
- `package.json` contributes（commands, customEditors, activationEvents）と `doc/systemspec.md` の整合
- Webview CSP / サニタイズ（systemspec §9）を変更する PR は security 観点必須
- `media/` バンドルと `src/` のエントリ対応を確認
- Custom Editor の save / dirty / undo と統合テストの一致
- `engines.vscode` と AD-002 の最小バージョン整合
```

---

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-08-29 | テンプレート試作フェーズ用プレースホルダ |
| 2026-08-29 | `status: active` / `profile: vscode-extension` に更新。vsc-md-editor MVP 用レイアウト・品質コマンド登録 |
| 2026-08-29 | test:unit / test:integration を stack に同期。@vscode/test-electron 3.1 + VS Code 1.97.2 |
