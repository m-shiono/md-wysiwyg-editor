# Operations — md-wysiwyg-editor

利用者・作者向けの最小運用メモ（AD-008）。製品振る舞いの正本は [requirements/systemspec.md](../requirements/systemspec.md)、Cursor エージェント／ハーネスは [../../.cursor/development.md](../../.cursor/development.md)。

## 日常の開き方

1. VS Code / Cursor でワークスペースを開く
2. `.md` を開き、Custom Editor（`md-wysiwyg-editor.wysiwyg`）で編集する
3. mode-toolbar: **Visual**｜**Source**｜**Preview**｜**Default Preview**

詳細な起動手順（F5 Extension Development Host）は [.cursor/development.md](../../.cursor/development.md) を参照。

## よくあるトラブル

| 症状 | 切り分け |
|------|----------|
| 拡張が開かない / Custom Editor にならない | 拡張が有効か、`viewType` 関連付け（`md-wysiwyg-editor.wysiwyg`）、ウィンドウ再読み込み（`md-wysiwyg-editor.reloadExtension` / Reload Window）を確認。「Open With」で Custom Editor を選べるかも確認 |
| Preview が出ない・崩れる | Output チャンネル `MD WYSIWYG Editor` のエラー、Webview 再読込、テーマ切替後の再描画 |
| Mermaid が描画されない / エッジが見えない | Output ログ、CSP／nonce 関連エラー、図ソース構文。契約は [test/mermaid/testspec-mermaid.md](../test/mermaid/testspec-mermaid.md) |
| Default Preview が開かない | dirty 時は Save/Cancel ゲート。同一グループ配置の契約は requirements §1 / §10。コマンド ID は `md-wysiwyg-editor.showNativeMarkdownPreview` |
| 画像が表示されない | `img/` 配下の相対パスか、Host rewrite 対象外パスでないか |
| キーバインド／設定が効かない | コマンド ID・設定キーが `md-wysiwyg-editor.*` か確認 |

## 拡張機能識別子と命名規則

- **`package.json` の `name`**: `vsc-md-editor`（Extension ID: `mshiono.vsc-md-editor`）を採用。
- **その他の識別子の統一**: `package.json` の `name` 以外のすべての要素（表示名 `displayName: "MD WYSIWYG Editor"`、`viewType: "md-wysiwyg-editor.wysiwyg"`、コマンド ID `md-wysiwyg-editor.*`、設定キー `md-wysiwyg-editor.*`、リポジトリ名）は、すべて `md-wysiwyg-editor` で統一されている。

## ログ確認

障害調査時は VS Code の **Output** チャンネル（表示名 `MD WYSIWYG Editor`）を確認する（architecture AD-015）。

## CI 検証とリリース前スモークチェック（UD-002）

> `doc/deploy/deployment.md` は 2026-10-03 に廃止済みのため、VSIX 検証・リリース前運用の最小指針を本節に保持する。

- **PR 時 CI 自動検証（`.github/workflows/package-vsix.yml`）:**
  - `push`（`main`）・`workflow_dispatch` に加え、`pull_request` トリガで `ubuntu-latest` 上の `lint` / `typecheck` / `compile` / `test:unit` / `xvfb-run` 経由 `test:integration` / VSIX パッケージ化を PR ごとに自動実行する（コスト抑制のため Multi-OS マトリクスは採用しない — `UD-002` Option A）。
  - オフライン環境や初回キャッシュ未作成環境での `@vscode/test-electron` 実行時は `.vscode-test/` キャッシュまたは `VSCODE_TEST_EXECUTABLE_PATH` を利用する（`RK-003`）。
- **リリース前手動スモークチェックリスト（macOS / Windows・下限バージョン・派生 IDE）:**
  - [ ] **macOS / Windows / VS Code 下限（`engines.vscode: ^1.85.0`）:** `.md` を Custom Editor で開き、三点モード切替（Visual / Source / Preview）・編集・保存・Undo/Redo・Hot Exit・Default Preview（同一グループ配置）がエラーなく動作すること。
  - [ ] **派生 IDE（Cursor / Windsurf / Antigravity / VSCodium）:** Switch Guard（Pattern A）が組み込みプレビューや AI 差分タブで誤発火しないこと、およびエディタ内ショートカット（`Cmd+F` / `Cmd+H` / `Cmd+K` 等）が IDE グローバルショートカット（Cursor `Cmd+K` / `Cmd+L` 等）を不必要に横取りしないこと。
  - [ ] **VS Code Remote (`vscode-remote`):** リモートワークスペース上の `.md` で画像貼付・相対画像描画・Marp Preview・Export が正常動作すること。
  - [ ] **外部 CLI 依存機能（任意導入環境）:** Pandoc / Marp CLI / PlantUML が未導入またはオフライン環境でもクラッシュせず、契約どおりのフォールバック（PlantUML 非表示）または明瞭なエラー通知が出ること。

## Out of scope

- Cursor エージェントフロー・ハーネス → `.cursor/development.md`
- 製品振る舞い・設計 → `doc/requirements/` · `doc/design/`
- CI 詳細の重複

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-29 | Breaking / 再設定案内セクションを削除。トラブルシュートの旧 ID 言及を現行 ID 確認に緩和（初期製品のため migration messaging 不要） |
| 2026-09-29 | 製品リネーム（`rename-md-wysiwyg`）: viewType / コマンド / Extension ID を `md-wysiwyg-editor` 系に同期 |
| 2026-09-19 | doc-reorg: AD-008 最小運用を新設 |
| 2026-10-03 | doc 整理: Marketplace 記述を全廃。拡張機能識別子（name: vsc-md-editor、他は md-wysiwyg-editor 統一）の記録を追加 |
| 2026-11-15 | `UD-002`（Option A）に基づき「CI 検証とリリース前スモークチェック」節を追加（`package-vsix.yml` の `pull_request` トリガ方針および macOS/Windows・`^1.85.0`・派生 IDE・Remote 手動スモークチェックリスト） |
