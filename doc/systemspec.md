# System Specification — vsc-md-editor

VS Code 拡張 **vsc-md-editor** の振る舞い仕様（WHAT）。実装詳細・テストケース一覧は本書に含めない。

---

## 概要

チーム向け技術ドキュメントを Git 管理しながら、Word/Excel に近い WYSIWYG 体験で Markdown（`.md`）を編集する VS Code 拡張機能。MVP では同一 Custom Editor 上の **Preview / Markdown / Raw 三点モード**、**GFM 書式ツールバー**（§2 — 取り消し線・H1–H6・インラインコード・引用・タスクリスト・水平線等）、**GFM / HTML 二形式表編集**（§3・アーキテクチャ AD-005）、ファイル単位 Readonly 切替、Mermaid リアルタイム描画（Preview では図のみ表示 — §5）、**Marp プレビュー**（§6 — サイド/パネル。**Preview モードでも Marp 検出時は同一 Webview 内にスライド描画可** — §1 / AD-008）、**Host 側 `img/` 画像 URI 解決**（§7 / §9）、クリップボード画像のローカル保存を提供する。リッチ表現（拡張記法・HTML 混在）を Markdown 厳密互換より優先する（UD-001）。今回追加の書式ノードは GFM として往復できること（§8）。

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
| AD-007 | Mermaid はコードブロック + リアルタイム描画。Preview では図のみ（ソース非表示 — §5）。編集はテキストのみ |
| AD-008 | **Marp Preview** はサイド/パネル（§6）を維持。**Preview モード**（§1）でも `isMarpDocument(markdownText)` 検出時は同一 Webview 内 `#preview-marp-root` に Host 生成 HTML を RO 表示可。別 UI インスタンス・別責務は維持。編集は Markdown / Raw 側 |
| AD-009 | 画像 paste → 同階層 `img/image-NNNN.ext` に保存し相対パスを挿入。表示時は Host が `img/` 配下のみ `asWebviewUri` で rewrite（§7 / §9）。serialize / ディスクは常に相対パス |
| AD-010 | Webview CSP + HTML サニタイズ。許可タグ・属性を限定 |
| AD-011 | Extension Host と Webview を別バンドルし `media/` に配置 |
| AD-012 | シリアライズ round-trip のユニットテスト + Custom Editor 統合テスト |
| AD-013 | 保存時の整形ルールを固定し Git diff 可読性を確保 |
| AD-014 | ビルトイン Markdown エディタとの共存（エディタ関連付けの切替可能） |
| AD-015 | Output チャンネルで障害ログ。ユーザー向けはエディタ内インライン表示を優先 |
| AD-016 | 同一 Custom Editor 内に **Preview / Markdown / Raw** 三点モード。初期モードは Markdown。モード切替 alone ではディスク書き込みしない |

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
| `editorMode` | `"preview" \| "markdown" \| "raw"` | はい | — | — | 初期値 `"markdown"`（AD-016） |
| `modeSwitchCommand` | コマンド / UI 切替 | 任意 | — | — | モード変更のみ。ディスク I/O なし |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功（オープン） | Custom Editor タブ表示、Webview ロード完了、初期モード Markdown | AD-016 |
| 成功（モード切替） | 対象面を表示、Document 内容は維持、**ディスク未書込** | dirty 状態も変更しない（内容未変更時） |
| 成功（保存） | ディスク上 `.md` 更新、`dirty` 解除 | AD-013 整形後 |
| ファイル読込失敗 | エディタ未表示、通知 + Output | 権限・存在エラー |
| シリアライズ失敗 | 保存拒否、`dirty` 維持、通知 + Output | Document 正本は維持 |
| Raw パース失敗 | Document **を更新しない**、通知 + Output、**save ブロック** | 失敗中フラグ。直前の有効 Document を保持 |
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
| **Preview** | `preview` | 読み取り専用の描画表示。**非 Marp:** TipTap RO + Host 解決済み画像 + Mermaid 図のみ（§5）。**Marp 検出時:** `#preview-marp-root` に Host 生成サニタイズ HTML（縦スクロール一覧） | **不可（厳密 RO）** | **Document → 一方表示**のみ。キー入力・paste・ツールバー等の編集イベントを Document へ送らない |
| **Markdown** | `markdown` | TipTap WYSIWYG 本文編集（§2）。画像は Host rewrite 済み `docJson` を投影（§7） | 可（ファイル RO 時は不可 — §4） | Markdown 面 ↔ Document 双方向。変更で `dirty` |
| **Raw** | `raw` | Markdown ソース文字列の直接編集 | 可（ファイル RO 時は不可 — §4） | Raw 面 ↔ Document 双方向。変更で `dirty` |

