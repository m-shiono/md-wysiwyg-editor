# System Specification — vsc-md-editor

VS Code 拡張 **vsc-md-editor** の振る舞い仕様（WHAT）。実装詳細・テストケース一覧は本書に含めない。

---

## 概要

チーム向け技術ドキュメントを Git 管理しながら、Word/Excel に近い WYSIWYG 体験で Markdown（`.md`）を編集する VS Code 拡張機能。MVP では同一 Custom Editor 上の **Preview / Markdown / Raw 三点モード**、**GFM 書式ツールバー**（§2 — 取り消し線・H1–H6・インラインコード・引用・タスクリスト・水平線等）、**GFM / HTML 二形式表編集**（§3・アーキテクチャ AD-005）、ファイル単位 Readonly 切替、Mermaid リアルタイム描画（VS Code kind → Mermaid `redux` / `redux-dark`、表示密度 `themeVariables.fontSize: '10px'`、タイトル全文可視、Editor Preview / Rich Editor のみビューポート fit／ズーム／パン／スクロール、CSP 下 Host 同一 nonce による presentation `<style>` 再注入、frontmatter オプトイン ELK、Preview / Markdown で図下ソース併記 — §5）、**Marp プレビュー**（§6 — サイド/パネル。**Preview モードでも Marp 検出時は同一 Webview 内にスライド描画可** — §1 / AD-008）、**Host 側 `img/` 画像 URI 解決**（§7 / §9）、クリップボード画像のローカル保存を提供する。リッチ表現（拡張記法・HTML 混在）を Markdown 厳密互換より優先する（UD-001）。今回追加の書式ノードは GFM として往復できること（§8）。

**feature-slug:** `vsc-md-wysiwyg`

**Custom Editor viewType:** `vsc-md-editor.wysiwyg`（`package.json` `contributes.customEditors` と一致）

### アーキテクチャ方針（AD-* 要約）

| ID | 方針（WHAT） |
|----|-------------|
| AD-001 | TypeScript / VS Code Extension Host / npm / `@vscode/test-electron` |
| AD-002 | `*.md` を Custom Editor（viewType `vsc-md-editor.wysiwyg`）で開く。Extension Host 上の `MarkdownDocument` が dirty・undo/redo・save および表示内容の正本 |
| AD-003 | **Markdown モード**は Webview 内 TipTap（ProseMirror）WYSIWYG。対象ノードは見出し（h1–h6）、太字、斜体、取り消し線（GFM `~~`）、箇条書き、番号リスト、タスクリスト、リンク、インラインコード、コードブロック、引用、水平線、表（§3）等（書式ツールバー契約は §2） |
| AD-004 | 編集内容 ↔ ディスク `.md` は remark/unified パイプラインで変換。HTML 混在・拡張ブロックを許容。出力は決定的（AD-013） |
| AD-005 | 表は per-table `tableFormat`（`gfm` \| `html`）で永続化する。新規挿入のデフォルトは GFM パイプ表。形式切替は Table メニューの明示操作のみ（§3） |
| AD-006 | ファイル単位 Readonly は **全編集面**（Markdown / Raw）をロック。Preview モードとは別概念。状態はワークスペースに永続化 |
| AD-007 | Mermaid はコードブロック + リアルタイム描画。VS Code kind → Mermaid `redux` / `redux-dark` マップ、グローバル表示密度は `themeVariables.fontSize: '10px'`（固定 px。`var(--vscode-...)` 禁止。密度の主手段は `fontSize` — CSS `scale`/`zoom` を密度代替にしない）。**密度（fontSize）と閲覧用ビューポート変換（fit／ズーム／パン）は別契約**（§5 / `mermaid-readable-viewport`）。図タイトル全文がクリップされないこと。ビューポート UX（初期 fit・ズームイン／アウト・パン／ドラッグ・縦横スクロール・再 render 時 re-fit・a11y `aria-label`）は **Editor Preview / Rich Editor の Mermaid NodeView のみ**（Default Preview 埋め込みなし）。CSP 下 Host 同一 nonce による presentation `<style>` 再注入、`@mermaid-js/layout-elk` 登録＋ frontmatter / `%%{init}%%` オプトイン ELK（遅延ロード・グローバル強制なし — §5）。classic `default`/`dark` マップおよび静的 Host CSS エッジフォールバック優先は撤回（`mermaid-redux-elk-fidelity`）。**Preview / Markdown とも図の下にソース併記**。編集はテキストのみ（Preview は厳密 RO・ズーム／パンは閲覧操作のみ）。`securityLevel: 'strict'`・HIP・`'unsafe-inline'` なしは不変 |
| AD-008 | **Marp Preview** はサイド/パネル（§6）を維持。**Preview モード**（§1）でも `isMarpDocument(markdownText)` 検出時は同一 Webview 内 `#preview-marp-root` に Host 生成 HTML を RO 表示可。別 UI インスタンス・別責務は維持。編集は Markdown / Raw 側 |
| AD-009 | 画像 paste → 同階層 `img/image-NNNN.ext` に保存し相対パスを挿入。表示時は Host が `img/` 配下のみ `asWebviewUri` で rewrite（§7 / §9）。serialize / ディスクは常に相対パス |
| AD-010 | Webview CSP + HTML サニタイズ。許可タグ・属性を限定 |
| AD-011 | Extension Host と Webview を別バンドルし `media/` に配置 |
| AD-012 | シリアライズ round-trip のユニットテスト + Custom Editor 統合テスト |
| AD-013 | 保存時の整形ルールを固定し Git diff 可読性を確保 |
| AD-014 | ビルトイン Markdown エディタとの共存（エディタ関連付けの切替可能） |
| AD-015 | Output チャンネルで障害ログ。ユーザー向けはエディタ内インライン表示を優先 |
| AD-016 | 同一 Custom Editor 内に **Preview / Markdown / Raw** 三点モード。初期モードは **Raw**（`DEFAULT_EDITOR_MODE = 'raw'`）。モード切替 alone ではディスク書き込みしない。**Default Preview**（§1 / §10・表示ラベル）は mode-toolbar の非モード導線であり、4 つ目の `editorMode` ではない |

---

## §1 Custom Editor 基盤

### 概要

`.md` ファイルを Custom Editor（viewType `vsc-md-editor.wysiwyg`）として開き、Extension Host 上の `MarkdownDocument` を正本として、同一タブ内の **Preview / Markdown / Raw** 三点モードと同期する（AD-002, AD-016）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `documentUri` | `vscode.Uri` | はい | — | — | ワークスペース内 `.md` |
| `fileContent` | `string` (UTF-8) | はい | 0 B | 推奨 500 KB 未満 | 超過時は警告のみ（RK-004） |
| `extensionActivation` | イベント | はい | — | — | Custom Editor オープン時に限定起動（AD-002） |
| `editorMode` | `"preview" \| "markdown" \| "raw"` | はい | — | — | 初期値 `"raw"`（`DEFAULT_EDITOR_MODE` / AD-016）。第 4 の mode id は持たない |
| `modeSwitchCommand` | コマンド / UI 切替 | 任意 | — | — | 三点モード変更のみ。ディスク I/O なし。Default Preview は対象外 |
| `openNativePreview` | Webview → Host postMessage | 任意 | — | — | Default Preview ボタン押下。payload 型は `messages.ts`（旧名 `openNativePreviewToSide` は廃止）。Host のみ dirty/save/コマンド実行 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功（オープン） | Custom Editor タブ表示、Webview ロード完了、初期モード **Raw**（表示ラベル Edit Raw Text） | AD-016 |
| 成功（モード切替） | 対象面を表示、Document 内容は維持、**ディスク未書込** | dirty 状態も変更しない（内容未変更時）。三点往復可（下記受け入れ） |
| 成功（Default Preview・clean） | 現在面不変のまま `markdown.showPreview` で標準 Preview を開き、**アクティブ WYSIWYG と同一 editor group** に配置する | Host コマンド §10。Beside（新規グループ）を作らない。`editorMode` は変更しない |
| 成功（Default Preview・dirty→Save） | Save 成功後のみ標準 Preview を同一グループに開く | Cancel / 閉じる / save 失敗時は開かない |
| 成功（保存） | ディスク上 `.md` 更新、`dirty` 解除 | AD-013 整形後 |
| ファイル読込失敗 | エディタ未表示、通知 + Output | 権限・存在エラー |
| シリアライズ失敗 | 保存拒否、`dirty` 維持、通知 + Output | Document 正本は維持。Default Preview も開かない |
| Raw パース失敗 | Document **を更新しない**、通知 + Output、**save ブロック** | 失敗中フラグ。直前の有効 Document を保持。Default Preview Save ゲートも拒否 |
| Default Preview URI 解決不能 | Warning（`Open a Markdown file first` 相当）、プレビュー非オープン | アクティブ WYSIWYG `TabInputCustom.uri` 前提 |
| Default Preview コマンド失敗 | ErrorMessage + Output、プレビュー非オープン | `markdown.showPreview` 欠如・失敗。**`showPreviewToSide` へフォールバックしない** |
| 大ファイル警告 | 編集継続可、Output に警告 | RK-004 |

### Preconditions

- VS Code が AD-001 で定める最小 `engines.vscode` を満たすこと
- 対象 URI がファイルシステム上の通常ファイルであること（リモート FS は未保証）
- Webview でスクリプト有効化が許可されること

### Behavior

#### 三点モード定義（AD-016）

同一 Custom Editor タブ内で次の 3 モードを切り替える。**§6 Marp Preview パネル**（サイド/パネル）は別 UI インスタンスとして維持するが、**Preview モード**（`editorMode === 'preview'`）でも Marp 文書検出時は同一 Webview 内で Marp スライドを RO 表示できる（§1 Preview 分岐 / AD-008）。

概念名（Preview / Markdown / Raw）は編集面・同期契約の記述に用いる。プロトコル・状態の正は **mode id**（`editorMode` / ボタン `data-mode`）。ツールバーの**表示ラベル**は mode id とは別契約であり、実装・テストは mode id をリネームしてはならない。

| モード（概念） | mode id | 役割 | 編集可否 | Document との関係 |
|----------------|---------|------|----------|-------------------|
| **Preview** | `preview` | 読み取り専用の描画表示。**非 Marp:** TipTap RO + Host 解決済み画像 + Mermaid 図＋ソース併記（§5・ソース領域は RO・Document へ編集イベントを送らない）。**Marp 検出時:** `#preview-marp-root` に Host 生成サニタイズ HTML（縦スクロール一覧） | **不可（厳密 RO）** | **Document → 一方表示**のみ。キー入力・paste・ツールバー等の編集イベントを Document へ送らない |
| **Markdown** | `markdown` | TipTap WYSIWYG 本文編集（§2）。画像は Host rewrite 済み `docJson` を投影（§7） | 可（ファイル RO 時は不可 — §4） | Markdown 面 ↔ Document 双方向。変更で `dirty` |
| **Raw** | `raw` | Markdown ソース文字列の直接編集 | 可（ファイル RO 時は不可 — §4） | Raw 面 ↔ Document 双方向。変更で `dirty` |

##### mode-toolbar 表示ラベル（UI）

Webview `#mode-toolbar`（`role="toolbar"`）の**左から右**のボタン順・表示文言は次と一致させる（表示のみ。mode id / `editorMode` は変更しない）。**Default Preview は 4 つ目の `editorMode` ではない。**

| 順序 | 種別 | mode id / action | 表示ラベル（ボタン文言） | `title` / `aria-label` |
|------|------|------------------|-------------------------|------------------------|
| 1 | 非モード | `data-action="native-preview"`（**`data-mode` なし**） | `Default Preview` | `Open Default Markdown Preview` |
| 2 | モード | `preview` | `Editor Preview` | `Editor Preview` |
| 3 | モード | `markdown` | `Edit Rich Editor` | `Edit Rich Editor` |
| 4 | モード | `raw` | `Edit Raw Text` | `Edit Raw Text` |

セパレータは任意・最小限（視覚的には四ボタンを同等に並べることを優先。縦線セパレータは必須としない）。

##### mode-toolbar — Default Preview（非モード導線）

ツールバー**先頭**の **Default Preview** は **モードボタンではない**（同一 `#mode-toolbar`）。押下は `editorMode` を変更せず、VS Code 標準 `markdown.showPreview` を開き、Host 補償で **同一 editor group** に配置する（§10）。Beside（横分割・新規グループ）は作らない。

| 項目 | 契約 |
|------|------|
| 文言 | `Default Preview` |
| `title` / `aria-label` | `Open Default Markdown Preview`（`to the Side` を含めない） |
| 属性 | `data-action="native-preview"`（または同等）。**`data-mode` を付けない** |
| クリック | `applyMode` / `setMode` を通さない。Webview は `openNativePreview` 系 postMessage のみ送る（Webview から `markdown.showPreview*` を直接呼ばない） |
| 押下後の表示面 | `editorMode` / `body[data-mode]` / 三点モードボタンの `active` は **不変** |
| Host | dirty 判定・Save/Cancel・`markdown.showPreview`・同一グループ補償（§10）はすべて Host（§8 / §10） |
| editor/title | Default Preview 用アイコンを **出さない**（Webview バー + Command Palette） |

**受け入れ（モード切替・P0）:** mode-toolbar の三点モードボタン（Editor Preview / Edit Rich Editor / Edit Raw Text）で `preview` ↔ `markdown` ↔ `raw` が往復できること。初期 HTML の `active` / `body[data-mode]` は `DEFAULT_EDITOR_MODE = 'raw'` と一致させる。Default Preview 押下では mode id が変わらないこと。

#### 三者同期（正本: `MarkdownDocument`）

```text
Raw（markdownText）  ←→  Document（doc + markdownText）  ←→  Markdown（TipTap WYSIWYG）
                                    ↓
                              Preview（表示層のみ — 正本は変更しない）
                                    ├─ 非 Marp: TipTap RO（docJson + 画像 URI rewrite）
                                    └─ Marp: Host render → previewMarpHtml → #preview-marp-root
```

- **編集可能なのは Markdown / Raw のみ**。Preview は常に Document の投影を RO 表示する
- Markdown 編集 → Document 更新 → Raw テキスト投影 + Preview 描画追随（Markdown フォーカス中は TipTap を破壊しない — TC-067）
- Raw 編集（パース成功）→ Document 更新 → Markdown / Preview へ `docJson` 投影（画像 `src` は Host が rewrite 後に送信）
- **Preview 表示中**も Document 更新時は描画を追随する（一方通行）
- **Preview 表示層**（Marp HTML 注入・画像 URI rewrite・Mermaid 描画/CSS・Preview 可読性 CSS）は `docJson` / `markdownText` / serialize を変更しない（三者同期維持 — `preview-mode-quality` AD-002）

#### Preview 表示分岐（`preview-rich-embed`）

