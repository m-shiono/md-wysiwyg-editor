# Architecture — md-wysiwyg-editor

製品の基本設計（HOW 境界・レイヤ方針）。振る舞い契約（WHAT）の正本は [systemspec.md](../requirements/systemspec.md) です。

§ 契約内の AD 参照は ID リンクで相互参照します。

---

### アーキテクチャ方針（AD-* 要約）

| ID | 方針（WHAT） |
|----|-------------|
| AD-001 | TypeScript / VS Code Extension Host / npm / `@vscode/test-electron` |
| AD-002 | `*.md` を Custom Editor（viewType `md-wysiwyg-editor.wysiwyg`）で開く。Extension Host 上の `MarkdownDocument` が dirty・undo/redo・save および表示内容の正本 |
| AD-003 | **Markdown モード**は Webview 内 TipTap（ProseMirror）WYSIWYG。対象ノードは見出し（h1–h6）、太字、斜体、取り消し線（GFM `~~`）、箇条書き、番号リスト、タスクリスト、リンク、インラインコード、コードブロック、引用、水平線、表（§3）等（書式ツールバー契約は §2） |
| AD-004 | 編集内容 ↔ ディスク `.md` は remark/unified パイプラインで変換。HTML 混在・拡張ブロックを許容。出力は決定的（AD-013） |
| AD-005 | 表は per-table `tableFormat`（`gfm` \| `html`）で永続化する。新規挿入のデフォルトは GFM パイプ表。形式切替は Table メニューの明示操作のみ（§3）。列アライメント（`textAlign`: `left` \| `center` \| `right` \| `null`）は GFM デリミタ行（`:---`, `:---:`, `---:`）および HTML `<th/td align="...">` と双方向マッピングし、Webview DOM では CSP 安全な `data-align` / `align` 属性＋外部 CSS で描画する |
| AD-006 | ファイル単位 Readonly は **全編集面**（Markdown / Raw）をロック。Preview モードとは別概念。状態はワークスペースに永続化 |
| AD-007 | Mermaid はコードブロック + リアルタイム描画。VS Code kind → Mermaid `redux` / `redux-dark` マップ、グローバル表示密度は `themeVariables.fontSize: '16px'`（固定 px。`var(--vscode-...)` 禁止。密度の主手段は `fontSize` — CSS `scale`/`zoom` を密度代替にしない）。ラベル `font-family` は Mermaid default 相当（`"trebuchet ms", verdana, arial, sans-serif`）、`line-height: 1.2`（エディタ本文 1.6 を継承しない）。flowchart は stock Mermaid 既定に近い hug→wrap（`wrappingWidth: 200`・`padding: 15`）。CSP 下では `mermaid.render` **測定時**にも Host 同一 nonce CSS でラベル `font-size: 16px`・同一 `font-family`・`line-height: 1.2` を効かせ、測定と描画の食い違いを防ぐ（`'unsafe-inline'` なし）。**密度（fontSize／ラベルタイポ）と閲覧用ビューポート変換（自然サイズ／Fit／ズーム／パン）は別契約**（§5 / `mermaid-label-metrics` / 継承 `mermaid-default-preview-parity` / `mermaid-readable-viewport`）。図タイトル全文がクリップされないこと。ビューポート UX（**初期・再 render・テーマ切替後は scale 1（自然サイズ）・自動 contain なし**・図がビューポートより小さい軸は中央寄せ・はみ出しは縮小せずスクロール・**Fit ボタン押下時のみ枠内 contain**・**ズーム原点はビューポート中央**・ズームイン／アウト・パン／ドラッグ・縦横スクロール・a11y `aria-label`）は **Editor Preview / Rich Editor の Mermaid NodeView のみ**（Default Preview 埋め込みなし）。**ズーム／パン／Fit は回帰必須で維持**（パン後の手動オフセットは次の Fit で中央寄せに戻す。再 render／テーマ切替は scale 1 に戻す）。CSP 下 Host 同一 nonce による presentation `<style>` 再注入、`@mermaid-js/layout-elk` 登録＋ frontmatter / `%%{init}%%` オプトイン ELK（遅延ロード・グローバル強制なし — §5）。classic `default`/`dark` マップおよび静的 Host CSS エッジフォールバック優先は撤回（`mermaid-redux-elk-fidelity`）。**Preview / Markdown とも図の下にソース併記**。編集はテキストのみ（Preview は厳密 RO・ズーム／パンは閲覧操作のみ）。`securityLevel: 'strict'`・HIP・`'unsafe-inline'` なしは不変 |
| AD-008 | **Marp Preview** はサイド/パネル（§6）を維持。**Preview モード**（§1）でも `isMarpDocument(markdownText)` 検出時は同一 Webview 内 `#preview-marp-root` に Host 生成 HTML を RO 表示可。別 UI インスタンス・別責務は維持。編集は Markdown / Raw 側 |
| AD-009 | 画像 paste / D&D（`png`/`jpg`/`gif`/`svg`/`webp`） → 同階層 `img/image-NNNN.ext` に保存し相対パスを挿入。表示時は Host が `img/` 配下のみ `isSafeImagePath` 検証後に `asWebviewUri` で rewrite（§7 / §9）。serialize / ディスクは常に相対パス（`![alt](src)` または `<img src="img/..." ... />`）を維持し Webview URI を漏洩させない |
| AD-010 | Webview CSP + HTML サニタイズ。許可タグ・属性を限定 |
| AD-011 | Extension Host と Webview を別バンドルし `media/` に配置 |
| AD-012 | シリアライズ round-trip のユニットテスト + Custom Editor 統合テスト |
| AD-013 | 保存時の整形ルールを固定し Git diff 可読性を確保 |
| AD-014 | ビルトイン Markdown エディタとの共存（エディタ関連付けの切替可能） |
| AD-015 | Output チャンネルで障害ログ。ユーザー向けはエディタ内インライン表示を優先 |
| AD-016 | 同一 Custom Editor 内に **Preview / Markdown / Raw** 三点モード。初期モードは設定 `md-wysiwyg-editor.defaultMode`（未設定時は `DEFAULT_EDITOR_MODE = 'markdown'`、Visual）。モード切替 alone ではディスク書き込みしない。**Default Preview**（§1 / §10・表示ラベル）は mode-toolbar の非モード導線であり、4 つ目の `editorMode` ではない |
| AD-017 | GFM パイプ表フォーマットは設定 `md-wysiwyg-editor.table.pipeAlignment`（`'aligned'` \| `'compact'`）に基づき、列幅に合わせた固定長空白パディングまたは最小空白パディングを選択可能とする。全角文字（East Asian Width）を半角2幅として計算し、視覚的な垂直整列を保持する（§3） |
| AD-018 | Source モード（textarea）での編集支援パイプライン。表内 Tab / Shift+Tab による自動整列・セル間移動・新規行自動追加、リスト自動継続（Enter でマーカー継続・解除、Tab でインデント）、書式トグルショートカット、スマート URL ペースト、目次（TOC）自動生成・同期を提供する（§3, §15） |
| AD-019 | 表リッチ編集（`table-rich-editing`）: 列アライメントの一括更新・GFM/HTML 往復・Table Formatter 統合、行・列の入れ替え（`moveRowUp` / `moveRowDown` / `moveColumnLeft` / `moveColumnRight`）および行複製（`duplicateRow`）の 1 トランザクション実行（ヘッダ行 `th`/`td` 正規化・端 no-op・Table メニュー / コンテキストメニュー / `Alt+矢印` ショートカット統合）、ならびにクリップボード TSV（2行×2列以上・コードブロック等ガード）および HTML `<table>` の Visual / Source スマートペーストを提供する（§3, §8, §9, §15, §16） |
| AD-020 | リッチ画像編集（`image-rich-editing`）: Visual モード画像選択時のドラッグリサイズ（最小 `32px`・アスペクト比維持）およびサイズプリセット（`25%`/`50%`/`75%`/`100%`）・配置切替（`left`/`center`/`right`/`null`）・Alt 編集ミニポップオーバー UI、CSP 安全描画（HTML `width` / `align` / `data-align` 属性＋外部 CSS、インライン `style` 禁止）、`width`/`align` 未指定時の `![alt](src)` と指定時の `<img src="img/..." alt="..." width="..." align="..." />` の決定的双方向往復シリアライズ（`originalSrc` / Host 逆変換による相対パス保護）、OS / ファイルツリーからの画像ファイル D&D 挿入（`webp` 対応・Webview 遷移抑止）、ならびに Preview シングルクリック / Visual ダブルクリックまたは Zoom ボタンによる Lightbox 拡大モーダル表示を提供する（§7, §8, §9） |
| AD-021 | 誤 dirty 防止および外部ファイル変更自動同期（`auto-sync-dirty-fix`）: (1) Host `MarkdownDocument.updateDoc` は変更前モデル `previous` を同一 `SerializeOptions` でシリアライズした結果と比較して実質差分を判定し、一致時は `_isDirty` / `_markdownText` / `_editStack` を変更しない。(2) Webview（`media/editor.ts`）は `math` / `plantuml` NodeView への `ignoreMutation` / `stopEvent` ガード付与、`StarterKit` の `link: false` による `Link` 重複排除、および前回同期 `docJson` 一致時の `update` 送信抑止により誤発火を防ぐ。(3) 外部ファイル変更はドキュメント単位の `FileSystemWatcher`（`file` / `vscode-remote`、`RelativePattern`、250ms デバウンス、自己保存後 500ms 抑止ウィンドウ＋内容一致スキップ）で検知し、`!isDirty` 時に `reloadFromDisk()` で Undo スタックをリセットしつつ `_onDidContentChange` 経由で全表示面を同期し `isDirty === false` を維持する（§1, §8, §12, §14） |
| AD-022 | 単一正本 Undo / Redo（`undo-redo`）: Extension Host の `MarkdownDocument` を唯一の Undo / Redo 履歴正本（`MAX_UNDO_HISTORY = 100`、保存地点 `_savedEditIndex` / `_savedMarkdownText` 追跡による `isDirty` 自動解除）とし、Webview 側の TipTap `UndoRedo`（`undoRedo: false`）および Source 独自スタックを廃止する。`src/utils/undo-grouping.ts`（`UndoGroupTracker`）により英語単語・文節境界・800ms アイドル・削除種別・カーソル移動・IME `compositionend` 確定単位・構造コマンド単位で `undoGroupId` を発行し、`MarkdownDocument` で同一グループをインプレース結合（グループ先頭でのみ VS Code `onDidChangeCustomDocument` を発火）する。`MarkdownEditorProvider` はドキュメント単位の直列メッセージキューで flush と `requestUndo` / `requestRedo` を順序保証し、Webview は `Ctrl+Z` / `Cmd+Z`・`Ctrl+Y` / `Shift+Mod+Z` を捕捉して最小差分（ProseMirror `Fragment.findDiffStart`/`findDiffEnd`）とカーソル位置を復元する（§1, §2, §15） |
| AD-023 | 行番号・文書統計ステータス表示（`line-numbers-and-document-stats`）: `src/utils/document-stats.ts` に純粋関数（文字数・CJK/英語混在単語数・行数・オフセット行列計算・Visual 行推定・ステータスバー整形）を集約する。Source モード DOM は `#raw-editor-container` 内で `#raw-line-numbers`（左ガター）と `#raw-editor-main`（`#raw-search-backdrop` + `#raw-editor`）を分離して検索ハイライト座標を保護し、Webview からは表示専用の `cursorStatus` メッセージのみ送信して Extension Host の `vscode.StatusBarItem` を更新・ライフサイクル管理する（`MarkdownDocument` / `isDirty` 非干渉 — §17） |
| AD-024 | 見出しアウトラインパネル（`document-outline`）: `src/utils/editor-assist.ts` の `extractOutlineHeadings` / `findLineStartOffset` により TOC 生成と見出し抽出・スラッグ規則を共用する。Webview DOM は `#editor-workspace` 内に `#outline-panel`（左）と `#editor-main`（右）を配置し、`data-level` 属性＋外部 CSS で階層インデントを描画する（CSP 準拠・表示層完結 — §18） |
| AD-025 | リンク遷移とミニポップオーバー（`link-navigation-and-popover`）: `src/utils/link-navigation.ts` でリンク種別分類（`anchor` / `external` / `relative` / `unsafe`）と `vscode.Uri.joinPath` によるスキーム保全解決を行う。Webview は `openLink` メッセージのみ送信し、Host 側で `https`/`http`/`mailto` の `openExternal` および存在確認後の `vscode.open` を実行、危険スキームをブロックする。Visual 通常クリック時は `#link-popover` で Open / Edit / Unlink を提供する（§9, §19） |
| AD-026 | スラッシュコマンドメニュー（`slash-command-menu`）: `src/utils/slash-commands.ts`（ブラウザ非依存純粋関数）でトリガー検出と候補フィルタを行い、Webview `#slash-menu` で Visual モード（非 RO / 非コード内 / 非 IME）時の `/` ブロック挿入を提供する（§20） |