##### mode-toolbar 表示ラベル（UI）

Webview モード切替バーのボタン文言および `title` 属性は次と一致させる（表示のみ。mode id / `editorMode` は変更しない）。

| mode id | 表示ラベル（ボタン文言 = `title`） |
|---------|-------------------------------------|
| `preview` | `Preview` |
| `markdown` | `Edit Rich Editor` |
| `raw` | `Edit Raw Text` |

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

非 Marp Preview（TipTap RO 表示層）の Typography・コントラストは **`body[data-mode='preview']` スコープの CSS のみ**で改善する。Markdown / Raw モードのスタイルは変更しない。色は **`--vscode-*` CSS 変数**を正とし、ハードコード色は用いない。

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

1. ユーザーが `.md` を開くと Custom Editor が起動し、ディスク内容を `MarkdownDocument` に読み込み、初期モード **Markdown** で Webview に表示する
2. **Markdown ↔ Raw 相互リアルタイム同期:** 一方の編集は postMessage 経由で Document に反映され、他方面も Document から再投影される。正本は常に Extension Host の `MarkdownDocument`
3. **Preview** は Document の現在内容を **厳密 RO** で描画する一方通行。Preview 表示中に Document が更新されれば描画を追随する。**Preview への切替時**は Host が Document 最新を再投影する（Raw 離脱時の flush 後を含む）。非 Marp は rewrite 済み `docJson`、Marp 検出時は `previewMarpHtml` で `#preview-marp-root` を更新
4. **モード切替**（Preview ↔ Markdown ↔ Raw）は表示面の切替のみであり、**ディスクへの書き込みを行わない**。内容に差分がなければ `dirty` も変化しない。Preview / Markdown への切替時は Document から視覚面を refresh する。Preview 離脱時は `#preview-marp-root` を空にし `#editor` を復帰
5. Markdown / Raw での内容変更は既存の CustomDocument フローに乗り `dirty` となる。`save` / `saveAs` で Document 内容をシリアライズし UTF-8 で書き込む（§8）
6. undo/redo は Document 経由で一貫して動作する（モードをまたいでも同一 Document 履歴）
7. エディタを閉じる際、未保存変更があれば VS Code 標準の確認ダイアログが表示される

#### 例外系

1. オープン時にパース不能な Markdown/HTML 混在は可能な範囲で表示し、保存時にシリアライズエラーを報告する
2. **Raw 編集中のパース失敗:** Document を破壊・上書きしない。ユーザーへ通知し Output に記録する。パース失敗が解消されるまで **save をブロック**する（直前の有効 Document 内容を正本として維持）
3. 外部プロセスによるファイル変更は VS Code の標準リロード/競合フローに従う

### Non-Goals

- Language Server との完全統合（RK-008 — backlog 検討）
- 仮想スクロールによる大ファイル最適化（RK-004 — backlog）
- Preview / Markdown / Raw の同時分割表示（同一タブ内の三点切替のみ）
- モードごとに別 Custom Editor / 別 viewType を登録すること
- Preview 内 Marp のページ送り UI（縦スクロール一覧のみ）
- Preview 切入時の §6 Marp Preview パネル自動オープン
- Rich Editor（Markdown モード）での Marp WYSIWYG 描画（§6 Non-Goals と同旨）
- VS Code ビルトイン Markdown Preview とのピクセル完全一致（`preview-mode-quality` — 三点モード一体感・テーマ連動可読性を優先）
- VS Code ビルトイン Preview の嵌め込み・別 Webview 化・markdown-it HTML パイプラインへの全面置換（非 Marp Preview は TipTap RO 表示層を維持 — `preview-mode-quality` AD-001）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-001–009（基盤）および三点モード追加 TC。Preview Marp 分岐・`previewMarpHtml`・`isMarpDocument` 共用: TC-124–142（`preview-rich-embed`）。Preview 可読性・`themeUpdated`: 後続 TC（`preview-mode-quality`）

### Spec Gaps

- なし（モード初期値 Markdown・Raw パース失敗時 save ブロック・モード切替でディスク非書込・Preview Marp 分岐・画像 Host rewrite・Preview 可読性 CSS・`themeUpdated` は本節および §5 / §6 / §7 / §9 で確定）

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