| 条件 | 表示 | Host 処理 |
|------|------|-----------|
| `editorMode === 'preview'` かつ **非 Marp** | `#editor`（TipTap）表示、`#preview-marp-root` 空 | `docJson` 内 `image.src` を `asWebviewUri` 済み URL に rewrite して投影 |
| `editorMode === 'preview'` かつ **`isMarpDocument(markdownText)`** | `#editor` 非表示、`#preview-marp-root` に Marp HTML | `@marp-team/marp-core` + 既存 `sanitizeHtml` / `sanitizeCss`（§6 と共用）。`markdownText` を入力。`previewMarpHtml` postMessage |
| `editorMode !== 'preview'` または非 Marp 離脱 | `#preview-marp-root` 空、`#editor` 表示 | Marp 分岐しない |

- **Marp 検出**は共有ユーティリティ `isMarpDocument()` を正とする（`src/commands/marp-preview.ts` から export または `src/utils/` へ移行）。Preview 切入時と `markdownText` 更新の両方で再評価
- **Markdown / Raw モード**では Marp 分岐しない（Rich Editor Marp WYSIWYG は Non-Goal）
- `#preview-marp-root` は `role="document"` `aria-readonly="true"`。スライド UX は §6 パネルと同じ **縦スクロール一覧**（ページ送り UI は作らない）
- Preview 切入で §6 Marp Preview パネルを自動オープンしない

#### Preview 可読性（`preview-mode-quality`）

非 Marp Preview（TipTap RO 表示層）の Typography・コントラストは **`body[data-mode='preview']` スコープの CSS のみ**で改善する。Markdown / Raw モードのスタイルは変更しない。色は **`--vscode-*` CSS 変数**を正とし、ハードコード色は用いない。Mermaid 図は VS Code 面＋標準テーマに乗せ、`.mermaid-preview` / `.mermaid-block` への**明るい島サーフェス強制は行わない**（§5 / `fix-mermaid-edge-styles`）。`#editor` 全体や広い Preview 面の背景は変えない。

| 要素 | 要件 |
|------|------|
| 本文 | `line-height: 1.6`（目安）。見出し・段落の余白は Preview スコープで微調整可 |
| `.ProseMirror[contenteditable='false']` | Preview 時の `opacity` は **1**（Edit 面との完全一致は Non-Goal — コントラスト確保を優先） |
| リンク・引用・表・コードブロック | 既存の `--vscode-*` トークンを継続使用 |

- Marp 分岐（`#preview-marp-root` / `previewMarpHtml`）の契約は変更しない（`preview-mode-quality` AD-008）
- Preview 表示層の CSS は Document 正本・三者同期に影響しない（`preview-mode-quality` AD-002）

#### postMessage — Host → Webview（Preview 追加）

| メッセージ | 方向 | payload | 備考 |
|-----------|------|---------|------|
| `previewMarpHtml` | Host → Webview | `{ html: string }` | サニタイズ済み body 断片 + inline style。Webview は DOM 注入のみ（`innerHTML` は Host 済み HTML のみ） |
| `themeUpdated` | Host → Webview | `{ kind: 'light' \| 'dark' \| 'highContrast' }` | VS Code カラーテーマ変更時（Host: `onDidChangeActiveColorTheme`）および Webview `init` / `ready` 時に送信。payload は列挙型 `kind` のみ — 任意 HTML / 設定オブジェクトは送らない（§9 / `preview-mode-quality` AD-010）。Webview は Mermaid グローバルテーマ更新・再描画に用いる（§5） |
| （既存）`docJson` 投影 | Host → Webview | TipTap JSON | 送信前に Host が `image.src` を rewrite |

型定義は `src/webviews/messages.ts` に追加する。

#### 正常系

1. ユーザーが `.md` を開くと Custom Editor が起動し、ディスク内容を `MarkdownDocument` に読み込み、初期モード **Raw**（表示ラベル Edit Raw Text）で Webview に表示する（`DEFAULT_EDITOR_MODE = 'raw'` / AD-016）。セッション永続モードは本タスクで新設しない
2. **Markdown ↔ Raw 相互リアルタイム同期:** 一方の編集は postMessage 経由で Document に反映され、他方面も Document から再投影される。正本は常に Extension Host の `MarkdownDocument`
3. **Preview** は Document の現在内容を **厳密 RO** で描画する一方通行。Preview 表示中に Document が更新されれば描画を追随する。**Preview への切替時**は Host が Document 最新を再投影する（Raw 離脱時の flush 後を含む）。非 Marp は rewrite 済み `docJson`、Marp 検出時は `previewMarpHtml` で `#preview-marp-root` を更新
4. **モード切替**（Preview ↔ Markdown ↔ Raw）は表示面の切替のみであり、**ディスクへの書き込みを行わない**。内容に差分がなければ `dirty` も変化しない。Preview / Markdown への切替時は Document から視覚面を refresh する。Preview 離脱時は `#preview-marp-root` を空にし `#editor` を復帰
5. Markdown / Raw での内容変更は既存の CustomDocument フローに乗り `dirty` となる。`save` / `saveAs` で Document 内容をシリアライズし UTF-8 で書き込む（§8）
6. undo/redo は Document 経由で一貫して動作する（モードをまたいでも同一 Document 履歴）
7. エディタを閉じる際、未保存変更があれば VS Code 標準の確認ダイアログが表示される
8. **Default Preview:** ツールバー **Default Preview** 押下で Host が対象 URI を解決し、Document が clean なら即 `markdown.showPreview`（同一グループ補償付き — §10）。dirty のときは §8 / §10 の Save/Cancel ゲートに従う。押下は三点モード面（`editorMode`）を変更しない

#### 例外系

1. オープン時にパース不能な Markdown/HTML 混在は可能な範囲で表示し、保存時にシリアライズエラーを報告する
2. **Raw 編集中のパース失敗:** Document を破壊・上書きしない。ユーザーへ通知し Output に記録する。パース失敗が解消されるまで **save をブロック**する（直前の有効 Document 内容を正本として維持）
3. 外部プロセスによるファイル変更は VS Code の標準リロード/競合フローに従う
4. **Default Preview 失敗:** URI 解決不能・Save Cancel・save 失敗・`markdown.showPreview` 失敗時はプレビューを開かず、Warning / ErrorMessage + Output（§10）。**`markdown.showPreviewToSide` へのフォールバックはしない**

### Non-Goals

- Language Server との完全統合（RK-008 — backlog 検討）
- 仮想スクロールによる大ファイル最適化（RK-004 — backlog）
- Preview / Markdown / Raw の同時分割表示（同一タブ内の三点切替のみ）
- モードごとに別 Custom Editor / 別 viewType を登録すること
- **4 つ目の `editorMode` / mode id**（例: `native-preview` を mode id として追加）および Default Preview の mode 化（`data-mode` / `applyMode` 経由）。※ `data-action="native-preview"` は非モード action 名であり mode id ではない
- VS Code ビルトイン Markdown Preview の **同一 Webview への埋め込み**・markdown-it HTML パイプラインへの全面置換（三点 Preview は TipTap RO / Marp 分岐を維持）
- Custom Editor バッファの未保存差分を標準 Preview へリアルタイム同期すること（dirty 時は保存ゲートで整合 — AD-013）
- Preview 内 Marp のページ送り UI（縦スクロール一覧のみ）
- Preview 切入時の §6 Marp Preview パネル自動オープン
- Rich Editor（Markdown モード）での Marp WYSIWYG 描画（§6 Non-Goals と同旨）
- VS Code ビルトイン Markdown Preview とのピクセル完全一致（`preview-mode-quality` — 三点モード一体感・テーマ連動可読性を優先）
- VS Code ビルトイン Preview の嵌め込み・別 Webview 化・markdown-it HTML パイプラインへの全面置換（非 Marp Preview は TipTap RO 表示層を維持 — `preview-mode-quality` AD-001）
- Default Preview 失敗時の **`markdown.showPreviewToSide` フォールバック**（同一グループ優先に反する）
- 隣接タブ index（`activeIndex + 1`）の **厳密保証**（best-effort。必須は同一 group のみ — §10 / RK-018）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-001–009（基盤）および三点モード追加 TC。Preview Marp 分岐・`previewMarpHtml`・`isMarpDocument` 共用: TC-124–142（`preview-rich-embed`）。Preview 可読性・`themeUpdated`: 後続 TC（`preview-mode-quality`）
- 初期 Raw・Default Preview・dirty Save/Cancel・Pattern A 非干渉・三点往復・表示ラベル・同一グループ配置: [doc/testspec-native-preview-side-and-default-raw.md](testspec-native-preview-side-and-default-raw.md)（`native-preview-side-and-default-raw` / `default-preview-same-tab-group`）

### Spec Gaps

- なし（モード初期値 Raw・Raw パース失敗時 save ブロック・モード切替でディスク非書込・Preview Marp 分岐・画像 Host rewrite・Preview 可読性 CSS・`themeUpdated`・Default Preview 同一グループ配置は本節および §5 / §6 / §7 / §8 / §9 / §10 で確定）

---

## §2 WYSIWYG 本文編集（Markdown モード）

### 概要

三点モードのうち **Markdown モード**で、Webview 内 TipTap により Markdown 本文を WYSIWYG 編集する（アーキテクチャ AD-003）。書式ツールバーは GFM 基本装飾を充足する（Requirements Brief `gfm-format-toolbar`）。対象ノードは見出し（h1–h6）、太字、斜体、取り消し線（GFM `~~`）、箇条書き、番号リスト、タスクリスト（`- [ ]` / `- [x]`）、リンク、インラインコード、コードブロック、引用（`>`）、水平線（`---`）、表（§3）。今回追加分は parse/serialize 往復できること（§8）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `editOperation` | 編集コマンド / キー入力 / ツールバー | はい | — | — | ファイル RO 時は拒否（§4）。Preview では Document へ送らない（§1） |
| `formatToolbarCommand` | `data-cmd` 列挙 | 任意 | — | — | 下記「書式ツールバー」表。第一操作はツールバー |
| `documentSnapshot` | 内部ドキュメントモデル | はい | — | — | TipTap / ProseMirror 相当（アーキテクチャ AD-003）。投影時 `image.src` は Host rewrite 済み（§7） |

#### 書式ツールバー（In / Out）

| 区分 | 項目 | `data-cmd` | 備考 |
|------|------|------------|------|
| **In** | Bold / Italic（既存） | 既存どおり | — |
| **In** | Strikethrough | `strike` | シリアライズ正本は GFM `~~text~~`。HTML `<del>` / `<s>` は入力時 strike に正規化し、保存は `~~`（`<del>`/`<s>` は出さない）。単独 `~` は取り消し線にしない |
| **In** | Inline Code | `inlineCode` | `` `code` `` mark（`toggleCode`）。フェンスコードブロックとは別コマンド |
| **In** | Heading H1–H6 | `heading` + `data-level` 1–6 | `toggleHeading({ level })`。同一レベル再クリックで paragraph。別レベルは置き換え |
| **In** | Bullet / Ordered（既存） | 既存どおり | タスクリスト上で実行すると当該リスト種へ変換し、**checked は捨てる** |
| **In** | Task List | `taskList` | `toggleTaskList`。出力 `- [ ]`（未チェック）/ `- [x]`（チェック、小文字 `x`、括弧内スペース必須）。入力 `[ ]` / `[x]` / `[X]` を受け、出力は `[x]` に正規化。`1. [ ]` は **unordered タスクリストへ正規化**（番号非保持）。同一リストに `listItem` と `taskItem` を混在させない |
| **In** | Blockquote | `blockquote` | `toggleBlockquote`。出力 GFM `>`。paragraph 以外のブロック子（heading, list, taskList, codeBlock, 入れ子 blockquote）を落とさない |
| **In** | Link / Code Block（既存） | 既存どおり（Code Block は `codeBlock`） | 可視ラベル `Code` / `title="Code Block"` 維持。インラインとコマンドで区別 |
| **In** | Horizontal rule | `horizontalRule` | `setHorizontalRule`（トグル削除ではない）。出力 `---`（mdast `thematicBreak`）。前後空行はアーキテクチャ AD-013 の決定的整形に従う |
| **In** | Table（既存） | 既存どおり | §3。ドロップダウン契約は変更しない |
| **Out** | 画像挿入ボタン | — | クリップボード paste（§7）は維持 |
| **Out** | 下線・highlight（`mark`） | — | GFM にない装飾 |
| **Out** | 脚注・GitHub Alerts（`> [!NOTE]` 等） | — | GFM 拡張として有効化しない |
| **Out** | 絵文字ショートコード | — | Intent Out |

#### ツールバー構成・ラベル（UI）

個別ボタン（折りたたみ・見出しドロップダウン・overflow なし）。`#toolbar` は既存 `flex-wrap` で折り返す。視覚セパレータで 4 群:

1. **インライン:** Bold, Italic, Strikethrough, Inline Code  
2. **見出し:** H1, H2, H3, H4, H5, H6  
3. **ブロック:** Bullet, Ordered, Task List, Blockquote  
4. **挿入:** Link, Code Block, Horizontal rule, Table  

| ボタン | 可視ラベル | `title` | `data-cmd` |
|--------|------------|---------|------------|
| Strikethrough | `S`（表示に line-through） | `Strikethrough` | `strike` |
| H3–H6 | `H3`…`H6` | 同左 | `heading` + `data-level` |
| Inline Code | `` ` `` | `Inline Code` | `inlineCode` |
| Task List | `Task` | `Task List` | `taskList` |
| Blockquote | `Quote` | `Blockquote` | `blockquote` |
| Horizontal rule | `―` | `Horizontal rule` | `horizontalRule` |

ラベルは英語（i18n は Non-Goal）。`#toolbar` に `role="toolbar"` `aria-label="Formatting"`。トグル系は `aria-pressed` と選択に連動する pressed 見た目（`var(--vscode-*)`）。HR は挿入のため pressed なし。ネイティブ `button` の Tab / Enter / Space で操作可能。

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | UI 更新、Document dirty、Raw 投影（§1） | Markdown かつ非 RO |
| ファイル RO 中の編集試行 | 操作無効（`#toolbar` の `pointer-events: none` + ハンドラ `readonly` ガード）。タスクチェックボックスもトグル不可 | §4。新例外なし |
| Preview モード | 書式ツールバー非表示、編集イベントを Document へ送らない | §1 |
| Raw モード | ツールバー表示は変えないが、Markdown モード以外では書式コマンドは no-op | — |
| 未対応ノード / 記法 | 読み取り表示または raw 保持 | データ損失を避ける。脚注・Alerts 等は本節 Out |

### Preconditions

- Custom Editor が **Markdown モード**であり、かつファイル単位 RO でないこと（§1, §4）— 書式適用の実行条件
- Webview がロード済みであること

### Behavior

#### 正常系

