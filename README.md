# md-wysiwyg-editor

VS Code 向け WYSIWYG Markdown エディタ拡張。チーム技術ドキュメントを Git 管理しながら、リッチな表・図・画像を直感的に編集する。

**Extension ID:** `mshiono.md-wysiwyg-editor` · **Repository:** https://github.com/m-shiono/md-wysiwyg-editor.git

## 機能（MVP）

| 機能 | 説明 |
|------|------|
| 三点モード | 同一エディタで **Editor Preview**（読み取り専用の描画）/ **Edit Rich Editor**（WYSIWYG）/ **Edit Raw Text**（ソース）を切替。**初期表示は Edit Raw Text** |
| Default Preview | ツールバー先頭の **Default Preview** から VS Code 標準 Markdown Preview を同一タブグループに開く（横分割はしない）。未保存時は Save / Cancel。コマンド: `md-wysiwyg-editor.showNativeMarkdownPreview`。ボタン順: Default Preview \| Editor Preview \| Edit Rich Editor \| Edit Raw Text |
| WYSIWYG 本文 | Edit Rich Editor で見出し（H1–H6）・太字・斜体・取り消し線・リスト・タスクリスト・引用・リンク・インラインコード・コードブロック・水平線等をビジュアル編集 |
| HTML 表編集 | セル内改行・箇条書き・チェックボックス対応の Excel 的表操作 |
| Readonly モード | ファイル単位で編集面（Rich / Raw）をロック（Editor Preview とは別） |
| Mermaid | ` ```mermaid ` ブロックのリアルタイム描画 |
| Marp プレビュー | スライド用サイド/パネル表示（Editor Preview とは別） |
| 画像貼付 | クリップボード画像を同階層 `img/image-NNNN.ext` に保存 |

リッチな表・図・HTML 混在などを、厳密な Markdown 互換より優先して扱います。

## 使い方

### デフォルトエディタにする（任意）

`settings.json` の例:

```json
{
  "workbench.editorAssociations": {
    "*.md": "md-wysiwyg-editor.wysiwyg"
  }
}
```

コマンドパレットの **Reopen Editor With…** で VS Code 標準 Markdown エディタへ切替できます。

IDE タイトルバーの Preview / Markdown 切替でビルトインへ移った場合、拡張が検知して WYSIWYG への復帰を案内します（`md-wysiwyg-editor.autoRestoreOnBuiltinSwitch` で自動復帰も可。既定はオフ）。

エディタ内ツールバーは **Default Preview / Editor Preview / Edit Rich Editor / Edit Raw Text** です。**Default Preview** は表示面を変えず、標準 Markdown Preview を同一タブグループに開きます。

### 拡張の再読み込み

拡張機能を更新したあと、`.md` ファイル表示中のエディタタイトルバー付近の **Reload Plugin**（更新アイコン）でウィンドウを再読み込みできます。ビルトインエディタに切り替わっても利用可能です。