` ```mermaid ` フェンスブロックをリアルタイムに図として描画する。編集はテキストのみ（UD-004, AD-007）。**Preview モード**ではソース（`.mermaid-source`）を非表示とし、描画（`.mermaid-preview`）のみ表示する（`preview-rich-embed`）。フェンス内 YAML frontmatter / `%%{init:...}%%` は Mermaid ネイティブに委譲する（`preview-mode-quality` AD-003）。グローバルテーマは VS Code カラーテーマ CSS 変数と連動する（`preview-mode-quality` AD-004–005）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `mermaidSource` | `string` | はい | 0 文字 | — | フェンス内**全文**（YAML frontmatter / `%%{init:...}%%` 含む。Webview は strip しない — AD-003） |
| `debounceMs` | 数値 | いいえ | — | — | 目安 300 ms。テーマ切替再描画にも適用 |
| `editorMode` | `"preview" \| "markdown" \| "raw"` | はい | — | — | Preview 時はソース非表示（§1） |
| `themeUpdated` | postMessage | 任意 | — | — | §1 `{ kind: 'light' \| 'dark' \| 'highContrast' }` |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | ブロック内に SVG/図表示 | ソースは Document に保持。Preview では DOM 上非表示 |
| 構文エラー | ブロック内にエラーメッセージ | ソースは Document に保持。Preview ではソース非表示のまま preview 領域にエラー。Output に記録（AD-015） |
| レンダリングタイムアウト | エラー表示 | RK-004 |

### Preconditions

- Webview 内で Mermaid レンダラがロード済みであること

### Behavior

#### 正常系

1. Mermaid コードブロック内のテキスト変更を debounce（目安 300 ms）後に再描画する
2. 保存内容は ```mermaid フェンスとして .md に残る
3. RO 中も描画は更新される（ソース変更は不可）
4. **Preview モード**（`body[data-mode="preview"]`）: `.mermaid-source` を CSS で非表示（`display: none` 等）。`.mermaid-preview` のみ表示。構文エラーは `.mermaid-error` に `--vscode-errorForeground` / `--vscode-inputValidation-errorBackground` で表示（`preview-mode-quality` AD-007）。`securityLevel: 'strict'`・DOMPurify SVG サニタイズは不変
5. **Markdown / Raw モード**: ソース + 図を従来どおり表示（Markdown モードでソース編集可）
6. **フェンス全文レンダリング**（`preview-mode-quality` AD-003）: `mermaid.render(id, source)` にはフェンス内 **全文**を渡す。YAML frontmatter および `%%{init:...}%%` による per-diagram 設定は Mermaid ネイティブに委譲し、Webview 側で frontmatter を strip しない。per-diagram 設定はグローバル `mermaid.initialize` より優先（Mermaid v11 仕様）
7. **グローバルテーマ**（`mermaid-theme-crash-fix`）: `mermaid.initialize` の `theme` は VS Code カラーテーマ kind に応じてマップする。
   - `dark` / `highContrast` → `theme: 'dark'`
   - `light` → `theme: 'default'`
   - `themeVariables` への `var(--vscode-...)` 指定（khroma color parser が "Unsupported color format" でクラッシュする原因）は廃止し、Mermaid ビルトインテーマを優先する。
   `securityLevel: 'strict'` は不変（§9 / AD-010）。

8. **初期化・テーマ切替の隔離**（`mermaid-theme-crash-fix`）: `mermaid.initialize` およびテーマ更新処理は `try-catch` で隔離し、Mermaid 内部エラーが Webview 全体のメッセージングや描画を停止させないようにする。

9. **テーマ切替再描画**（`preview-mode-quality` AD-005）: §1 `themeUpdated` 受信時、Webview は `mermaid.initialize(...)` を更新し、表示中の全 Mermaid NodeView を debounce 後に再 render する。本処理も上記「隔離」に従う。

#### 例外系

1. 悪意ある入力はサニタイズし、スクリプト実行を行わない（RK-003）
2. Mermaid パッケージ更新による見た目変化は許容（RK-007 — lockfile 固定推奨）
3. frontmatter 内 `config.theme` が VS Code テーマと異なる場合、当該図のみ意図的に別配色となる（Mermaid 仕様 — `preview-mode-quality` RK-004）
4. 文書内 Mermaid ブロックが多数ある場合、テーマ切替の一括再描画で短時間 CPU 負荷が上がり得る（debounce + 表示中 NodeView のみ — RK-004 系 / `preview-mode-quality` RK-002）
5. Mermaid テーマのマッピングは VS Code ネイティブ Markdown Preview とのピクセル一致を保証しない（`preview-mode-quality` RK-001）