1. ツールバー（および既存ショートカット）で書式を適用できる。新項目の第一操作はツールバー
2. 編集内容はリアルタイムで内部モデルおよび `MarkdownDocument` に反映される（§1 同期）
3. 保存時に remark パイプラインで Markdown（+ 許可 HTML）へシリアライズされる（アーキテクチャ AD-004）。今回追加ノードの往復契約は §8
4. VS Code テーマ CSS 変数（`var(--vscode-*)`）で見た目を統合する（blockquote / hr / strike / task list を含む）
5. Markdown モードでの変更は Raw 面へ Document 経由でリアルタイム反映される（§1）
6. **取り消し線:** パースは GFM strikethrough 拡張で `~~` → TipTap `strike`。HTML 混在の `<del>` / `<s>` は strike に正規化し保存は `~~`。空選択トグルは TipTap stored mark（次入力に適用）でよい
7. **タスクリスト:** TipTap `taskList` / `taskItem`。ネストは `TaskItem.nested: true` を維持。エディタ内チェックボックス操作は編集であり Document を更新する。パース/シリアライズに GFM task-list 拡張を用いる（direct dependency）
8. **インラインコード vs フェンス:** `inlineCode` は `toggleCode`、Code Block は既存 `toggleCodeBlock`。インラインコード内の `~~` はコード文字として扱い、strike と同時適用しない（code 優先）
9. **複合 mark:** 同一 text ノードに複数 mark（例: strike+bold）。`~~**bold**~~` / `**~~bold~~**` は strike+bold としてパースし、保存は決定的な一方のネストでよい。見た目同等なら byte 一致は要求しない。既存 phrasing 平坦化の全面書き換えはしない
10. **キーボード:** 新項目の `contributes.keybindings` は追加しない。Strike 既定 `Mod-Shift-s`（Save All）と Blockquote 既定 `Mod-Shift-b`（Run Build Task）は **無効化**。HR / Task に新ショートカットは付けない。既存 Bold/Italic および Heading `Mod-Alt-1..6`（StarterKit）は変更しない。ショートカットは Markdown モードかつ Webview フォーカス時のみ
11. **レイヤ分割:** ツールバー HTML は `markdown-editor-provider`、コマンドは `media/editor.ts`、往復は `src/serializers/markdown-serializer.ts`、見た目は `media/editor.css`。Table メニュー・画像 paste・三点 mode-toolbar は触らない。新編集面は作らない
12. **GFM 拡張の追加面:** strikethrough と task-list のみ（既存 `gfm-table` は維持）。footnotes / autolink-literal / GitHub Alerts / tagfilter 変更は有効化しない

#### 例外系

1. 既存 `.md` に本拡張未対応の記法がある場合、可能な限り原文を保持する
2. シリアライズ不能な構造は保存をブロックしエラーを表示する（アーキテクチャ AD-015）
3. 既存ファイルの `~~` および行頭 `- [ ]` は WYSIWYG で strike / task として解釈される（literal 表示からの変更。GFM 正の修正。ディスク記法は概ね維持）

### Non-Goals

- CommonMark / GFM の厳密互換（UD-001 — リッチ優先）。ただし本節 In の追加分は GFM 往復必須
- 全 Markdown 拡張記法の WYSIWYG 対応（脚注・Alerts・下線・highlight・画像挿入ボタン等 — Scope Out）
- 画像挿入ボタン（§7 クリップボード paste は維持）
- i18n（UI 文言の多言語化 — backlog）
- Raw / Preview モード中の TipTap 書式適用（Preview は非表示 / Raw は no-op）
- `package.json` への新 keybindings 登録
- 三点モード id・表契約（§3）の変更

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-010–015 および GFM 書式ツールバー追記 TC（`gfm-format-toolbar` / 後続 `spec-test-design`）

### Spec Gaps

- なし（Scope In/Out・Advisor Defaults は Requirements Brief `gfm-format-toolbar` で確定。番号付きタスクリスト `1. [ ]` の unordered 正規化・複合 mark のネスト順は許容リスクとして本節・§8 に契約化）

---

## §3 表編集

### 概要

Excel 的な表編集。各表は per-table `tableFormat`（`gfm` \| `html`）で永続化する。新規挿入のデフォルトは **GFM パイプ表**（GitHub 親和性）。HTML 形式ではセル内改行・箇条書き・チェックボックス等のリッチ表現を WYSIWYG で保持する（AD-005, UD-006）。形式変更は Table メニューの明示操作のみとし、編集操作による自動変換は行わない。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `tableFormat` | `'gfm'` \| `'html'` | はい（表ごと） | — | — | 当該表の永続化形式。読込時はソースから推論（既存 `gfmSource` / `html` 属性は互換推論に使用） |
| `insertTableFormat` | `'gfm'` \| `'html'` | はい（セッション） | — | — | 新規挿入のデフォルト形式。Webview 内メモリのみ（VS Code 再起動で `gfm` にリセット）。ワークスペース / ユーザー設定への永続化は MVP 非対象 |
| `tableOperation` | 列挙 | 操作ごと | — | — | `insert`、行/列追加・削除（`addRowBefore` / `addRowAfter` / `deleteRow` / `addColumnBefore` / `addColumnAfter` / `deleteColumn`）、`deleteTable`、`convertToGfm`、`convertToHtml`、`setInsertDefault` |
| `cellContent` | テキスト / リッチ | 任意 | 空 | — | `gfm`: インラインマーク・プレーンテキスト。**セル内改行**は `<br />`（または同等 hard break）として永続化し、Markdown↔Raw で**単一改行**として往復する（連続 `<br />` による空行相当・多重改行は不可／単一改行へ正規化）。リスト等のブロック構造は不可。`html`: 改行・リスト・チェックボックス可（本項の GFM 改行契約は HTML リッチセル仕様を変更しない） |
| 表サイズ | 行 × 列 | はい | 1 × 1 | ソフト上限 100 行 × 20 列 | 超過時 UI 警告、保存は許可 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功（`gfm`） | 表 UI 更新、保存時 GFM パイプ表出力 | AD-005, AD-013 |
| 成功（`html`） | 表 UI 更新、保存時 HTML `<table>` ブロック出力 | AD-005, AD-010, AD-013 |
| `convertToHtml` 成功 | 当該表の `tableFormat` を `html` に更新。確認なし即時実行（プレーンテキスト昇格、実質ロスレス） | Undo 1 段で復元可 |
| `convertToGfm` 成功 | 当該表の `tableFormat` を `gfm` に更新。リスト・チェックボックス等のブロックリッチはプレーンテキストへ flatten。セル内改行は GFM の `<br />`（または同等 hard break）として保持し、単一改行へ正規化する | 実行前に確認ダイアログ必須 |
| `convertToGfm` キャンセル | 変換なし、表・`tableFormat` 不変 | ユーザーが確認を拒否 |
| `setInsertDefault` 成功 | `insertTableFormat` 更新、Table ボタン色を反映。既存表の `tableFormat` は不変 | AD-004 |
| ソフト上限超過 | UI 警告表示、編集・保存は継続可 | 100 行 × 20 列、両形式共通 |
| RO 中 | 全 Table メニュー項目無効 | §5 |
| サニタイズ拒否 | 危険タグ/属性を除去して表示 | AD-010, RK-003 |

### Preconditions

- 編集モードであること（Readonly 時は §5 に従い全操作無効）
- 表は WYSIWYG 内部の表モデルとして存在すること
- 行/列操作・形式変換はカーソルが当該表内にあること（挿入・セッションデフォルト切替を除く）

### Behavior

#### Table ツールバー UI

Table ボタン（▼ ドロップダウン）の構成:

1. **Insert table** — 3×3・ヘッダ行あり。`insertTableFormat` に従い `tableFormat` を設定して挿入
2. **行/列操作**（カーソルが表内のときのみ有効）— Add row above/below、Delete row、Add column left/right、Delete column、**Delete table**
3. **Convert to GFM pipe table** — 当該表が `html` のときのみ有効
4. **Convert to HTML table** — 当該表が `gfm` のときのみ有効
5. **New tables default: GFM / HTML** — `insertTableFormat` とボタン色を更新（既存表の `tableFormat` は変更しない）

Table ボタンの色は **セッション挿入デフォルト**（`insertTableFormat`）を反映する。GFM = 通常ツールバースタイル、HTML = アクセント色。カーソルが表内にあるときはドロップダウン内チェックマークで **当該表の `tableFormat`** を示し、ボタン色とは分離する。

#### 正常系

1. 表の挿入、行/列の追加・削除、セル編集ができる
2. `tableFormat: 'html'` の表では、セル内に複数行テキスト、箇条書き、チェックボックスを入力できる（HTML リッチセルの既存仕様は変更しない）
3. `tableFormat: 'gfm'` の表では、セル内容はインラインマーク・プレーンテキストに制限する。**セル内改行**はソース上 `<br />`（または同等 hard break）として永続化し、Markdown 面では単一改行として表示・編集する。Raw の `<br />` を Markdown へ投影するときも単一改行とする（空行相当の多重改行は作らない）。リスト・複数段落などのブロック構造は不可
4. 保存後の `.md` は当該表の `tableFormat` に応じて GFM パイプ表または HTML `<table>` として記録される。GFM 表セル内の改行はパイプ行内の `<br />`（または同等 hard break）として出力する
5. 既存 GFM パイプ表の読込 → `tableFormat: 'gfm'`、既存 HTML `<table>` の読込 → `tableFormat: 'html'`（サニタイズ後）。属性欠落時は `gfmSource` / `html` 属性から推論する。GFM セル内の `<br />`（または同等）は単一改行として Document / Markdown 面へ復元する
6. **GFM→HTML** 変換は確認なしで即時実行する。**HTML→GFM** 変換は実行前に確認ダイアログを表示する（例: 「リスト・チェックボックス等はプレーンテキストに flatten されます。セル内改行は `<br />` として保持されます。続行しますか？」）。flatten はブロックリッチの除去を指し、セル内改行は上記 GFM 改行契約に従い保持する。MVP に「今後表示しない」オプションは設けない
7. 行数が 100 を超える、または列数が 20 を超える場合、エディタ内にソフト上限警告を表示する（保存は拒否しない）

#### 例外系

1. 外部 HTML 表の読込時、サニタイズ後に表示する（RK-003）
2. 手書き GFM 表と HTML 表が同一リポジトリに混在しうる（RK-006 — スタイルガイド推奨）
3. Readonly（§5）時は Table メニュー全項目を無効化する

#### 廃止（本機能以前の挙動）

- 既存 GFM パイプ表の **初回編集時による自動 HTML 変換** は廃止する。形式変更はメニュー明示操作のみ

### Non-Goals

- 表内数式・ピボット等の Excel 高度機能
- `insertTableFormat` のワークスペース / ユーザー設定への永続化（MVP）
- HTML→GFM 変換確認ダイアログの「今後表示しない」オプション（MVP）
- GFM セル内のリスト・複数段落などブロック構造、および連続 `<br />` による空行相当の保持（単一改行へ正規化）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-016–024, TC-065（既存）。**要追記:** 挿入デフォルト GFM、HTML 挿入、HTML→GFM 確認付き変換・flatten、GFM→HTML 変換、メニュー行/列操作、ボタン色 / セッションデフォルト切替、Readonly 無効、GFM/HTML round-trip（`table-gfm-html-mode`）。**要追記（回帰）:** GFM セル内改行 ↔ Raw `<br />` 単一改行往復、連続 `<br />` の単一改行正規化（`gfm-table-linebreak-fix`）

---

## §4 Readonly モード（ファイル単位）

### 概要

ファイル単位で編集可否を切り替える（UD-005, AD-006）。**三点モードの Preview（読み取り専用描画）とは別概念**である。ファイル RO は Markdown / Raw の **全編集面をロック**する。状態はワークスペースに永続化する。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `toggleReadonlyCommand` | コマンド実行 | はい | — | — | `Toggle Readonly Mode` |
| `targetUri` | `vscode.Uri` | はい | — | — | キー: `readonly:<uri>` |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功（RO ON） | Markdown / Raw とも編集不可、バッジ表示 | Webview `editable: false`（全編集面） |
| 成功（RO OFF） | 編集可（現在モードに応じる） | Preview モード自体は常に非編集 |
| 未オープン URI | 次回オープン時に状態復元 | workspaceState |

### Preconditions

- 対象 `.md` が Custom Editor で開かれている、または URI が有効であること

### Behavior

#### 正常系

1. コマンド実行で当該ファイルの RO 状態がトグルされる
2. RO 状態は `workspaceState` に `readonly:<uri>` として保存される
3. RO 中は **Markdown モードの WYSIWYG（書式ツールバー・タスクチェックボックス含む）・表編集・画像 paste** および **Raw モードのソース編集**が無効化される
4. RO 中も三点の Preview 描画・Mermaid 描画・**Marp Preview（§6）** 等の閲覧系機能は利用できる
5. RO 中でも三点モードの切替自体は可能（表示面の変更のみ。編集は不可のまま）
6. 再オープン時に RO 状態が復元される
7. 書式ツールバーの RO / Preview / Raw ガードは §2 Outputs に従い、本節に新例外を設けない（`gfm-format-toolbar`）

#### 例外系

1. ワークスペース未保存（Untitled Workspace）時は RO 状態をセッション内のみ保持し、VS Code 再起動後は復元しない
2. 保存済みワークスペースでは `workspaceState` キー `readonly:<uri>` により再起動後も RO 状態を復元する

### Non-Goals

- ワークスペース全体 RO（`mdEditor.workspaceReadonly` — Phase 2 / backlog）
- ファイル RO と三点 Preview モードの統合（別概念として維持）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-025–030、および RO×Raw/モード切替 TC（後続）

---

## §5 Mermaid 描画

### 概要

