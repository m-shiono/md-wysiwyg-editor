# vsc-md-editor

VS Code 向け WYSIWYG Markdown エディタ拡張。チーム技術ドキュメントを Git 管理しながら、リッチな表・図・画像を直感的に編集する。

## 機能（MVP）

| 機能 | 説明 |
|------|------|
| WYSIWYG 本文 | 見出し・太字・リスト・リンク・コードブロック等をビジュアル編集 |
| HTML 表編集 | セル内改行・箇条書き・チェックボックス対応の Excel 的表操作 |
| Readonly モード | ファイル単位で編集可否を切替（誤編集防止） |
| Mermaid | ` ```mermaid ` ブロックのリアルタイム描画（テキスト編集） |
| Marp プレビュー | スライド形式 Markdown のプレビュー表示 |
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
    "*.md": "vsc-md-editor.mdEditor"
  }
}
```

コマンドパレットの **Reopen Editor With…** で VS Code 標準 Markdown エディタへ切替可能。

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
- [doc/stack.md](doc/stack.md) — TypeScript / VS Code Extension スタック
- [AGENTS.md](AGENTS.md) — AI エージェント索引

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-08-29 | テンプレート README から vsc-md-editor 製品説明へ更新 |