---

### 識別子・命名の統一方針

- **`package.json` の `name`**: `vsc-md-editor`（Extension ID: `mshiono.vsc-md-editor`）を採用。
- **その他の識別子の統一**: `package.json` の `name` 以外のすべての要素（表示名 `displayName: "MD WYSIWYG Editor"`、`viewType: "md-wysiwyg-editor.wysiwyg"`、コマンド ID `md-wysiwyg-editor.*`、設定キー `md-wysiwyg-editor.*`、リポジトリ名）は、すべて `md-wysiwyg-editor` で統一する。

---

## HOW 境界・レイヤ方針

| レイヤ | 責務 | 備考 |
|--------|------|------|
| Extension Host | `MarkdownDocument` 正本、コマンド、画像 URI rewrite、Marp Host HTML、CSP / nonce、永続化、外部変更監視（`FileSystemWatcher`） | AD-002, AD-009, AD-010, AD-015, AD-020, AD-021 |
| Webview（Custom Editor） | TipTap / Preview / Raw UI、Mermaid / Math / PlantUML NodeView、表示層のみ | AD-003, AD-007, AD-016, AD-019, AD-020, AD-021 |
| Serialize pipeline | remark/unified 往復、決定的整形 | AD-004, AD-005, AD-013, AD-017, AD-019, AD-020 |
| Bundles | Host と Webview を別バンドルし `media/` 配置 | AD-011 |
| Tests | round-trip ユニット + Custom Editor 統合 | AD-012 |