` ```mermaid ` フェンスブロックをリアルタイムに図として描画する。編集はテキストのみ（UD-004, AD-007）。**Editor Preview（`preview`）および Edit Rich Editor（`markdown`）の両方**で、ブロック内順は **図（`.mermaid-preview`）→ ソース（`.mermaid-source`）**（図の下にソース併記）。旧「Preview ソース非表示」（`preview-rich-embed`）は **撤回**する（`mermaid-snap-style-with-source`）。Preview でもソースは表示するが **厳密 RO** を維持し、ソース領域の編集イベントを Document へ送らない（§1）。フェンス内 YAML frontmatter / `%%{init:...}%%` は Mermaid ネイティブに委譲する（`preview-mode-quality` AD-003）— per-diagram の `theme` / `layout` はグローバル initialize より優先。グローバル見た目は **VS Code kind → Mermaid redux 系マップ**（`light`→`redux`、`dark`/`highContrast`→`redux-dark`）とし、classic `default`/`dark` マップおよび島ライト強制・全 kind `theme: 'default'` は **撤回**する（`mermaid-redux-elk-fidelity` / `fix-mermaid-edge-styles`）。**表示密度**はグローバル `themeVariables.fontSize: '10px'`（固定 px）で図テキスト／ノードをコンパクトにする（旧 `'8px'`／`'13px'` を置換 — `mermaid-readable-viewport` / 継承 `mermaid-display-density`）。`themeVariables` に `var(--vscode-...)` は置かない。**密度の主手段は `themeVariables.fontSize`** であり、CSS `transform: scale(...)` / `zoom` を密度の代替にしない。一方、**閲覧用ビューポート変換**（初期 fit・ズームイン／アウト・パン／スクロール）は密度契約とは別であり、Editor Preview / Rich Editor の Mermaid NodeView で提供する（Default Preview への UI 埋め込み・別 Webview 化はしない）。図タイトル全文がクリップされないこと（表示層の viewBox / overflow / 余白調整。Document / serialize 非干渉）。per-diagram frontmatter / `%%{init}%%` による上書きは従来どおり可。CSP が SVG 内インライン `<style>` を無効化する前提で、Mermaid `render` 結果の presentation `<style>` を抽出し **Host 発行と同一 nonce** を付与して Webview に再注入する（セレクタは `.mermaid-preview` / 当該図スコープ）。静的 Host CSS エッジフォールバックは再注入が効く前提で **縮小または撤廃**する。`style-src` に `'unsafe-inline'` は追加しない（§9）。`@mermaid-js/layout-elk` を登録し、図が `layout: elk`（等）を要求したときのみ ELK を用いる（グローバル強制なし・遅延ロード）。HIP sanitize・`securityLevel: 'strict'`・DOMPurify・**`HTML_INTEGRATION_POINTS: { foreignobject: true }`** は不変（§9）。Mermaid Chart 拡張依存・ピクセル完全一致は Out。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `mermaidSource` | `string` | はい | 0 文字 | — | フェンス内**全文**（YAML frontmatter / `%%{init:...}%%` 含む。Webview は strip しない — AD-003）。`config.layout: elk` 等はネイティブ委譲 |
| `debounceMs` | 数値 | いいえ | — | — | 目安 300 ms。テーマ切替再描画・ビューポート re-fit トリガにも適用 |
| `editorMode` | `"preview" \| "markdown" \| "raw"` | はい | — | — | Preview / Markdown ともソース表示。Preview は RO（§1）。ビューポート UX は `preview` / `markdown` の Mermaid NodeView のみ |
| `themeUpdated` | postMessage | 任意 | — | — | §1 `{ kind: 'light' \| 'dark' \| 'highContrast' }` |
| `themeVariables.fontSize` | `string`（固定 px） | はい（グローバル既定） | — | — | プロジェクト既定 **`'10px'`**（表示密度。旧 `'8px'`／`'13px'` を置換）。`var(--vscode-...)` 禁止。per-diagram frontmatter / `%%{init}%%` で上書き可 |
| ビューポート操作 | UI（ローカル DOM） | 描画成功時 | — | — | Zoom in / Zoom out / Fit（キーボード到達可・`aria-label`）。パン／ドラッグ・縦横スクロール。セッション永続なし（MVP） |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | ブロック内に SVG/図表示＋ソース表示＋ビューポート（Preview / Markdown） | ソースは Document に保持。Preview / Markdown とも `.mermaid-source` を DOM 上表示（図の下）。presentation CSS は Host 同一 nonce 再注入後に効く。グローバル密度は `fontSize: '10px'`（図単位上書きがなければ）。タイトル全文可視。初期は枠内 fit |
| 構文エラー | ブロック内にエラーメッセージ | ソースは Document に保持。**Preview でもソースは表示したまま**、preview 領域に `.mermaid-error`。ビューポート UI は隠すか無効化。Output に記録（AD-015） |
| ELK 登録・ロード失敗 | 当該図のみエラー表示 | Webview 全体は止めない（既存 try-catch 隔離）。Output に記録可 |
| レンダリングタイムアウト | エラー表示 | RK-004 |

### Preconditions

- Webview 内で Mermaid レンダラがロード済みであること
- `layout: elk`（等）を要求する図を描画する前に、`@mermaid-js/layout-elk` のローダ登録が完了していること（遅延ロード可）

### Behavior

#### 正常系

1. Mermaid コードブロック内のテキスト変更を debounce（目安 300 ms）後に再描画する
2. 保存内容は ```mermaid フェンスとして .md に残る
3. RO 中も描画は更新される（ソース変更は不可）
4. **ソース併記レイアウト**（`mermaid-snap-style-with-source`）: 既存 Mermaid NodeView DOM を維持し、ブロック内順は **図（`.mermaid-preview`）→ ソース（`.mermaid-source`）**。`body[data-mode='preview'] .mermaid-source { display: none }`（または同等の Preview 専用非表示ルール）は **撤廃**する。構文エラーは `.mermaid-error` に `--vscode-errorForeground` / `--vscode-inputValidation-errorBackground` で表示（`preview-mode-quality` AD-007）。`securityLevel: 'strict'`・DOMPurify SVG サニタイズは不変（下記 10 および §9）
5. **モード別編集可否**: **Preview** — 図＋ソースを表示するが厳密 RO（ソース領域は編集イベントを Document へ送らない）。**Markdown** — 図＋ソース表示、ソース編集可（ファイル RO 時は不可 — §4）。**Raw** — フェンスはテキストとして編集（NodeView 島は Markdown / Preview 面の契約）
6. **フェンス全文レンダリング**（`preview-mode-quality` AD-003 / `mermaid-redux-elk-fidelity` AD-013）: `mermaid.render(id, source)` にはフェンス内 **全文**を渡す。YAML frontmatter および `%%{init:...}%%` による per-diagram 設定（`theme`・`layout` 含む）は Mermaid ネイティブに委譲し、Webview 側で frontmatter を strip しない。per-diagram 設定はグローバル `mermaid.initialize` より優先（Mermaid v11 仕様）
7. **グローバルテーマ（redux kind マップ）**（`mermaid-redux-elk-fidelity` / `mermaid-theme-crash-fix` 継承）: `buildMermaidThemeConfig`（または同等）は VS Code kind を次のとおりマップする — `light` → Mermaid `theme: 'redux'`、`dark` / `highContrast` → Mermaid `theme: 'redux-dark'`（同等の redux 系が必要なら同系に限る）。いずれも `securityLevel: 'strict'`。classic `default`/`dark` マップおよび全 kind 強制 `theme: 'default'` は廃止。`themeVariables` への `var(--vscode-...)` 指定は再導入しない（`mermaid-theme-crash-fix`）。`highContrast` 専用パレット・Chart テーマピッカーは本タスク Out。

7a. **表示密度（グローバル `fontSize`）**（`mermaid-readable-viewport` / 継承 `mermaid-display-density`）: グローバル `mermaid.initialize` / `buildMermaidThemeConfig`（または同等）の `themeVariables` に **`fontSize: '10px'`** を含める（旧 `'8px'`／`'13px'` を置換。図テキストおよびノード寸法に効く固定 px）。**密度の主手段は `themeVariables.fontSize`（および Mermaid がそれに追随するノード寸法）**であり、`.mermaid-preview` 等への CSS `transform: scale(...)` / `zoom` による見た目縮小を **密度の代替にしてはならない**。閲覧用のビューポート変換（下記 7b / 7c）は本項とは別契約であり、ズーム後に 10px 描画の文字・ノードを拡大して読めることを目的とする。`themeVariables` に `var(--vscode-...)` は置かない（上記 7 と同一禁止）。per-diagram YAML frontmatter / `%%{init}%%` による `themeVariables` / `fontSize` 上書きは Mermaid ネイティブ優先のまま許容（上記 6）。redux kind マップ・nonce 再注入・ELK オプトイン・strict / HIP は不変。

7b. **タイトル全文可視**（`mermaid-readable-viewport` AD-003）: 表示層で viewBox / overflow / 余白（padding）等を調整し、図タイトル（Mermaid が描画するタイトル文字列）が枠外クリップや欠落なく **全文可視**であること。タイトルが図コンテンツ左端より左にはみ出している場合は、表示層でタイトル位置を右へ揃え（title left ≥ diagram content left）、ズーム時の先頭文字欠けを防ぐ。Document / serialize / `docJson` / `markdownText` は変更しない。

7c. **ビューポート UX（fit／ズーム／パン／スクロール）**（`mermaid-readable-viewport` AD-002 / AD-004–AD-007 / AD-010 / AD-011）: 適用範囲は **Editor Preview（`preview`）および Edit Rich Editor（`markdown`）内の Mermaid NodeView のみ**。Default Preview（`native-preview`）への UI 埋め込み・別 Webview 化はしない。描画成功後、当該図のビューポートは **全体が枠内に収まる**（contain / fit-to-viewport）。大きな図でも初期は全体把握を優先し、細部はズームで読む（Priority: 可読性 > フィットのみで完結）。虫眼鏡または同等 UI で **ズームイン／アウト**を提供する。ユーザー操作による拡大縮小は **CSS transform（または同等のビューポート変換）**でよい（密度契約 7a とは別）。枠内 **ドラッグ（またはクリック操作）によるパン**と、必要時の **縦横スクロールバー**を提供する。図ソース変更・再 render（debounce 後）およびテーマ切替一括再描画では当該ブロックのビューポートを **再 fit** する。ビューポート状態のセッション永続・設定保存は不要（MVP）。実装方針の既定は **ネイティブ CSS（overflow + transform）＋軽量自前ハンドラ**（重い pan-zoom ライブラリは初期採用しない）。ズーム操作は **キーボード到達可能なコントロール**とし、`aria-label`（例: Zoom in / Zoom out / Fit）を付ける。コントラストは `--vscode-*` に合わせる。ピンチ必須・高度なスクリーンリーダー図読解は Out。ズーム／パンは **閲覧操作のみ**であり Document 編集イベントを送らない（Preview 厳密 RO 維持）。ズーム UI は Webview 内ローカル DOM／既存 NodeView スコープに閉じ、信頼できない CSS／HTML の新規素通し経路を作らない（AD-008 セキュリティ不変）。

8. **初期化・テーマ切替・ELK 登録の隔離**（`mermaid-theme-crash-fix` / `mermaid-redux-elk-fidelity` AD-012）: `mermaid.initialize`、テーマ更新、および ELK ローダ登録処理は `try-catch` で隔離し、Mermaid / layout-elk 内部エラーが Webview 全体のメッセージングや描画を停止させないようにする。

9. **テーマ切替再描画**（`preview-mode-quality` AD-005 / `mermaid-redux-elk-fidelity`）: §1 `themeUpdated` 受信時、Webview は redux kind マップに従い `mermaid.initialize(...)` を更新し、表示中の全 Mermaid NodeView を debounce 後に再 render する。再 render 後は当該ブロックのビューポートを **再 fit** する（上記 7c）。本処理も上記「隔離」に従う。

10. **Mermaid SVG sanitize**（`fix-mermaid-dark-visibility` / `mermaid-contrast-readable` P0）: NodeView の `.mermaid-preview` へ注入する前に DOMPurify でサニタイズする。**`foreignObject` シェルだけでなく、その内部のラベル用 HTML（例: `div` / `span` / テキスト）を保持する**。そのため DOMPurify に **`HTML_INTEGRATION_POINTS: { foreignobject: true }`**（または同等）を必須とする。`ADD_TAGS: ['foreignObject']` のみでは子 HTML が除去され空シェルになり得るため不十分。可読性に必要な style / presentation は XSS 面を広げない範囲で最小限許可してよい（AD-002）。`<script>` / `on*` 等の危険要素は除去し続ける（§9）。`securityLevel: 'strict'` は不変。

11. **CSP 下 presentation CSS（nonce 再注入優先）**（`mermaid-redux-elk-fidelity` AD-002 / AD-003）: Mermaid が SVG 内に埋め込む presentation CSS は Custom Editor Webview の CSP（`style-src` に `'unsafe-inline'` なし）により無効化され得る。**優先手段:** Mermaid `render` 結果に含まれる presentation `<style>` を抽出し、**Host が発行する同一 nonce** を付与して Webview に再注入する（セレクタは `.mermaid-preview` / 当該図スコープに閉じる）。ユーザー入力や Mermaid ソース由来の任意 CSS 文字列を素通ししない。DOMPurify / 既存サニタイズ契約と衝突する場合は **style 本文の危険構文を落としたうえで** nonce 付き再注入を優先し、不足分のみ最小フォールバックで補う。`fix-mermaid-edge-styles` 由来の静的 Host CSS（`stroke: var(--vscode-foreground)` 等）は再注入が効く前提で **縮小または撤廃**する。残す場合は「本物 CSS 欠落時の安全網」に限定し、redux 配色を上書きして見た目を壊さないこと。**島ライト強制 CSS は撤廃**済み。`#editor` や広い Preview 面の背景は変更しない。`style-src` への `'unsafe-inline'` 追加および CSP の意図的緩和は行わない（§9）。

12. **ELK レイアウト（登録・オプトイン・遅延ロード）**（`mermaid-redux-elk-fidelity` AD-005–AD-007）: オープンな `@mermaid-js/layout-elk` を依存追加し、Webview 起動時または初回 ELK 要求時に `mermaid.registerLayoutLoaders(...)` する。パッケージ（および ELK 本体）は **動的 import / コード分割**し、初期 Webview バンドルを不用意に肥大化させない。グローバル `mermaid.initialize` で全図に `layout: 'elk'` を **強制しない**。既定レイアウトは Mermaid オープン既定（dagre 系）のままとし、図が frontmatter / `%%{init}%%` 等で `layout: elk`（および互換の flowchart ELK 指定）を要求したときのみ ELK を用いる。登録・ロード失敗時は当該図単位のエラー表示＋既存 try-catch 隔離（Webview 全体は止めない）。未対応 diagram kind は既存レイアウトのまま（ELK 全 kind 同等品質は非保証）。

13. **表示層限定・受け入れ**（`mermaid-redux-elk-fidelity` AD-009 / AD-011 / `mermaid-readable-viewport`）: 変更は Mermaid 表示層（Webview / `media` バンドル / NodeView / テーマ・レイアウトヘルパー / Host `getHtml` nonce 経路 / ビューポート UI）に限定し、`docJson` / `markdownText` / serialize / dirty / Host 画像 rewrite / Marp / 三点モード同期に触れない。**受け入れ条件:** (a) kind→`redux`/`redux-dark` マップ、(b) nonce 再注入（または同等）で presentation が CSP 下で効き、flowchart エッジが黒塗りブロブにならず stroke が可視、(c) `layout: elk` 指定図で ELK ローダ登録後に描画成功、(d) グローバル強制 ELK なし、(e) HIP / `securityLevel: 'strict'` / ソース併記 / Preview RO / `'unsafe-inline'` なし回帰、(f) グローバル `themeVariables.fontSize` が **`'10px'`**（`var(--vscode-...)` なし・CSS scale を密度の主手段にしない）、(g) タイトル全文可視、(h) 初期 fit、(i) ズームイン後に 10px 図が読める、(j) パン／スクロールで枠外細部に到達、(k) 再 render 時 re-fit、(l) ズーム UI のキーボード到達と `aria-label`、(m) Default Preview 非対象。構文エラーは既存 `.mermaid-error` 契約を維持。Chart 拡張依存・Chart 専用アイコンパック一式・ピクセル完全一致は Out。