### Non-Goals

- Mermaid ビジュアルダイアグラムエディタ（backlog）
- オフライン以外での外部レンダリング API 呼び出し
- VS Code ネイティブ Markdown Preview との Mermaid 配色ピクセル一致（`preview-mode-quality` RK-001）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-031–037。Preview Mermaid ソース非表示: TC-130–132（`preview-rich-embed`）。frontmatter 描画・テーマ切替再描画（TC-013 拡張）・Preview コントラスト: 後続 TC（`preview-mode-quality`）

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
7. **モード切替だけでは本節の保存処理を起動しない**（§1）
8. **画像参照:** serialize / ディスク出力は **常に相対パス**（例: `img/image-0001.png`）。Host の `asWebviewUri` rewrite は表示投影のみで Document 正本を変更しない（§7 / §9）
9. **GFM 書式ノードの往復（§2 In）:** 次を parse ↔ stringify で保持する（micromark/mdast の strikethrough・task-list を **direct dependency** として追加。既存 `gfm-table` は維持）
   - 取り消し線: 入力 `~~` および HTML `<del>` / `<s>` → モデル `strike` → 出力 **常に** `~~text~~`（`<del>`/`<s>` は出さない）
   - 見出し h1–h6: 既存スキーマどおり往復
   - インラインコード: `` `code` `` mark ↔ 出力。フェンスコードブロックとは別経路
   - 引用: GFM `>`。ブロック子（heading, list, taskList, codeBlock, 入れ子 blockquote）を落とさない（paragraph-only フィルタは禁止）
   - タスクリスト: `- [ ]` / `- [x]`（出力のチェックは小文字 `x`）。入力 `[X]` は `[x]` に正規化。`1. [ ]` は unordered タスクリストへ正規化（番号非保持）
   - 水平線: mdast `thematicBreak` ↔ 出力 `---`（既存 `toMarkdown` `rule: '-'`）。前後空行は決定的整形に従う
10. **複合 mark:** strike+bold / strike+italic 等は意味を保持。ネスト順の入れ替わりは許容（見た目同等なら byte 一致は要求しない）
11. **非対象 GFM 拡張:** footnotes / GitHub Alerts / autolink-literal / tagfilter の新規有効化はしない（§2 Out）

#### 例外系

1. パース不能部分は raw 保持を優先し、失敗時はユーザーに通知する
2. Raw パース失敗時は Document を壊さず、失敗解消まで save を拒否する（§1）

### Non-Goals

- 他エディタとの完全な Markdown 相互変換（RK-002）
- Raw 失敗中の「強制保存（Document 無視で Raw バッファをそのまま書く）」オプション（MVP 非採用）
- 複合 mark のネスト順の byte-identical 保証（§2 Behavior）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-052–056、Raw パース失敗 TC、および GFM 書式往復追記 TC（`gfm-format-toolbar`）

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

1. Webview に格 CSP を設定する（nonce 付き script/style）。Custom Editor の `img-src ${webview.cspSource} data: https: file:` は `getHtml` のまま維持。CSP / `localResourceRoots` / `on*` 除去は本変更で不変
2. 表示前に HTML をサニタイズする（表・画像・基本書式・Mermaid SVG を許可）。**許可タグに `del` / `s` を含める**（§2 取り消し線の HTML 混在入力を落とさない）。下線・highlight（`mark`）は許可追加しない。`input` checkbox は既存許可のまま
3. 画像保存先はワークスペース内 `img/` に限定する
4. **画像 URI rewrite（Host）:** `.md` のディレクトリ基準で実ファイル URI を組み立て、`isSafeImagePath(path)` — **`..` 禁止**、**`img/` プレフィックス必須** — を通過した場合のみ `webview.asWebviewUri` する。対象: TipTap `docJson` 内 `image.src`、Marp 出力 HTML 内 `<img src>`
5. **`https:` / `data:`** は CSP 上 Webview が直接解決（既存どおり — rewrite 不要）
6. Marp Preview **パネル**の CSP（`enableScripts: false`）は本タスクでは Preview 整合のため AD-001 rewrite で足りる限り **img-src 拡張しない**
7. **`img/` 内 SVG** は CSP + サニタイズ経路を通す（Mermaid SVG とは別経路 — RK-015）

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

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-057–061、TC-126–127（`isSafeImagePath` / `localResourceRoots` regression）

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
   - 既定 `false` のとき: 日本語 `InformationMessage` を表示し、エディタ内 **Preview / Edit Rich Editor / Edit Raw Text** 三点ボタンの利用を案内。ボタン **「WYSIWYG Editor で開く」** で `vsc-md-editor.openWithWysiwyg` を実行
   - タブが閉じられた、または別ファイルがアクティブの場合は何もしない