詳細な Inputs / Outputs / Behavior は requirements の各 § を正とする。本ファイルは AD-* 要約とレイヤ境界のみを保持する。

## Related requirements

- [doc/requirements/systemspec.md](../requirements/systemspec.md) — §1–§16、共通 Non-Goals、RK-*、Spec Gaps

## 改訂履歴

| 日付 | 節 | 変更内容 |
|------|-----|---------|
| 2026-09-29 | 改訂履歴 | 利用者向け Breaking / migration messaging 削除に合わせ、過去エントリの **BREAKING** 表記を製品リネーム事実の記録として維持（AD 本文変更なし） |
| 2026-09-29 | タイトル, AD-002 | 製品リネーム（`rename-md-wysiwyg`）: 文書タイトルを md-wysiwyg-editor に同期。viewType `md-wysiwyg-editor.wysiwyg` |
| 2026-09-26 | AD-007 | Mermaid ラベル計測・自然サイズ（`mermaid-label-metrics`）: ラベル `font-family`（Mermaid default 相当）・`line-height: 1.2`・測定用 Host nonce CSS 同値。初期・再 render・テーマ切替後は scale 1（自動 contain 撤回）。Fit 押下時のみ contain。小さい軸中央寄せ・はみ出しはスクロール。ズーム／パン／Fit／a11y 維持。systemspec §5 現行契約に追随 |
| 2026-09-26 | AD-007 | Mermaid 既定 Preview 寄せ（`mermaid-default-preview-parity`）: グローバル `fontSize` / 測定用 `font-size` を `'12px'` → `'16px'`。fit／Fit／re-fit 後の中央寄せ・ズーム原点中央を明記。ズーム／パン／Fit は維持。systemspec §5 現行契約に追随 |
| 2026-09-19 | doc-reorg layout | 旧 `doc/systemspec.md` から AD-* 要約を分割移設。契約内容不変 |
| 2026-10-03 | 識別子・命名の統一方針 | 識別子統一方針（package.json name のみ vsc-md-editor、他は md-wysiwyg-editor 統一）を記録 |
| 2026-10-23 | AD-017, AD-018 | 表フォーマット切替（Aligned vs Compact）およびエディタ入力支援（`table-format-and-editor-assist`）: AD-017（表フォーマット形式制御、East Asian Width 対応）および AD-018（Source モード編集支援パイプライン、表 Tab 整列・セル移動、リスト継続、ショートカット、スマート URL ペースト、TOC）を追加 |
| 2026-10-31 | AD-005, AD-019 | 表リッチ編集（`table-rich-editing`）: 列アライメント（CSP 安全描画・GFM/HTML 双方向往復・Table Formatter 統合）、行/列移動と行複製（`moveRowUp` / `moveRowDown` / `duplicateRow` / `moveColumnLeft` / `moveColumnRight`、メニュー・ショートカット統合）、TSV / HTML `<table>` スマートペースト（Visual / Source 両対応、誤変換防止ガード付き）を追加 |
| 2026-11-01 | AD-009, AD-020 | リッチ画像編集（`image-rich-editing`）: 画像選択時のドラッグリサイズ・サイズプリセット・配置切替・Alt 編集ミニポップオーバー UI、CSP 安全描画（HTML `width` / `align` / `data-align` 属性＋外部 CSS）、`![alt](src)` ⇄ `<img src="img/..." alt="..." width="..." align="..." />` 決定的往復シリアライズと相対パス保護、画像ファイル D&D 挿入（`webp` 追加・遷移抑止）、Lightbox 拡大モーダル表示を追加 |
| 2026-11-23 | AD-021, HOW 境界 | 誤 dirty 防止および外部ファイル変更自動同期（`auto-sync-dirty-fix`）: `MarkdownDocument.updateDoc` の `previous` シリアライズ比較による実質差分判定、Webview `math`/`plantuml` NodeView ガード・`Link` 重複排除・no-op `update` 抑止、およびドキュメント単位 `FileSystemWatcher`（250ms デバウンス・自己保存 500ms 抑止・`!isDirty` ガード・`reloadFromDisk()` 全モード同期）の AD-021 を追加 |
| 2026-11-27 | AD-022 | 単一正本 Undo / Redo（`undo-redo`）: `MarkdownDocument` 単一履歴（上限100段、保存地点 `isDirty` 連動）、`UndoGroupTracker` による単語/文節・IME 確定・コマンド単位コアレッシング、直列メッセージキュー、ProseMirror 最小差分＋カーソル復元を追加 |
| 2026-11-28 | AD-023 | 行番号・文書統計ステータス表示（`line-numbers-and-document-stats`）: `src/utils/document-stats.ts` 純粋関数、`#raw-line-numbers` + `#raw-editor-main` 分離、`cursorStatus` 表示専用メッセージ、`StatusBarItem` ライフサイクルを追加 |
| 2026-11-28 | AD-024 | 見出しアウトラインパネル（`document-outline`）: `extractOutlineHeadings` / `findLineStartOffset` 共用、`#editor-workspace` + `#outline-panel` + `#editor-main` レイアウトを追加 |
| 2026-11-28 | AD-025 | リンク遷移とミニポップオーバー（`link-navigation-and-popover`）: `src/utils/link-navigation.ts`、`openLink` Host 検証、`#link-popover` UI を追加 |
| 2026-11-28 | AD-026 | スラッシュコマンドメニュー（`slash-command-menu`）: `src/utils/slash-commands.ts`、`#slash-menu` ブロック挿入 UI を追加 |