#### 例外系

1. 悪意ある入力はサニタイズし、スクリプト実行を行わない（RK-003）
2. Mermaid / `@mermaid-js/layout-elk` パッケージ更新による見た目変化・SVG クラス名・API 変更は許容（RK-007 — lockfile 固定推奨）。sanitize allowlist が再び不足し得る（`mermaid-contrast-readable` RK-005 / `fix-mermaid-edge-styles` RK-003 / `mermaid-redux-elk-fidelity` RK-005）。タイトル・ラベル欠落が再発し得る（`mermaid-readable-viewport` RK-006 — HIP / nonce 回帰維持）
3. frontmatter 内 `config.theme` / `config.layout` / `themeVariables`（`fontSize` 含む）がグローバル kind マップ・既定レイアウト・既定密度と異なる場合、当該図のみ意図的に別配色・別レイアウト・別密度となる（Mermaid 仕様 — `preview-mode-quality` RK-004 / `mermaid-redux-elk-fidelity` AD-013 / `mermaid-readable-viewport`）。ダーク面＋明示 `theme: default` 等のコントラスト差はユーザー意図として許容
4. 文書内 Mermaid ブロックが多数ある場合、テーマ切替の一括再描画で短時間 CPU 負荷が上がり得る（debounce + 表示中 NodeView のみ — RK-004 系 / `preview-mode-quality` RK-002）。巨大 SVG＋高ズームで Webview CPU／メモリ負荷が上がり得る（`mermaid-readable-viewport` RK-003 — 図単位状態に閉じる）
5. Mermaid テーマ／レイアウト／表示密度／ビューポートのマッピングは VS Code ネイティブ Markdown Preview・Mermaid Snap・Mermaid Chart とのピクセル一致を保証しない（`preview-mode-quality` RK-001 / `mermaid-snap-style-with-source` RK-002 / `mermaid-redux-elk-fidelity` / `mermaid-readable-viewport`）
6. sanitize でラベル HTML / presentation が欠落していれば黒塗り・不可読は残り得る（`mermaid-contrast-readable` RK-001 — P0 HIP 必須）。再注入と DOMPurify の相互作用で一部 presentation が落ちる／二重定義で競合し得る — 実装時に sanitize 前後を確認し、静的 Host CSS 安全網の要否を決める（`mermaid-redux-elk-fidelity` RK-002）。不足時は最小の属性／タグ許可を security レビュー付きで検討
7. Preview でソース表示により長いフェンスが画面を占有し得る（表示層のみ・許容 — `mermaid-snap-style-with-source` RK-004）
8. flowchart 以外（sequence / class 等）で CSP 由来の描画崩れや ELK 非対応が残る可能性。必須受け入れは flowchart 等 ELK 対応 kind での `layout: elk` 成功および presentation 再注入後のエッジ可視；他 kind は発見次第拡張（`fix-mermaid-edge-styles` RK-004 / `mermaid-redux-elk-fidelity` RK-004）
9. redux / redux-dark でも VS Code 面とのコントラスト不足が残る可能性。受け入れは「識別できる」— Chart／Snap ピクセル一致は非保証（`mermaid-redux-elk-fidelity` RK-003）
10. `@mermaid-js/layout-elk` / elkjs はバンドル肥大し得る。遅延ロードしても初回 ELK 図や VSIX 実サイズが増える（`mermaid-redux-elk-fidelity` RK-001）。グローバル強制 ELK は行わないため、何も書かない図は dagre 系既定のまま（RK-006 — README / 仕様で `layout: elk` を明示）
11. 未ズーム時の 10px は極端に小さく見え得る。初期 fit＋ズーム必須 UX を仕様・README で明示しないと「読めない」誤認が起き得る（`mermaid-readable-viewport` RK-001）
12. fit とズーム transform の組み合わせでタイトル余白／viewBox 修正が再発し得る。受け入れでタイトル＋ズーム両方を見る（`mermaid-readable-viewport` RK-002）
13. Preview RO 面でドラッグパンがテキスト選択／スクロールと競合し得る。パン開始条件（例: 中ボタン／修飾キー／専用ハンドル）は実装時に確定する（`mermaid-readable-viewport` RK-004 — ⚠️ Spec Gaps）

### Non-Goals

- Mermaid ビジュアルダイアグラムエディタ（backlog）および図ソースの WYSIWYG 図形編集
- オフライン以外での外部レンダリング API 呼び出し
- VS Code ネイティブ Markdown Preview / Mermaid Snap / Mermaid Chart との配色・レイアウト **ピクセル完全一致**
- Mermaid Snap / 標準 Preview / Mermaid Chart の**ソースコード・API・アセット取り込み**および Chart 拡張依存・フォークパッケージ（観察のみ可 — オープンな `mermaid` + `@mermaid-js/layout-elk` に限定）
- Chart 専用アイコンパック一式・Chart ライブエディタ既定 ELK 寄せのグローバル強制・専用テーマピッカー UI
- **Default Preview（`native-preview`）への Mermaid ビューポート UI 埋め込み・別 Webview 化**
- グローバル `mermaid.initialize` による全図 `layout: 'elk'` 強制（オプトインのみ — §5 正常系 12）
- CSS `transform: scale(...)` / `zoom` 等を **表示密度の主手段**とすること（主手段は `themeVariables.fontSize: '10px'` — §5 正常系 7a）。※閲覧用ビューポート変換（7c）は本 Non-Goal の対象外
- CSP `style-src` への `'unsafe-inline'` 追加および CSP の意図的緩和（§9）
- 独自パレットの全面設計・`highContrast` 専用パレット（Out）
- `#editor` 等の広い面の背景色変更
- 三点モード / Marp / 画像 URI / serialize / dirty 契約の変更
- ユーザー向け密度スライダー／設定 UI（本タスク Out — 固定 `'10px'` のみ）
- ビューポート状態のセッション永続・設定保存（MVP Out）
- ピンチ必須・高度なスクリーンリーダー図読解

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-031–037。**TC-130–132（Preview Mermaid）はソース併記へ更新予定**（旧「Preview ソース非表示」撤回 — `mermaid-snap-style-with-source` / `preview-rich-embed`）。frontmatter 描画・テーマ切替再描画（TC-013 拡張）・Preview コントラスト: 後続 TC（`preview-mode-quality`）。Mermaid SVG `foreignObject` シェル保持: TC-152（`fix-mermaid-dark-visibility` — 回帰維持）。表示層が Document を変えない回帰: TC-082 等
- [doc/testspec-mermaid-contrast-readable.md](testspec-mermaid-contrast-readable.md) — HIP 付き sanitize 回帰維持。**Expected は `mermaid-redux-elk-fidelity` で更新要**（kind→`redux`/`redux-dark`、nonce presentation 再注入、静的 Host CSS 縮小）
- [doc/testspec-mermaid-snap-style-with-source.md](testspec-mermaid-snap-style-with-source.md) — ソース併記・Preview RO・HIP / strict 回帰維持。**テーマ／CSS 前提 TC は `mermaid-redux-elk-fidelity` で更新要**。**回帰必須:** CSP＋sanitize＋nonce 再注入後も flowchart エッジが黒塗りにならず stroke が可視；`'unsafe-inline'` なし
- [doc/testspec-mermaid-redux-elk-fidelity.md](testspec-mermaid-redux-elk-fidelity.md) — kind→redux マップ、nonce 再注入、`layout: elk`、グローバル強制 ELK なし、HIP / strict / ソース併記 / Preview RO / `'unsafe-inline'` なし回帰。**表示密度 Expected:** グローバル `themeVariables.fontSize: '10px'`（旧 `'8px'` / `'13px'` 置換 — `mermaid-readable-viewport`）に更新要
- **後続 testspec（`mermaid-readable-viewport`）:** `doc/testspec-mermaid-readable-viewport.md`（未作成・`spec-test-design`）。必須契約例: `fontSize: '10px'`、タイトル全文可視、初期 fit、ズームイン／アウト、パン／スクロール、再 render 時 re-fit、`aria-label`、Default Preview 非対象、密度に CSS scale を使わない、redux / nonce / ELK / strict / HIP / ソース併記回帰

### Spec Gaps

- ⚠️ パン開始条件（中ボタン／修飾キー／専用ハンドル等）の具体ジェスチャは実装時確定（RK-004）。契約上は「枠内パン／ドラッグが可能」まで
- それ以外（`fontSize: '10px'`・タイトル可視・fit／ズーム／パン／スクロール・re-fit・a11y・Default Preview 非対象・密度≠ビューポート変換）は Requirements Brief `mermaid-readable-viewport` AD-001–AD-013 で確定

---

## §6 Marp プレビュー

### 概要

Marp 形式スライドのプレビューを提供する（UD-003, AD-008）。**二系統**で共存する:

1. **Marp Preview パネル** — サイドまたはパネル（`showMarpPreview` コマンド / `MarpPreviewManager`）。従来どおり独立 UI
2. **Preview モード内 Marp 描画** — §1 に従い、三点 **Preview** かつ `isMarpDocument(markdownText)` 時に同一 Custom Editor Webview の `#preview-marp-root` へ Host 生成 HTML を RO 注入

編集は Markdown / Raw 側のみ。Marp 描画パイプライン（`isMarpDocument` → `marp.render` → `sanitizeHtml` / `sanitizeCss`）は **Host 側で共用**し、Webview 内で Marp JS を実行しない。

**用語の区別（必須）:**

| 名称 | 節 | 意味 |
|------|-----|------|
| **三点 Preview** | §1 | Custom Editor 内の読み取り専用モード。非 Marp は TipTap RO、**Marp 検出時は `#preview-marp-root` にスライド RO 表示** |
| **Marp Preview パネル** | §6（本節） | Marp スライド用のサイド/パネル表示。**三点 Preview とは別 UI インスタンス**。自動更新・手動オープンは従来どおり |

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `documentContent` | `string` | はい | — | — | front matter + 本文（Document 正本 `markdownText`）。TipTap `docJson` は Marp 描画に使わない |
| `previewTrigger` | コマンド / 自動 / Preview 切入 | はい | — | — | ドキュメント変更・Preview モード切入で更新 |
| `isMarpDocument` | `(markdown: string) => boolean` | はい | — | — | 共有ユーティリティ。`src/commands/marp-preview.ts` から export または `src/utils/` へ移行 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功（パネル） | スライド HTML プレビュー | テーマは front matter から |
| 成功（Preview 内） | `previewMarpHtml` で `#preview-marp-root` 更新 | §1 postMessage |
| パース失敗 | プレビュー内エラー表示 | Output に記録。Document は変更しない |
| 非 Marp 文書（パネル） | プレビュー内に「No Marp slides detected」ガイダンス表示 | Marp front matter / スライド区切り未検出時 |
| 非 Marp 文書（Preview 内） | §1 非 Marp 分岐 — TipTap RO へフォールバック | Marp コンテナ非表示 |

### Preconditions

- Marp 用 Webview / Panel が利用可能であること（Custom Editor 三点 Preview とは別インスタンスでも可）
- Custom Editor Preview 用 Webview は Host 生成 HTML のみ受け取る（`enableScripts: false` 相当の信頼境界 — Marp パネルと同等）

### Behavior

#### 正常系

1. YAML front matter をパースし Marp テーマを適用する
2. 本文変更（Document 更新）に追随して **パネル** プレビューを更新する（`MarpPreviewManager` 自動更新継続）
3. **Preview モード**かつ Marp 検出時: 同一 `markdownText` から Host で再描画し `previewMarpHtml` を送信。スライド UX は **縦スクロール一覧**（ページ送り UI なし）
4. ファイル RO / 三点いずれのモードでも Marp Preview **パネル**は表示できる
5. 三点 Preview と Marp Preview **パネル**は **共存**する。Preview 切入でパネルを自動オープンしない
6. Marp 出力 HTML 内の `<img src>` は Host が §9 と同規則で `asWebviewUri` rewrite する
7. **`isMarpDocument()`** は Preview 切入時と `markdownText` 更新の両方で再評価する

#### 例外系

1. レンダリング失敗時も `.md` ソース / Document は変更しない
2. Marp スライドが検出されない文書では、**パネル**に **「No Marp slides detected」** とガイダンスを表示する
3. **`isMarpDocument()` 偽陽性**（YAML front matter + 本文 `---` 等）で非 Marp 文書が Preview 時に Marp 描画になるリスクあり（RK-013 — 既存検出ロール維持）

### Non-Goals

- Marp WYSIWYG 編集（backlog）
- スライド PDF / 画像エクスポート
- Preview 内 Marp のページ送り UI
- §6 Marp Preview パネルの廃止（Intent Out — パネル存続）
- Rich Editor（Markdown モード）での Marp スライド WYSIWYG 表示

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-038–042（パネル共存）、TC-124–142（Preview 内 Marp 分岐・`isMarpDocument` 共用・TC-077 更新）

### Spec Gaps

- なし（Preview 内 Marp 兼用・パネル共存・共用パイプラインは Requirements Brief `preview-rich-embed` AD-003–006 で確定）

---

## §7 画像貼付

### 概要

クリップボードから画像を貼り付け、`.md` と同階層の `img/` に保存し、相対パス参照を挿入する（AD-009, UD-007）。**表示時**の画像 URI 解決は Extension Host が行い、Webview には `asWebviewUri` 済み URL のみ渡す（§9）。serialize / ディスク出力は **常に相対パス**を維持する（`preview-rich-embed`）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `clipboardImage` | `image/*` バイナリ | はい | 1 バイト | 実用上限未定（backlog） | jpg/png/gif/svg |
| `sequenceNumber` | 整数 | 自動 | 1 | 9999 | `image-NNNN` ゼロ埋め 4 桁 |
| `targetMdUri` | `vscode.Uri` | はい | — | — | 同階層 `img/` 基準 |
| `imageSrc` | `string` | 任意 | — | — | Document / `docJson` 内の相対パス（例: `img/image-0001.png`）。表示投影時に Host が rewrite |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功（paste） | `img/image-NNNN.ext` 保存 + Markdown 画像参照挿入 | 上書きなし（UD-007）。Document 正本は相対パス |
| 成功（表示投影） | TipTap `image.src` / Marp HTML `<img src>` が webview URI | Host rewrite。Document / serialize は相対パスのまま |
| URI 解決不可 | broken image 表示 + Output debug ログ | ユーザー通知なし。`img/` 外・ワークスペース外・非 `https:` 絶対パスは rewrite しない |
| 未保存新規 doc | paste 拒否、「Save document first」通知 | URI 未確定 |
| RO 中 | 操作拒否 | §4（全編集面ロック） |
| FS 書込失敗 | 通知、挿入なし | 権限・ディスク容量 |
| 非画像 paste | 無視（通常 paste へ委譲） | — |

### Preconditions

- 編集モードであること
- 対象 `.md` がディスク上の保存済みパスを持つこと（未保存新規 Untitled doc への paste は拒否）
- `img/` が無ければ作成する