5. コマンド `vsc-md-editor.openWithWysiwyg`: 引数 URI またはアクティブ `.md` に対し `vscode.openWith`（viewType `vsc-md-editor.wysiwyg`）を実行。ビルトイン Markdown エディタの editor/title に表示（`resourceExtname == .md` かつ Custom Editor 非アクティブ時）
6. **拡張更新後の手動リロード:** コマンド `vsc-md-editor.reloadExtension`。確認ダイアログ後に `workbench.action.reloadWindow` を実行する
   - **editor/title** に `$(refresh)` アイコン（`resourceExtname == .md` — WYSIWYG / ビルトインいずれの `.md` 表示中も表示）。Cursor Preview / Markdown 切替で Webview バーが消えてもリロード可能
   - Cursor 組み込み Preview / Markdown トグルの**内部**には挿入不可（API 非提供）。タイトルバー navigation グループの先頭（`navigation@0`）に配置

#### 設定

| キー | 型 | 既定 | 説明 |
|------|-----|------|------|
| `vsc-md-editor.autoRestoreOnBuiltinSwitch` | `boolean` | `false` | Pattern A 検知時に WYSIWYG を自動再オープン。`false` では AD-014 の意図的なビルトイン切替（Reopen Editor With… 等）を妨げない |

### Non-Goals

- IDE タイトルバーの Preview / Markdown トグル自体の非表示・上書き（VS Code / Cursor API 非提供）
- Marketplace 公開手順の詳細（`vscode-extension-publish` スキル / deployment.md で扱う）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-062–064, TC-083–085

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

---

## Related Tests

| ドキュメント | 状態 |
|-------------|------|
| [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) | **作成済** — TC-001–142。**preview-rich-embed**（§1 / §5 / §6 / §7 / §9）: TC-124–142 Green。**GFM 書式ツールバー**（§2 / §8 / §9 `del`/`s`）は **要追記**（`gfm-format-toolbar`） |
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
| 三点モード・正本・dirty | 同一 Custom Editor、初期 Markdown、正本 `MarkdownDocument`、モード切替でディスク非書込 | TC-070–074 |
| Raw パース失敗 | Document 非破壊 + 通知 + 失敗中 save ブロック | TC-078–079 |
| Preview vs Marp Preview | §1 三点 Preview（Marp 検出時は同一 Webview 内 RO 描画可）と §6 Marp Preview **パネル**（別 UI インスタンス）を明示 | TC-077（意味更新 — RK-017） |
| Preview 厳密 RO・三者同期 | Preview 入力不可、Raw↔Markdown↔Preview が Document 経由で一致。表示層（Marp HTML / 画像 rewrite / Mermaid CSS）は正本非変更 | TC-080–082 |
| GFM 書式ツールバー | §2 In（strike / H3–H6 / inline code / quote / task / HR）往復、Out（画像ボタン・下線・highlight・脚注・Alerts）、RO/モード既存ガード、sanitize `del`/`s` | 後続 TC（`gfm-format-toolbar`） |
| 画像 URI Host 解決 | `img/` 配下のみ `isSafeImagePath` + `asWebviewUri`。serialize は相対パス維持 | 後続 TC（`preview-rich-embed`） |
| Preview Mermaid ソース非表示 | `body[data-mode="preview"]` で `.mermaid-source` 非表示 | 後続 TC（`preview-rich-embed`） |
| Preview 内 Marp 描画 | `isMarpDocument` 共用、`#preview-marp-root`、`previewMarpHtml`、§6 パネル共存 | 後続 TC（`preview-rich-embed`） |
| Preview 可読性 CSS | `body[data-mode='preview']` スコープ、`line-height`、opacity/コントラスト、`--vscode-*` トークン | 後続 TC（`preview-mode-quality`） |
| Mermaid frontmatter / VS Code テーマ | フェンス全文 render、VS Code kind マップ（dark/default）、try-catch 隔離、var(...) 廃止、`themeUpdated` 再描画 | `mermaid-theme-crash-fix` |

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
