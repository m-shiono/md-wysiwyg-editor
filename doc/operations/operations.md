# Operations — vsc-md-editor

利用者・作者向けの最小運用メモ（AD-008）。製品振る舞いの正本は [requirements/systemspec.md](../requirements/systemspec.md)、Marketplace 手順の全文は [deploy/deployment.md](../deploy/deployment.md)、Cursor エージェント／ハーネスは [../../.cursor/development.md](../../.cursor/development.md)。

## 日常の開き方

1. VS Code / Cursor でワークスペースを開く
2. `.md` を開き、Custom Editor（`vsc-md-editor.wysiwyg`）で編集する
3. mode-toolbar: **Default Preview**｜**Editor Preview**｜**Edit Rich Editor**｜**Edit Raw Text**

詳細な起動手順（F5 Extension Development Host）は [.cursor/development.md](../../.cursor/development.md) を参照。

## よくあるトラブル

| 症状 | 切り分け |
|------|----------|
| 拡張が開かない / Custom Editor にならない | 拡張が有効か、`viewType` 関連付け、ウィンドウ再読み込み（`reloadExtension` / Reload Window）を確認 |
| Preview（Editor Preview）が出ない・崩れる | Output チャンネル `vsc-md-editor` のエラー、Webview 再読込、テーマ切替後の再描画 |
| Mermaid が描画されない / エッジが見えない | Output ログ、CSP／nonce 関連エラー、図ソース構文。契約は [test/mermaid/testspec-mermaid.md](../test/mermaid/testspec-mermaid.md) |
| Default Preview が開かない | dirty 時は Save/Cancel ゲート。同一グループ配置の契約は requirements §1 / §10 |
| 画像が表示されない | `img/` 配下の相対パスか、Host rewrite 対象外パスでないか |

## Marketplace 更新（いつ・誰が）

- **誰が:** 拡張作者（Publisher）
- **いつ:** バージョン bump・リリース準備ができたとき
- **手順の正本:** [deploy/deployment.md](../deploy/deployment.md)（本ファイルに全文は複製しない）

## ログ確認

障害調査時は VS Code の **Output** チャンネル（拡張名 / `vsc-md-editor`）を確認する（architecture AD-015）。

## Out of scope

- Cursor エージェントフロー・ハーネス → `.cursor/development.md`
- Marketplace 手順の全文 → `doc/deploy/deployment.md`
- 製品振る舞い・設計 → `doc/requirements/` · `doc/design/`
- CI 詳細の重複

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-19 | doc-reorg: AD-008 最小運用を新設 |