### Behavior

#### 正常系

1. paste イベントで clipboard の image/* を検出する
2. 既存 `img/image-*.ext` の最大連番 + 1 でファイル名を採番する（欠番があっても重複しない）
3. 拡張子は MIME から決定（jpg/png/gif/svg）
4. Markdown に `img/image-NNNN.ext` 形式の相対パスを挿入する
5. URI は `vscode.Uri` で正規化しパストラバーサルを防ぐ
6. **表示投影時（Host）:** `.md` のディレクトリ基準で実ファイル URI を組み立て、`isSafeImagePath`（`..` 禁止・**`img/` プレフィックス必須**）を通過した場合のみ `webview.asWebviewUri` して TipTap `docJson` 内 `image.src` および Marp 出力 HTML 内 `<img src>` を書き換える
7. **`docUpdated` / Preview 投影 / Marp 再描画**の各タイミングで画像 URI を再解決する
8. **Markdown モード（Rich Editor）** も Host rewrite 済み `docJson` を投影する。paste 直後は Host が webview URI を返すか、相対パス挿入後に次投影で rewrite
9. **`https:` / `data:`** 画像は Webview が直接解決（CSP 既存どおり — 挙動変更なし）

#### 例外系

1. 未保存新規 `.md`（`untitled:` scheme 等）への paste は拒否し、**「Save document first」** を通知する
2. ファイル移動時のパス自動更新は行わない（UD-007）
3. 参照されなくなった画像（孤児）は削除しない（RK-005 — backlog）

### Non-Goals

- 画像のリサイズ・圧縮の自動最適化
- 外部 URL への自動アップロード
- 孤児画像の自動削除（backlog）
- **`img/` 外**の手書き相対パス（例: `./assets/logo.png`）の Host URI 解決（RK-014）
- Webview 内での file パス解決（Host 経由のみ）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-043–051、TC-124–129（画像 URI Host rewrite・serialize 相対パス・TC-060 系 regression）

---

## §8 シリアライズ・保存

### 概要

内部モデル（`MarkdownDocument`）とディスク `.md` の双方向変換。決定的出力で Git diff 可読性を確保する（AD-004, AD-013）。Raw モードからの反映も同一正本・同一保存経路を用いる（§1）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `internalDoc` | ドキュメントモデル | はい | — | — | §1–§7 の統合正本（`MarkdownDocument`） |
| `rawSourceEdit` | `string` | 任意 | — | — | Raw モードからのソース。パース成功時のみ Document へ反映 |
| `stringifyOptions` | 設定オブジェクト | はい | — | — | 行長・インデント・空行規則を固定 |
| `isRawParseFailed` | `boolean` | 自動 | — | — | true の間は save 拒否 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | 決定的な UTF-8 Markdown 文字列、ディスク更新、`dirty` 解除 | round-trip 可能が望ましい |
| 変換失敗（stringify） | エラー、保存中断、`dirty` 維持 | Output に概要（全文は出さない） |
| Raw パース失敗中 | **save ブロック**、Document 未更新 | §1 例外系 2。通知 + Output |

### Preconditions

- normalize パスは保存前の単一経路に集約されること（AD-013）
- `isRawParseFailed === false` であること（失敗中は save 不可）

### Behavior

#### 正常系

1. オープン時: `.md` → parse → `MarkdownDocument`
2. Markdown モード編集: TipTap モデル → Document 更新 →（必要時）Raw 面へ投影
3. Raw モード編集: ソース文字列 → パース成功時のみ Document 更新 → Markdown / Preview 面へ投影
4. 保存時: Document → stringify（固定オプション）→ `.md`
5. HTML 表・許可 HTML は raw HTML ノードまたは同等手段で保持する
6. 同一内容に対し、連続保存で byte-identical 出力を目指す（アーキテクチャ AD-013）
7. **モード切替だけでは本節の保存処理を起動しない**（§1）。**Default Preview** はモード切替ではないが、Document が dirty のときは次項のゲートで本節の save 経路を経由する
8. **Default Preview dirty ゲート（§1 / §10）:** Document が dirty のときのみ Host が `showWarningMessage`（文言: `Document has unsaved changes. Save before opening the Markdown Preview?`。**Save** / **Cancel** 二択。「Don't Save で開く」は提供しない。文言に `to the side` を含めない）。Cancel またはダイアログ閉じはプレビュー非オープン。Save 選択時は既存 Custom Editor save（`MarkdownDocument` / provider）を待ち、**成功時のみ** `markdown.showPreview`（同一グループ補償 — §10）を実行する。save 失敗（本節の stringify 失敗・Raw パース失敗ブロック含む）時は ErrorMessage + Output（`MD WYSIWYG Editor`）、プレビュー非オープン。clean 時はダイアログなしで即開く。**`showPreviewToSide` へのフォールバックはしない**
9. **画像参照:** serialize / ディスク出力は **常に相対パス**（例: `img/image-0001.png`）。Host の `asWebviewUri` rewrite は表示投影のみで Document 正本を変更しない（§7 / §9）
10. **GFM 書式ノードの往復（§2 In）:** 次を parse ↔ stringify で保持する（micromark/mdast の strikethrough・task-list を **direct dependency** として追加。既存 `gfm-table` は維持）
   - 取り消し線: 入力 `~~` および HTML `<del>` / `<s>` → モデル `strike` → 出力 **常に** `~~text~~`（`<del>`/`<s>` は出さない）
   - 見出し h1–h6: 既存スキーマどおり往復
   - インラインコード: `` `code` `` mark ↔ 出力。フェンスコードブロックとは別経路
   - 引用: GFM `>`。ブロック子（heading, list, taskList, codeBlock, 入れ子 blockquote）を落とさない（paragraph-only フィルタは禁止）
   - タスクリスト: `- [ ]` / `- [x]`（出力のチェックは小文字 `x`）。入力 `[X]` は `[x]` に正規化。`1. [ ]` は unordered タスクリストへ正規化（番号非保持）
   - 水平線: mdast `thematicBreak` ↔ 出力 `---`（既存 `toMarkdown` `rule: '-'`）。前後空行は決定的整形に従う
11. **複合 mark:** strike+bold / strike+italic 等は意味を保持。ネスト順の入れ替わりは許容（見た目同等なら byte 一致は要求しない）
12. **非対象 GFM 拡張:** footnotes / GitHub Alerts / autolink-literal / tagfilter の新規有効化はしない（§2 Out）

#### 例外系

1. パース不能部分は raw 保持を優先し、失敗時はユーザーに通知する
2. Raw パース失敗時は Document を壊さず、失敗解消まで save を拒否する（§1）。Default Preview の Save ゲートも同一契約を尊重する

### Non-Goals

- 他エディタとの完全な Markdown 相互変換（RK-002）
- Raw 失敗中の「強制保存（Document 無視で Raw バッファをそのまま書く）」オプション（MVP 非採用）
- 複合 mark のネスト順の byte-identical 保証（§2 Behavior）
- Default Preview 時のサイレント自動保存、または Don't Save で未保存バッファのまま標準 Preview を開くこと

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-052–056、Raw パース失敗 TC、および GFM 書式往復追記 TC（`gfm-format-toolbar`）
- Default Preview dirty Save/Cancel ゲート: [doc/testspec-native-preview-side-and-default-raw.md](testspec-native-preview-side-and-default-raw.md)

---

## §9 セキュリティ

### 概要

信頼できない `.md` / HTML / Mermaid ソースに対する防御（AD-010, RK-003）。**画像 URI 解決**は Extension Host のみが行い、`img/` 配下に限定する（`preview-rich-embed`）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `untrustedHtml` | `string` | 任意 | — | — | 外部ファイル取込 |
| `webviewCsp` | CSP 文字列 | はい | — | — | `default-src 'none'` 基調 |
| `imageSrc` | `string` | 任意 | — | — | 相対パス。`isSafeImagePath` 検証後に Host が `asWebviewUri` |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | サニタイズ済み HTML / SVG 表示 | 許可タグリスト適用 |
| 成功（画像 URI） | webview URI へ rewrite 済み `src` | `img/` 配下のみ |
| 拒否 | 危険要素除去 | `<script>`, `on*` 属性等 |
| 画像 URI 拒否 | rewrite しない（broken image） | `img/` 外・`..` 含む・ワークスペース外 |

### Preconditions

- `localResourceRoots` は拡張 `media/` とワークスペース `img/` に限定（AD-010）。`getWorkspaceImgRoots` と整合。**緩和しない**
- Extension Host 上で HTML を実行しない
- Webview 内で相対 file パスを直接解決しない（Host rewrite 必須 — §7）

### Behavior

#### 正常系

1. Webview に厳格 CSP を設定する（nonce 付き script/style）。Custom Editor の `style-src` は `${webview.cspSource} 'nonce-${nonce}'` を維持し、**`'unsafe-inline'` を追加しない**。Mermaid presentation は Host 同一 nonce 付きの render 結果 `<style>` 再注入を優先し、静的 Host CSS は欠落時の最小安全網に限定する（§5 正常系 11 / `mermaid-redux-elk-fidelity`）。`img-src ${webview.cspSource} data: https: file:` は `getHtml` のまま維持。CSP / `localResourceRoots` / `on*` 除去の緩和は行わない
2. 表示前に HTML をサニタイズする（表・画像・基本書式・Mermaid SVG を許可）。**許可タグに `del` / `s` を含める**（§2 取り消し線の HTML 混在入力を落とさない）。下線・highlight（`mark`）は許可追加しない。`input` checkbox は既存許可のまま
3. **Mermaid SVG sanitize**（Webview NodeView）: Mermaid が出力した SVG を DOMPurify でサニタイズする際、**`HTML_INTEGRATION_POINTS: { foreignobject: true }`（または同等）により `foreignObject` シェルだけでなくラベル用 HTML 子を保持する**（§5 正常系 10 / `mermaid-contrast-readable` P0）。presentation `<style>` 再注入経路ではユーザー／ソース由来の任意 CSS を素通しせず、危険構文を落としたうえで Host 同一 nonce を付与する（§5 正常系 11）。`<script>` / イベントハンドラ属性等は除去し続ける。`securityLevel: 'strict'` は不変。allowlist / style 再注入の変更は XSS 面を広げない最小とし、実装後 security レビュー対象（AD-002 / `mermaid-redux-elk-fidelity` AD-008）
4. 画像保存先はワークスペース内 `img/` に限定する
5. **画像 URI rewrite（Host）:** `.md` のディレクトリ基準で実ファイル URI を組み立て、`isSafeImagePath(path)` — **`..` 禁止**、**`img/` プレフィックス必須** — を通過した場合のみ `webview.asWebviewUri` する。対象: TipTap `docJson` 内 `image.src`、Marp 出力 HTML 内 `<img src>`
6. **`https:` / `data:`** は CSP 上 Webview が直接解決（既存どおり — rewrite 不要）
7. Marp Preview **パネル**の CSP（`enableScripts: false`）は本タスクでは Preview 整合のため AD-001 rewrite で足りる限り **img-src 拡張しない**
8. **`img/` 内 SVG** は CSP + サニタイズ経路を通す（Mermaid SVG とは別経路 — RK-015）

#### 例外系

1. サニタイズによりレイアウトが変わる場合がある（許容 — RK-002 とトレードオフ）

### Non-Goals

- ネットワーク経由のリモートコンテンツ取得
- 秘密情報の収集・外部送信
- CSP や `localResourceRoots` の緩和
- 下線・highlight 用タグの許可追加
- **`img/` 外**相対パス・ワークスペース外ローカルファイルの URI 解決
- Webview 側での file URI 組み立て

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-057–061、TC-126–127（`isSafeImagePath` / `localResourceRoots` regression）、TC-152（Mermaid SVG `foreignObject` 保持 — 回帰）。HIP / ラベル HTML 残存・可読性: 後続 TC（`mermaid-contrast-readable`）

---

## §10 ログ・共存・配布

### 概要

障害可観測性と VS Code 標準 Markdown エディタとの共存（AD-014, AD-015）。

### Behavior

#### 正常系

1. Output チャンネル `MD WYSIWYG Editor` にシリアライズエラー・描画失敗を記録する（ファイル全文は含めない）
2. README に `workbench.editorAssociations` 設定例を記載し、本拡張を `.md` デフォルトにする手順を示す
3. `Reopen Editor With…` でビルトイン Markdown エディタへ切替可能とする（AD-014）
4. **Pattern A（IDE タイトルバー切替の検知）:** Custom Editor（`vsc-md-editor.wysiwyg`）が dispose された直後、同一 `.md` URI がアクティブタブに残り、かつ WYSIWYG Custom Editor ではない場合（`TabInputText` または `TabInputCustom` で viewType が `vsc-md-editor.wysiwyg` 以外）を「ビルトインへ切替」と判定する
   - 設定 `vsc-md-editor.autoRestoreOnBuiltinSwitch`（boolean、**既定 `false`**）が `true` のとき: `vscode.openWith` で WYSIWYG を自動再オープン
   - 既定 `false` のとき: 日本語 `InformationMessage` を表示し、エディタ内 **Default Preview / Editor Preview / Edit Rich Editor / Edit Raw Text** ツールバーの利用を案内。ボタン **「WYSIWYG Editor で開く」** で `vsc-md-editor.openWithWysiwyg` を実行
   - タブが閉じられた、または別ファイルがアクティブの場合は何もしない
   - **Default Preview 非干渉:** `markdown.showPreview`（および Host の同一グループ補償）による標準 Markdown Preview タブのオープンは Custom Editor を dispose せず、Pattern A の「ビルトイン Text への切替」と **誤判定してはならない**。必要なら Pattern A 判定から Markdown Preview タブ種別（`TabInputWebview` 等）を明示除外する。本コマンドは `openWith` / Reopen Editor With の代替ではない
5. コマンド `vsc-md-editor.openWithWysiwyg`: 引数 URI またはアクティブ `.md` に対し `vscode.openWith`（viewType `vsc-md-editor.wysiwyg`）を実行。ビルトイン Markdown エディタの editor/title に表示（`resourceExtname == .md` かつ Custom Editor 非アクティブ時）
6. **拡張更新後の手動リロード:** コマンド `vsc-md-editor.reloadExtension`。確認ダイアログ後に `workbench.action.reloadWindow` を実行する
   - **editor/title** に `$(refresh)` アイコン（`resourceExtname == .md` — WYSIWYG / ビルトインいずれの `.md` 表示中も表示）。Cursor Preview / Markdown 切替で Webview バーが消えてもリロード可能
   - Cursor 組み込み Preview / Markdown トグルの**内部**には挿入不可（API 非提供）。タイトルバー navigation グループの先頭（`navigation@0`）に配置
7. **標準 Markdown Preview を同一タブグループで開く:** 公開コマンド `vsc-md-editor.showNativeMarkdownPreview`（`package.json` command title: `Open VS Code Markdown Preview` または同等・Side 表現なし）
   - **互換エイリアス:** 旧 ID `vsc-md-editor.showNativeMarkdownPreviewToSide` は **同一ハンドラ**として残し、既存キーバインドを壊さない。正本は新 ID（contributes / activationEvents / テストは新 ID）
   - Host がアクティブな WYSIWYG Custom Editor の `TabInputCustom.uri` を解決する（Marp コマンドと同系。`activeTextEditor` 前提にしない）。既存 `resolvePreviewUri` / `openTextDocument` 前処理は維持
   - **一次オープン API:** `vscode.commands.executeCommand('markdown.showPreview', uri)`。**`markdown.showPreviewToSide` は成功パスから外し、失敗時フォールバックにも使わない**
   - **Host 同一グループ補償（必須）:** ビルトイン `markdown.showPreview` は `activeTextEditor?.viewColumn || ViewColumn.One` を使うため、WYSIWYG Custom Editor フォーカス時（`activeTextEditor === undefined`）に列 1 へ誤配置しうる。Host はオープン**前**に `tabGroups.activeTabGroup.viewColumn` とアクティブタブ index を記録し、オープン**後**に安定コマンド `moveActiveEditor`（`by: 'group'` 必須、続いて `by: 'tab'` は preferred）で同グループへ移す（公開 `TabGroups` に tab move API がないため。同等の安定 API でも可）。Custom Editor を `showTextDocument` で前面化して `activeTextEditor` を捏造する手法は **禁止**（Pattern A / dispose リスク）
   - **配置契約:** **必須**は「アクティブ WYSIWYG と同じ editor group に Preview が開く（Beside の新規グループを作らない）」。**推奨（best-effort）**は `moveActiveEditor`（`by: 'tab'`、1-based preferred ≈ `activeIndex + 2`）による「現在タブのすぐ右」。exact index が API / タイミングで不可でも同グループ内配置を成功とみなし、Beside へフォールバックしない（RK-018）
   - `moveActiveEditor`（`by: 'group'`）失敗時は同グループ必須を優先できずスキップをログする。`by: 'tab'` 失敗時は既に同グループ適用済みなら成功とみなしログする。Beside 復帰はしない（RK-019）
   - Webview **Default Preview** ボタンおよび Command Palette から実行可能（`package.json` contributes + activationEvents）
   - dirty / Save / Cancel / save 成功ゲートは §8 Behavior 正常系 8 に従う
   - **Marp 非干渉:** Default Preview オープンで §6 Marp Preview パネルを閉じない・自動オープンしない。三点 Preview（Editor Preview）内 Marp 分岐は変更しない。Marp 文書を標準 Preview で開いてもスライド UI にはならない
   - 標準 Preview は **保存済みディスク内容**（または VS Code が URI 経由で読む内容）を表示する。未保存バッファのライブ同期は Non-Goal（§1）
   - `markdown.showPreview` 欠如・失敗時は ErrorMessage + Output で明示する（Beside サイレントフォールバック禁止）

#### 設定

| キー | 型 | 既定 | 説明 |
|------|-----|------|------|
| `vsc-md-editor.autoRestoreOnBuiltinSwitch` | `boolean` | `false` | Pattern A 検知時に WYSIWYG を自動再オープン。`false` では AD-014 の意図的なビルトイン切替（Reopen Editor With… 等）を妨げない |

### Non-Goals

- IDE タイトルバーの Preview / Markdown トグル自体の非表示・上書き（VS Code / Cursor API 非提供）
- Marketplace 公開手順の詳細（`vscode-extension-publish` スキル / deployment.md で扱う）
- Default Preview 用 editor/title アイコンの追加（本タスク）
- 標準 Preview の Custom Editor Webview 埋め込み、および 4 つ目の `editorMode`（§1 Non-Goals）
- Default Preview 失敗時の `markdown.showPreviewToSide` フォールバック（§1 Non-Goals）
- 隣接タブ index の厳密保証（best-effort のみ — §10 正常系 7）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-062–064, TC-083–085
- Default Preview コマンド・同一グループ補償・Pattern A 非干渉・Marp 非干渉: [doc/testspec-native-preview-side-and-default-raw.md](testspec-native-preview-side-and-default-raw.md)

---

## 共通 Non-Goals（MVP）

| 項目 | 参照 |
|------|------|
| Marp WYSIWYG 編集 | Intent Out / [backlog](backlog-vsc-md-wysiwyg.md) |
| Mermaid ビジュアルエディタ | 同上 |
| ワークスペース全体 Readonly | UD-005 Phase 2 / backlog |
| 画像パス自動更新（ファイル移動時） | UD-007 |
| 孤児画像の自動削除 | RK-005 / backlog |
| 大ファイル仮想スクロール | RK-004 / backlog |
| UI i18n（英語以外） | backlog |
| Markdown LSP 完全連携 | RK-008 / backlog |
| Preview / Markdown / Raw の同時分割表示 | §1 Non-Goals |
| モード別の別 viewType / 別 Custom Editor | §1 Non-Goals / AD-016 |
| **4 つ目の `editorMode` / Default Preview の mode 化** | §1 / §10 Non-Goals（`native-preview-side-and-default-raw`） |
| Default Preview の `showPreviewToSide` フォールバック / Beside 新規グループ | §1 / §10 Non-Goals（`default-preview-same-tab-group`） |
| 隣接タブ index の厳密保証 | §1 / §10 Non-Goals（best-effort — RK-018） |
| 標準 Markdown Preview の同一 Webview 埋め込み | §1 Non-Goals |
| 未保存バッファの標準 Preview ライブ同期 | §1 Non-Goals / AD-013 |
| Raw パース失敗中の強制ディスク書き込み | §8 Non-Goals |
| 画像挿入ボタン・下線・highlight・脚注・GitHub Alerts | §2 Non-Goals / `gfm-format-toolbar` Scope Out |
| 書式ツールバーの `package.json` keybindings 追加 | §2 Non-Goals |
| **`img/` 外**ローカル画像パスの URI 解決 | §7 / §9 / RK-014 |
| Preview 内 Marp ページ送り UI | §1 / §6 Non-Goals |
| §6 Marp Preview パネル廃止 | Intent Out — パネル存続 |
| CSP / `localResourceRoots` 緩和 | §9 Non-Goals |
| Preview 切入時 Marp パネル自動オープン | §1 Non-Goals |

---

## リスク・制約（RK-*）

| ID | 内容 | 本仕様での扱い |
|----|------|---------------|
| RK-001 | HTML 混在による Git diff 可読性低下 | AD-013 で緩和。レビューはプレビュー推奨 |
| RK-002 | 非標準 MD のポータビリティ | UD-001 承知のトレードオフ |
| RK-003 | XSS / 悪意ある HTML | §9 必須 |
| RK-004 | 大規模ファイル・多数 Mermaid の性能 | 500 KB 警告、最適化は backlog |
| RK-005 | 孤児画像蓄積 | UD-007、自動削除は backlog |
| RK-006 | GFM 表と HTML 表の混在 | スタイルガイド推奨 |
| RK-007 | Mermaid/Marp バージョン差異 | lockfile 固定推奨 |
| RK-008 | Custom Editor と LSP 競合 | MVP 非対応、backlog |
| RK-009 | stack 未確定時の CI 不明確 | AD-001 完了（`doc/stack.md` active 化） |
| RK-010 | 番号付きタスク記法 `1. [ ]` の番号喪失 | unordered タスクへ正規化（§2 / §8）。GFM 往復優先 |
| RK-011 | 複合 mark のネスト順入れ替わり | 意味保持・byte 一致非要求（§2 / §8） |
| RK-012 | 引用の非 paragraph 子保持による初回保存 diff | データ保全側。paragraph-only フィルタ廃止（§2 / §8） |
| RK-013 | `isMarpDocument()` 偽陽性で非 Marp が Preview 時 Marp 描画 | 既存検出ロール維持（§6） |
| RK-014 | `img/` 外手書き相対パスは引き続き非表示 | paste 経路（§7）が主用途 |
| RK-015 | `img/` 内 SVG の XSS | CSP + サニタイズ（§9）。Mermaid SVG とは別 |
| RK-016 | Preview Marp 再描画の性能 | Document 更新のたび Host `marp.render` — debounce は backlog（RK-004 同様） |
| RK-017 | TC-077「三点 Preview ≠ Marp Preview」の意味更新 | 別 UI インスタンスは残るが Preview でも Marp 描画可（§1 / §6） |
| RK-018 | `markdown.showPreview` はタブ index / 「すぐ右隣」を指定できない。Preview シングルトン再利用で毎回新規タブにならない場合がある | 必須は同一 group（`moveActiveEditor` `by: 'group'`）。隣接は同コマンド `by: 'tab'` の best-effort（§10）。Beside フォールバック禁止 |
| RK-019 | Custom Editor フォーカス時、補償なしの `showPreview` は列 1 誤配置になりうる。公開 `TabGroups` に tab move API がない | Host の open 前記録 + open 後 `moveActiveEditor` を必須化（§10）。`by: 'group'` 失敗はスキップをログ、`by: 'tab'` 失敗は同グループ適用済みなら成功扱い。Beside 復帰しない |
| RK-020 | 公開コマンド ID 改名で外部手順が旧 ID 参照のまま残る | 旧 `…ToSide` を同一ハンドラのエイリアスとして維持（§10） |

---

## Related Tests

| ドキュメント | 状態 |
|-------------|------|
| [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) | **作成済** — TC-001–142。**preview-rich-embed**（§1 / §5 / §6 / §7 / §9）: TC-124–142 Green（**TC-130–132 は Preview ソース併記へ更新予定** — `mermaid-snap-style-with-source`）。**GFM 書式ツールバー**（§2 / §8 / §9 `del`/`s`）は **要追記**（`gfm-format-toolbar`）。TC-152（foreignObject）回帰維持 |
| [doc/testspec-native-preview-side-and-default-raw.md](testspec-native-preview-side-and-default-raw.md) | **作成済** — 初期 Raw・Default Preview・dirty ゲート・Pattern A 非干渉・三点往復・表示ラベル。`default-preview-same-tab-group`: `showPreview` + `moveActiveEditor` 同一グループ（＋隣接 best-effort）・コマンド ID / ラベル / TC-004/005/017/018/021 |
| [doc/testspec-mermaid-contrast-readable.md](testspec-mermaid-contrast-readable.md) | **作成済** — HIP 付き sanitize 回帰維持。テーマ／CSS Expected は **`mermaid-redux-elk-fidelity` で更新要**（`redux`/`redux-dark`＋nonce presentation 再注入） |
| [doc/testspec-mermaid-snap-style-with-source.md](testspec-mermaid-snap-style-with-source.md) | **作成済** — ソース併記・Preview RO・HIP / strict。テーマ／CSS 前提は **`mermaid-redux-elk-fidelity` で更新要**。flowchart エッジ CSP＋nonce 再注入回帰必須；`'unsafe-inline'` なし |
| [doc/testspec-mermaid-redux-elk-fidelity.md](testspec-mermaid-redux-elk-fidelity.md) | **未作成** — 後続 `spec-test-design`。kind→redux マップ、nonce 再注入、ELK オプトイン／遅延ロード、グローバル強制 ELK なし、strict / HIP / ソース併記 / Preview RO 回帰 |
| MVP 外項目 | [doc/backlog-vsc-md-wysiwyg.md](backlog-vsc-md-wysiwyg.md) |

---

## Spec Gaps（resolved）

以下は Advisor defaults により解決済み。詳細は各 § および [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) を参照。

| 項目 | 解決内容 | 参照 TC |
|------|---------|---------|
| 表の行/列数上限 | ソフト上限 **100 行 × 20 列**。超過時 UI 警告、保存は許可 | TC-021–023 |
| 未保存新規 `.md` への画像 paste | paste 拒否 + **「Save document first」** 通知 | TC-050 |
| GFM パイプ表オープン時変換 | per-table `tableFormat` で永続化。初回編集時の自動 HTML 変換は廃止。形式切替は Table メニュー明示操作のみ | TC-019（更新予定）、`table-gfm-html-mode` |
| 表の永続化形式 | per-table `tableFormat`（`gfm` \| `html`）。新規挿入デフォルト GFM。セッション `insertTableFormat` は再起動で `gfm` にリセット | `table-gfm-html-mode` |
| 非 Marp 文書の Marp プレビュー | **「No Marp slides detected」** ガイダンス表示 | TC-042 |
| RO 未保存ワークスペース | 保存済み WS は `workspaceState` 永続化；未保存 WS はセッション内のみ | TC-027, TC-030 |
| 三点モード・正本・dirty | 同一 Custom Editor、初期 **Raw**、正本 `MarkdownDocument`、モード切替でディスク非書込。三点往復可 | TC-070–074（初期モード期待は `native-preview-side-and-default-raw` で更新） |
| Default Preview（非モード） | mode-toolbar 先頭 `Default Preview`（`data-action="native-preview"`）。表示順: Default Preview \| Editor Preview \| Edit Rich Editor \| Edit Raw Text。面不変。dirty→Save/Cancel。一次 API `markdown.showPreview` + Host 同一グループ補償（`moveActiveEditor`）。コマンド `showNativeMarkdownPreview`（旧 `…ToSide` はエイリアス）。Pattern A / Marp 非干渉。Beside フォールバック Out。4th mode Out | TC-004/005/017/018/021（`native-preview-side-and-default-raw` / `default-preview-same-tab-group`） |
| Raw パース失敗 | Document 非破壊 + 通知 + 失敗中 save ブロック | TC-078–079 |
| Preview vs Marp Preview | §1 三点 Preview（Marp 検出時は同一 Webview 内 RO 描画可）と §6 Marp Preview **パネル**（別 UI インスタンス）を明示 | TC-077（意味更新 — RK-017） |
| Preview 厳密 RO・三者同期 | Preview 入力不可、Raw↔Markdown↔Preview が Document 経由で一致。表示層（Marp HTML / 画像 rewrite / Mermaid CSS）は正本非変更 | TC-080–082 |
| GFM 書式ツールバー | §2 In（strike / H3–H6 / inline code / quote / task / HR）往復、Out（画像ボタン・下線・highlight・脚注・Alerts）、RO/モード既存ガード、sanitize `del`/`s` | 後続 TC（`gfm-format-toolbar`） |
| 画像 URI Host 解決 | `img/` 配下のみ `isSafeImagePath` + `asWebviewUri`。serialize は相対パス維持 | 後続 TC（`preview-rich-embed`） |
| Preview Mermaid ソース併記 | Preview / Markdown とも図（`.mermaid-preview`）の下に `.mermaid-source` 表示。旧「Preview ソース非表示」撤回。Preview は厳密 RO | TC-130–132 更新予定（`mermaid-snap-style-with-source`） |
| Preview 内 Marp 描画 | `isMarpDocument` 共用、`#preview-marp-root`、`previewMarpHtml`、§6 パネル共存 | 後続 TC（`preview-rich-embed`） |
| Preview 可読性 CSS | `body[data-mode='preview']` スコープ、`line-height`、opacity/コントラスト、`--vscode-*` トークン | 後続 TC（`preview-mode-quality`） |
| Mermaid frontmatter / VS Code テーマ | フェンス全文 render、kind マップ `light`→`redux` / `dark`\|`highContrast`→`redux-dark`、try-catch 隔離、`themeVariables` への `var(--vscode-...)` 禁止、グローバル `fontSize: '10px'`（`mermaid-readable-viewport`）、`themeUpdated` 再描画。classic `default`/`dark` および全 kind 強制 `default` は撤回（`mermaid-redux-elk-fidelity`） | `mermaid-theme-crash-fix` / `fix-mermaid-edge-styles` / `mermaid-redux-elk-fidelity` / `mermaid-readable-viewport` |
| Mermaid コントラスト可読 | redux 系テーママップ＋ Host 同一 nonce による presentation `<style>` 再注入、HIP 付き sanitize（ラベル HTML 保持）、`dark`/`highContrast` でノード・ラベル・エッジ識別。島ライト撤回。静的 Host CSS は安全網に縮小。広い面背景不変。strict + DOMPurify 維持 | [testspec-mermaid-contrast-readable.md](testspec-mermaid-contrast-readable.md)（更新要） |
| Mermaid ソース併記 | Preview / Markdown とも図下に `.mermaid-source`。Preview 厳密 RO。HIP / strict 維持。島ライト＋全 kind `default` は撤回。テーマは redux マップ（`mermaid-redux-elk-fidelity`） | [testspec-mermaid-snap-style-with-source.md](testspec-mermaid-snap-style-with-source.md)（更新要） |
| Mermaid presentation CSP（nonce 再注入） | render 結果 `<style>` に Host 同一 nonce を付与して再注入。任意ユーザー CSS 素通しなし。`style-src` に `'unsafe-inline'` なし。静的 Host CSS エッジフォールバックは縮小／撤廃。flowchart エッジ黒ブロブ／欠線解消 | 後続 TC（`mermaid-redux-elk-fidelity`）／既存 edge-styles 回帰更新 |
| Mermaid ELK オプトイン | `@mermaid-js/layout-elk` 登録＋遅延ロード。frontmatter / `%%{init}%%` の `layout: elk` 時のみ ELK。グローバル強制なし。登録失敗は図単位エラー。Chart 依存 Out | 後続 TC（`mermaid-redux-elk-fidelity`） |
| Mermaid 表示密度 | グローバル `themeVariables.fontSize: '10px'`（旧 `'8px'` / `'13px'` 置換）。`var(--vscode-...)` 禁止。CSS scale は密度の主手段にしない。per-diagram frontmatter 上書き可。redux / nonce / ELK / strict / HIP 不変 | 後続 TC（`mermaid-readable-viewport`）／[testspec-mermaid-redux-elk-fidelity.md](testspec-mermaid-redux-elk-fidelity.md) 追記 |
| Mermaid 可読ビューポート | タイトル全文可視。Editor Preview / Rich Editor のみ: 初期 fit・ズームイン／アウト・パン／スクロール・再 render 時 re-fit・a11y `aria-label`。密度（fontSize）とビューポート変換は別契約。Default Preview 埋め込みなし。セッション永続なし | 後続 TC（`doc/testspec-mermaid-readable-viewport.md`） |

---

## 改訂履歴

| 日付 | 節 | 変更内容 |
|------|-----|---------|
| 2026-08-29 | 全体 | 初版。Requirements Brief `vsc-md-wysiwyg` に基づく MVP 仕様 |
| 2026-08-29 | §3, §4, §6, §7, Spec Gaps | Advisor defaults で Spec Gaps 解決。testspec-vsc-md-wysiwyg 連携 |
| 2026-08-29 | 概要, AD-*, §1, §2, §4, §6, §8, Non-Goals, Spec Gaps | Preview / Markdown / Raw 三点モード・相互同期・dirty/save・ファイル RO 全編集面ロック・Marp 区別・Raw パース失敗時 save ブロックを契約化（AD-016）。viewType `vsc-md-editor.wysiwyg` を明示 |
| 2026-08-30 | §1 三点モード | Preview 厳密 RO・三者同期モデル・モード切替時 Document 再投影を契約化 |
| 2026-08-30 | §10 | Pattern A（IDE タイトルバー切替検知）・`autoRestoreOnBuiltinSwitch`・`openWithWysiwyg` コマンドを追加 |
| 2026-08-30 | §10 | `reloadExtension` コマンド（拡張更新後の手動ウィンドウリロード）を追加 |
| 2026-08-30 | AD-005, §3, Spec Gaps, Related Tests | GFM / HTML 二形式表編集。per-table `tableFormat`、Table メニュー（挿入・行/列操作・変換・セッションデフォルト）、初回編集時自動 GFM→HTML 変換廃止。Requirements Brief `table-gfm-html-mode` |
| 2026-08-30 | §3 | Table メニューに **Delete table** を追加（カーソルが表内のときのみ有効） |
| 2026-08-31 | §3 | GFM 表セル内改行を `<br />`（または同等 hard break）で永続化し、Markdown↔Raw で単一改行として往復する契約を追加。`convertToGfm` の flatten はブロックリッチ除去とし、セル内改行は保持。HTML リッチセル仕様は不変（`gfm-table-linebreak-fix` / ユーザー決定 A） |
| 2026-08-31 | §1 三点モード, §10 | mode-toolbar 表示ラベルを `Preview` / `Edit Rich Editor` / `Edit Raw Text` と契約化。mode id（`preview` \| `markdown` \| `raw`）は不変（`mode-toolbar-labels`） |
| 2026-08-31 | 概要, AD-003, §2, §4, §8, §9, Non-Goals, RK-*, Spec Gaps, Related Tests | Edit Rich Editor 書式ツールバーの GFM 充足（strike `~~`、H3–H6、inline code、blockquote 子保持、task list、HR）。Scope Out（画像ボタン・下線・highlight・脚注・Alerts）。sanitize `del`/`s`。Requirements Brief `gfm-format-toolbar` AD-001–AD-015 を契約化 |
| 2026-08-31 | 概要, AD-008, AD-009, §1, §5, §6, §7, §8, §9, Non-Goals, RK-013–017, Spec Gaps, Related Tests | Preview リッチ表示（`preview-rich-embed`）: Host 画像 URI rewrite（`img/` のみ）、Preview Mermaid ソース非表示、Preview 内 Marp 描画（`#preview-marp-root` / `previewMarpHtml` / `isMarpDocument` 共用）、§6 パネル共存、serialize 相対パス維持。Requirements Brief AD-001–AD-012 |
| 2026-09-03 | §1, §5, Spec Gaps, Related Tests, 改訂履歴 | Preview 品質改善（`preview-mode-quality`）: §1 Preview 可読性 CSS（`body[data-mode='preview']` スコープ、`line-height`、opacity/コントラスト、`--vscode-*` トークン）、`themeUpdated` postMessage 契約。§5 Mermaid フェンス全文 render（frontmatter 非 strip）、`theme: 'base'` + VS Code `themeVariables`、テーマ切替再描画。Marp 分岐・三点同期は不変。Requirements Brief AD-001–AD-010 |
| 2026-09-03 | §5, Spec Gaps, 改訂履歴 | Mermaid テーマ初期化クラッシュ修正（`mermaid-theme-crash-fix`）: VS Code kind から Mermaid ビルトインテーマ（dark/default）へのマップ採用、`themeVariables` での `var(...)` 指定を廃止。Mermaid 初期化・テーマ切替を try-catch で隔離し Webview クラッシュを防止 |
| 2026-09-05 | AD-016, §1, §8, §10, 共通 Non-Goals, Spec Gaps, Related Tests, 改訂履歴 | 初期 `editorMode` を **raw** に変更。mode-toolbar に非モード **Side Preview**（`markdown.showPreviewToSide`、コマンド `vsc-md-editor.showNativeMarkdownPreviewToSide`）。dirty 時 Save/Cancel ゲート。Pattern A / Marp 非干渉。三点 Preview 維持・4th mode / 埋め込みは Non-Goals。三点往復受け入れ。Requirements Brief `native-preview-side-and-default-raw` AD-001–AD-014 |
| 2026-09-05 | §1 mode-toolbar, AD-016, §8, §10, Spec Gaps, Related Tests, README, 改訂履歴 | 表示ラベルを **Default Preview** \| **Editor Preview** \| **Edit Rich Editor** \| **Edit Raw Text** に更新（左→右）。`preview`→Editor Preview。Default Preview は非モード（`data-action=native-preview-to-side`、4th `editorMode` ではない）。セパレータ任意・四ボタン同等優先。Related Tests の testspec 状態を作成済に修正（`toolbar-default-editor-preview-labels`） |
| 2026-09-05 | §5, §9, 改訂履歴 | Mermaid NodeView の SVG sanitize で flowchart `foreignObject` とラベル用安全な子を保持する契約を追加（`fix-mermaid-dark-visibility` / TC-152）。`script` / `on*` 除去・`securityLevel: 'strict'` は不変 |
| 2026-09-05 | §1, §5, §9, Spec Gaps, Related Tests, 改訂履歴 | Mermaid ダーク可読性（`mermaid-contrast-readable`）: UD-001=B 島のみライトキャンバス＋ライト系テーマ。sanitize に `HTML_INTEGRATION_POINTS: { foreignobject: true }` 必須（P0）。広い面背景は不変。`securityLevel: 'strict'` / DOMPurify 維持。Requirements Brief AD-001–AD-010 |
| 2026-09-05 | 概要, AD-007, §1, §5, Spec Gaps, Related Tests, 改訂履歴 | Mermaid Snap 風見た目＋ソース併記（`mermaid-snap-style-with-source`）: 旧「Preview ソース非表示」撤回。Preview / Markdown とも図下に `.mermaid-source` 表示（Preview は厳密 RO）。全 kind → `theme: 'default'`＋島ライトキャンバス。HIP / `securityLevel: 'strict'` / DOMPurify 維持。Requirements Brief AD-001–AD-013 |
| 2026-09-06 | §1, §8, §10, 共通 Non-Goals, RK-018–020, Spec Gaps, Related Tests, README, 改訂履歴 | Default Preview を同一タブグループへ（`default-preview-same-tab-group`）: 一次 API `markdown.showPreview`、Host の open 前記録 + open 後 `tabGroups.move` 補償（preferred index `activeIndex+1` best-effort）。`showPreviewToSide` フォールバック禁止。公開コマンド `vsc-md-editor.showNativeMarkdownPreview`（旧 `…ToSide` はエイリアス）。ラベル / `data-action=native-preview` / `openNativePreview` / dirty 警告から Side 表現を除去。非モード・dirty Save/Cancel・Pattern A / Marp 非干渉は維持。Requirements Brief AD-001–AD-010 |
| 2026-09-06 | §1, §10, RK-018–019, Spec Gaps, Related Tests, 改訂履歴 | Doc sync（`default-preview-same-tab-group`）: 同一グループ補償の具体メカニズムを安定 `moveActiveEditor`（`by: 'group'` MUST / `by: 'tab'` preferred best-effort）に置換。旧 `tabGroups.move` / `move(..., { index })`・Preview タブ first-match 特定の記述を除去。振る舞い契約（`showPreview`・ToSide フォールバック禁止・同 group MUST・隣接 best-effort）は不変。Related Tests「要更新」残渣を解消 |
| 2026-09-06 | 概要, AD-007, §1, §5, §9, Spec Gaps, Related Tests, 改訂履歴 | Mermaid エッジ CSP フォールバック＋標準テーママップ復帰（`fix-mermaid-edge-styles`）: 島ライト強制・全 kind `theme: 'default'` を撤回。kind マップ `light`→`default` / `dark`\|`highContrast`→`dark`。`themeVariables` への `var(--vscode-...)` 再導入禁止。Host 同一 nonce 付き presentation CSS（`fill: none` / stroke）で CSP 下のエッジ黒ブロブを解消。`style-src` に `'unsafe-inline'` なし。ソース併記・Preview RO・`securityLevel: 'strict'`・HIP / DOMPurify 不変。Chart / ELK Out。Requirements Brief AD-001–AD-013 |
| 2026-09-06 | 概要, AD-007, §5, §9, Spec Gaps, Related Tests, 改訂履歴 | Mermaid redux テーマ＋ ELK オプトイン＋ presentation nonce 再注入（`mermaid-redux-elk-fidelity`）: kind マップ `light`→`redux` / `dark`\|`highContrast`→`redux-dark`。render 結果 `<style>` の Host 同一 nonce 再注入を優先し、静的 Host CSS エッジフォールバックを縮小／撤廃。`@mermaid-js/layout-elk` 登録＋遅延ロード、frontmatter / `%%{init}%%` の `layout: elk` 時のみ ELK（グローバル強制なし）。旧「ELK Out」撤回。Chart 依存・ピクセル一致・`'unsafe-inline'`・HIP / strict / ソース併記 / Preview RO は不変。Requirements Brief AD-001–AD-015 |
| 2026-09-06 | 概要, AD-007, §5, Spec Gaps, Related Tests, 改訂履歴 | Mermaid 表示密度（`mermaid-display-density`）: グローバル `themeVariables.fontSize: '13px'`（Mermaid 既定 ~16px よりやや小さく）。`var(--vscode-...)` 禁止。CSS `scale`/`zoom` は主手段にしない。per-diagram frontmatter 上書き可。redux kind マップ・nonce 再注入・ELK オプトイン・strict / HIP / ソース併記は不変 |
| 2026-09-06 | 概要, AD-007, §5, Spec Gaps, Related Tests, 改訂履歴 | Mermaid 可読ビューポート（`mermaid-readable-viewport`）: グローバル `fontSize` を `'8px'` に置換（旧 `'13px'`）。密度（fontSize）と閲覧用ビューポート変換（fit／ズーム／パン／スクロール）を分離。タイトル全文可視。Editor Preview / Rich Editor の Mermaid NodeView のみ（Default Preview 埋め込みなし）。再 render 時 re-fit・a11y `aria-label`。redux / nonce / ELK / strict / HIP / ソース併記は不変。Requirements Brief AD-001–AD-013 |
| 2026-09-06 | 概要, AD-007, §5, Related Tests, 改訂履歴 | Mermaid 密度・タイトル可視 polish: グローバル `fontSize` を `'8px'` → `'10px'`。表示層 `ensureTitleVisible` で `getComputedTextLength`＋`text-anchor` を考慮し viewBox 左右パッドを拡大（左欠け解消）。ビューポート CSS overflow/padding 追随。redux / fit／ズーム／パン契約は不変 |
| 2026-09-06 | §5 正常系 7b, 改訂履歴 | Mermaid タイトル左揃え polish: 表示層でタイトルが図コンテンツ左端より左にはみ出す場合は位置を右へシフト（title left ≥ diagram left）。viewBox 再計算。fontSize 10px / ズーム・パン契約は不変 |