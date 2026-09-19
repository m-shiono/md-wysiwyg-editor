# vsc-md-editor

VS Code 向け WYSIWYG Markdown エディタ拡張。チーム技術ドキュメントを Git 管理しながら、リッチな表・図・画像を直感的に編集する。

## 機能（MVP）

| 機能 | 説明 |
|------|------|
| 三点モード | 同一 Custom Editor で **Editor Preview**（RO 描画）/ **Edit Rich Editor**（TipTap WYSIWYG）/ **Edit Raw Text**（ソース）を切替。正本は Document。内部 mode id は `preview` / `markdown` / `raw`。**初期表示は Edit Raw Text** |
| Default Preview | ツールバー先頭の **Default Preview**（非モード・`editorMode` 非変更）から VS Code 標準 Markdown Preview を**同一タブグループ**に開く（Beside 横分割はしない）。未保存時は Save / Cancel。Command Palette: `vsc-md-editor.showNativeMarkdownPreview`（旧 `…ToSide` は互換エイリアス）。ボタン順: Default Preview \| Editor Preview \| Edit Rich Editor \| Edit Raw Text |
| WYSIWYG 本文 | Edit Rich Editor で見出し（H1–H6）・太字・斜体・取り消し線（`~~`）・リスト・タスクリスト・引用・リンク・インラインコード・コードブロック・水平線等をビジュアル編集 |
| HTML 表編集 | セル内改行・箇条書き・チェックボックス対応の Excel 的表操作 |
| Readonly モード | ファイル単位で全編集面（Markdown / Raw）をロック（Editor Preview とは別） |
| Mermaid | ` ```mermaid ` ブロックのリアルタイム描画（テキスト編集） |
| Marp プレビュー | スライド用サイド/パネル表示（Editor Preview とは別・AD-008） |
| 画像貼付 | クリップボード画像を同階層 `img/image-NNNN.ext` に保存 |

リッチ表現（HTML 混在・拡張記法）を Markdown 厳密互換より優先する設計。詳細は [doc/systemspec.md](doc/systemspec.md)。

## Quick start（開発）

```bash
npm install
npm run compile
```

VS Code で **Run Extension**（F5）を実行し Extension Development Host を起動する。手順詳細: [doc/development.md](doc/development.md#vs-code-拡張の起動)。

### デフォルトエディタにする（任意）

`settings.json` の例:

```json
{
  "workbench.editorAssociations": {
    "*.md": "vsc-md-editor.wysiwyg"
  }
}
```

コマンドパレットの **Reopen Editor With…** で VS Code 標準 Markdown エディタへ切替可能。

IDE タイトルバーの Preview / Markdown 切替でビルトインへ移った場合、拡張が検知して WYSIWYG への復帰を案内する（`vsc-md-editor.autoRestoreOnBuiltinSwitch` で自動復帰も可。既定はオフ）。エディタ内ツールバーは **Default Preview / Editor Preview / Edit Rich Editor / Edit Raw Text**（WYSIWYG Custom Editor 専用）。**Default Preview** は表示面を変えず、標準 Markdown Preview を同一タブグループに開く（第 4 モードではない）。

拡張機能を更新したあと、`.md` ファイル表示中のエディタタイトルバー（Cursor の Preview / Markdown 付近）の **Reload Plugin**（$(refresh) アイコン）でウィンドウを再読み込みできる。ビルトインエディタに切り替わって Webview バーが消えても利用可能。

## リポジトリ構成

| パス | 役割 |
|------|------|
| `src/` | 拡張本体（Extension Host） |
| `media/` | Webview 用バンドル |
| `doc/systemspec.md` | 振る舞い仕様（正本） |
| `doc/stack.md` | スタック・品質コマンド |
| `doc/backlog-vsc-md-wysiwyg.md` | MVP 外 backlog |
| `.cursor/` | AI 開発ワークフロー（rules / agents / skills） |

## Docs

- [doc/systemspec.md](doc/systemspec.md) — 機能仕様
- [doc/development.md](doc/development.md) — 開発・Cursor フロー
- [doc/deployment.md](doc/deployment.md) — Marketplace 公開手順
- [doc/stack.md](doc/stack.md) — TypeScript / VS Code Extension スタック
- [AGENTS.md](AGENTS.md) — AI エージェント索引

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-09-19 | Docs に Marketplace 公開手順（doc/deployment.md）へのリンクを追加 |
| 2026-08-29 | テンプレート README から vsc-md-editor 製品説明へ更新 |
| 2026-08-29 | 三点モード・Marp 区別を機能表に追記。`workbench.editorAssociations` の viewType を `vsc-md-editor.wysiwyg` に修正 |
| 2026-08-30 | Pattern A（ビルトイン切替検知・WYSIWYG 復帰案内）と `autoRestoreOnBuiltinSwitch` 設定を追記 |
| 2026-08-31 | 三点モードのツールバー表示名を Preview / Edit Rich Editor / Edit Raw Text に更新 |
| 2026-08-31 | WYSIWYG 本文の機能表を GFM 書式（取り消し線・H1–H6・タスクリスト・引用・水平線等）に合わせて更新 |
| 2026-09-05 | 初期モードを Edit Raw Text に変更。Side Preview（標準 Preview 横開き・非モード）を追記 |
| 2026-09-05 | ツールバー表示名を Default Preview / Editor Preview / Edit Rich Editor / Edit Raw Text に更新（`toolbar-default-editor-preview-labels`） |
| 2026-09-06 | Default Preview を同一タブグループ開きに変更。コマンド `vsc-md-editor.showNativeMarkdownPreview`（旧 ToSide はエイリアス）（`default-preview-same-tab-group`） |
