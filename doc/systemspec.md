# System Specification — vsc-md-editor

VS Code 拡張 **vsc-md-editor** の振る舞い仕様（WHAT）。実装詳細・テストケース一覧は本書に含めない。

---

## 概要

チーム向け技術ドキュメントを Git 管理しながら、Word/Excel に近い WYSIWYG 体験で Markdown（`.md`）を編集する VS Code 拡張機能。MVP では同一 Custom Editor 上の **Preview / Markdown / Raw 三点モード**、**GFM / HTML 二形式表編集**（§3・AD-005）、ファイル単位 Readonly 切替、Mermaid リアルタイム描画、**Marp プレビュー**（§6・AD-008 — 三点の Preview とは別）、クリップボード画像のローカル保存を提供する。リッチ表現（拡張記法・HTML 混在）を Markdown 厳密互換より優先する（UD-001）。

**feature-slug:** `vsc-md-wysiwyg`

**Custom Editor viewType:** `vsc-md-editor.wysiwyg`（`package.json` `contributes.customEditors` と一致）

### アーキテクチャ方針（AD-* 要約）

| ID | 方針（WHAT） |
|----|-------------|
| AD-001 | TypeScript / VS Code Extension Host / npm / `@vscode/test-electron` |
| AD-002 | `*.md` を Custom Editor（viewType `vsc-md-editor.wysiwyg`）で開く。Extension Host 上の `MarkdownDocument` が dirty・undo/redo・save および表示内容の正本 |
| AD-003 | **Markdown モード**は Webview 内 TipTap（ProseMirror）WYSIWYG。見出し・太字・斜体・リスト・リンク・コードブロック等を MVP 対象ノードとする |
| AD-004 | 編集内容 ↔ ディスク `.md` は remark/unified パイプラインで変換。HTML 混在・拡張ブロックを許容。出力は決定的（AD-013） |
| AD-005 | 表は per-table `tableFormat`（`gfm` \| `html`）で永続化する。新規挿入のデフォルトは GFM パイプ表。形式切替は Table メニューの明示操作のみ（§3） |
| AD-006 | ファイル単位 Readonly は **全編集面**（Markdown / Raw）をロック。Preview モードとは別概念。状態はワークスペースに永続化 |
| AD-007 | Mermaid はコードブロック + リアルタイム描画。編集はテキストのみ |
| AD-008 | **Marp Preview** はサイド/パネルのスライド表示専用（§6）。三点モードの **Preview**（§1）とは別 UI・別責務。編集は Markdown / Raw 側 |
| AD-009 | 画像 paste → 同階層 `img/image-NNNN.ext` に保存し相対パスを挿入 |
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

同一 Custom Editor タブ内で次の 3 モードを切り替える。**Marp Preview（§6 / AD-008）は本節の Preview ではない。**

| モード | 役割 | 編集可否 | Document との関係 |
|--------|------|----------|-------------------|
| **Preview** | 読み取り専用の描画表示（TipTap レンダリング、入力不可） | **不可（厳密 RO）** | **Document → 一方表示**のみ。キー入力・paste・ツールバー等の編集イベントを Document へ送らない |
| **Markdown** | TipTap WYSIWYG 本文編集（§2） | 可（ファイル RO 時は不可 — §4） | Markdown 面 ↔ Document 双方向。変更で `dirty` |
| **Raw** | Markdown ソース文字列の直接編集 | 可（ファイル RO 時は不可 — §4） | Raw 面 ↔ Document 双方向。変更で `dirty` |

#### 三者同期（正本: `MarkdownDocument`）

```text
Raw（markdownText）  ←→  Document（doc + markdownText）  ←→  Markdown（TipTap WYSIWYG）
                                    ↓
                              Preview（TipTap RO 描画）
```

- **編集可能なのは Markdown / Raw のみ**。Preview は常に Document の投影を RO 表示する
- Markdown 編集 → Document 更新 → Raw テキスト投影 + Preview 描画追随（Markdown フォーカス中は TipTap を破壊しない — TC-067）
- Raw 編集（パース成功）→ Document 更新 → Markdown / Preview へ `docJson` 投影
- **Preview 表示中**も Document 更新時は描画を追随する（一方通行）

#### 正常系

1. ユーザーが `.md` を開くと Custom Editor が起動し、ディスク内容を `MarkdownDocument` に読み込み、初期モード **Markdown** で Webview に表示する
2. **Markdown ↔ Raw 相互リアルタイム同期:** 一方の編集は postMessage 経由で Document に反映され、他方面も Document から再投影される。正本は常に Extension Host の `MarkdownDocument`
3. **Preview** は Document の現在内容を **厳密 RO** で描画する一方通行。Preview 表示中に Document が更新されれば描画を追随する。**Preview への切替時**は Host が Document 最新を `docJson` で再投影する（Raw 離脱時の flush 後を含む）
4. **モード切替**（Preview ↔ Markdown ↔ Raw）は表示面の切替のみであり、**ディスクへの書き込みを行わない**。内容に差分がなければ `dirty` も変化しない。Preview / Markdown への切替時は Document から視覚面を refresh する
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

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-001–009（基盤）および三点モード追加 TC（後続 `spec-test-design`）

### Spec Gaps

- なし（モード初期値 Markdown・Raw パース失敗時 save ブロック・モード切替でディスク非書込は本節で確定）

---

## §2 WYSIWYG 本文編集（Markdown モード）

### 概要

三点モードのうち **Markdown モード**で、Webview 内 TipTap により Markdown 本文を WYSIWYG 編集する（AD-003）。MVP ノードは見出し（h1–h6）、太字、斜体、箇条書き、番号リスト、リンク、インラインコード、コードブロック。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `editOperation` | 編集コマンド / キー入力 | はい | — | — | RO 時は拒否（§5） |
| `documentSnapshot` | 内部ドキュメントモデル | はい | — | — | TipTap / ProseMirror 相当（AD-003） |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | UI 更新、Document dirty | — |
| RO 中の編集試行 | 操作無効、UI フィードバック | §5 |
| 未対応ノード | 読み取り表示または raw 保持 | データ損失を避ける |

### Preconditions

- Custom Editor が **Markdown モード**であり、かつファイル単位 RO でないこと（§1, §4）
- Webview がロード済みであること

### Behavior

#### 正常系

1. ツールバー・ショートカットで書式を適用できる
2. 編集内容はリアルタイムで内部モデルおよび `MarkdownDocument` に反映される（§1 同期）
3. 保存時に remark パイプラインで Markdown（+ 許可 HTML）へシリアライズされる（AD-004）
4. VS Code テーマ CSS 変数（`var(--vscode-*)`）で見た目を統合する
5. Markdown モードでの変更は Raw 面へ Document 経由でリアルタイム反映される（§1）

#### 例外系

1. 既存 `.md` に本拡張未対応の記法がある場合、可能な限り原文を保持する
2. シリアライズ不能な構造は保存をブロックしエラーを表示する（AD-015）

### Non-Goals

- CommonMark / GFM の厳密互換（UD-001 — リッチ優先）
- 全 Markdown 拡張記法の WYSIWYG 対応
- i18n（UI 文言の多言語化 — backlog）
- Raw / Preview モード中の TipTap 操作（当該モードでは Markdown 面は非表示または非アクティブ）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-010–015

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
| `cellContent` | テキスト / リッチ | 任意 | 空 | — | `gfm`: インラインマーク・プレーンテキストのみ。`html`: 改行・リスト・チェックボックス可 |
| 表サイズ | 行 × 列 | はい | 1 × 1 | ソフト上限 100 行 × 20 列 | 超過時 UI 警告、保存は許可 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功（`gfm`） | 表 UI 更新、保存時 GFM パイプ表出力 | AD-005, AD-013 |
| 成功（`html`） | 表 UI 更新、保存時 HTML `<table>` ブロック出力 | AD-005, AD-010, AD-013 |
| `convertToHtml` 成功 | 当該表の `tableFormat` を `html` に更新。確認なし即時実行（プレーンテキスト昇格、実質ロスレス） | Undo 1 段で復元可 |
| `convertToGfm` 成功 | 当該表の `tableFormat` を `gfm` に更新。リッチ内容はプレーンテキストへ flatten | 実行前に確認ダイアログ必須 |
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
2. `tableFormat: 'html'` の表では、セル内に複数行テキスト、箇条書き、チェックボックスを入力できる
3. `tableFormat: 'gfm'` の表では、セル内容は GFM パイプ表が許容する範囲（インラインマーク・プレーンテキスト）に制限される
4. 保存後の `.md` は当該表の `tableFormat` に応じて GFM パイプ表または HTML `<table>` として記録される
5. 既存 GFM パイプ表の読込 → `tableFormat: 'gfm'`、既存 HTML `<table>` の読込 → `tableFormat: 'html'`（サニタイズ後）。属性欠落時は `gfmSource` / `html` 属性から推論する
6. **GFM→HTML** 変換は確認なしで即時実行する。**HTML→GFM** 変換は実行前に確認ダイアログを表示する（例: 「リッチ内容（改行・リスト・チェックボックス等）はプレーンテキストに flatten されます。続行しますか？」）。MVP に「今後表示しない」オプションは設けない
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

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-016–024, TC-065（既存）。**要追記:** 挿入デフォルト GFM、HTML 挿入、HTML→GFM 確認付き変換・flatten、GFM→HTML 変換、メニュー行/列操作、ボタン色 / セッションデフォルト切替、Readonly 無効、GFM/HTML round-trip（`table-gfm-html-mode`）

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
3. RO 中は **Markdown モードの WYSIWYG・表編集・画像 paste** および **Raw モードのソース編集**が無効化される
4. RO 中も三点の Preview 描画・Mermaid 描画・**Marp Preview（§6）** 等の閲覧系機能は利用できる
5. RO 中でも三点モードの切替自体は可能（表示面の変更のみ。編集は不可のまま）
6. 再オープン時に RO 状態が復元される

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

` ```mermaid ` フェンスブロックをリアルタイムに図として描画する。編集はテキストのみ（UD-004, AD-007）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `mermaidSource` | `string` | はい | 0 文字 | — | フェンス内テキスト |
| `debounceMs` | 数値 | いいえ | — | — | 目安 300 ms（AD-007） |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | ブロック内に SVG/図表示 | ソースは保持 |
| 構文エラー | ブロック内にエラーメッセージ | ソースは保持、Output に記録（AD-015） |
| レンダリングタイムアウト | エラー表示 | RK-004 |

### Preconditions

- Webview 内で Mermaid レンダラがロード済みであること

### Behavior

#### 正常系

1. Mermaid コードブロック内のテキスト変更を debounce 後に再描画する
2. 保存内容は ```mermaid フェンスとして .md に残る
3. RO 中も描画は更新される（ソース変更は不可）

#### 例外系

1. 悪意ある入力はサニタイズし、スクリプト実行を行わない（RK-003）
2. Mermaid パッケージ更新による見た目変化は許容（RK-007 — lockfile 固定推奨）

### Non-Goals

- Mermaid ビジュアルダイアグラムエディタ（backlog）
- オフライン以外での外部レンダリング API 呼び出し

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-031–037

---

## §6 Marp プレビュー（AD-008）

### 概要

Marp 形式スライドのプレビューをサイドまたはパネルに表示する（UD-003, AD-008）。編集は Markdown / Raw 側のみ。

**用語の区別（必須）:**

| 名称 | 節 | 意味 |
|------|-----|------|
| **三点 Preview** | §1 | Custom Editor 内の読み取り専用 Markdown 描画モード |
| **Marp Preview** | §6（本節） | Marp スライド用のサイド/パネル表示。三点モードとは独立 |

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `documentContent` | `string` | はい | — | — | front matter + 本文（Document 正本） |
| `previewTrigger` | コマンド / 自動 | はい | — | — | ドキュメント変更で更新 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | スライド HTML プレビュー | テーマは front matter から |
| パース失敗 | プレビュー内エラー表示 | Output に記録。Document は変更しない |
| 非 Marp 文書 | プレビュー内に「No Marp slides detected」ガイダンス表示 | Marp front matter / スライド区切り未検出時 |

### Preconditions

- Marp 用 Webview / Panel が利用可能であること（Custom Editor 三点 Preview とは別インスタンスでも可）

### Behavior

#### 正常系

1. YAML front matter をパースし Marp テーマを適用する
2. 本文変更（Document 更新）に追随してプレビューを更新する
3. ファイル RO / 三点いずれのモードでも Marp Preview は表示できる
4. 三点モードを Preview にしても、本節の Marp Preview が自動で置き換わることはない

#### 例外系

1. レンダリング失敗時も `.md` ソース / Document は変更しない
2. Marp スライドが検出されない文書では、プレビューパネルに **「No Marp slides detected」** とガイダンス（Marp front matter の追加方法等）を表示する

### Non-Goals

- Marp WYSIWYG 編集（backlog）
- スライド PDF / 画像エクスポート
- 三点 Preview モードを Marp レンダラで兼用すること（責務分離を維持）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-038–042

---

## §7 画像貼付

### 概要

クリップボードから画像を貼り付け、`.md` と同階層の `img/` に保存し、相対パス参照を挿入する（AD-009, UD-007）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `clipboardImage` | `image/*` バイナリ | はい | 1 バイト | 実用上限未定（backlog） | jpg/png/gif/svg |
| `sequenceNumber` | 整数 | 自動 | 1 | 9999 | `image-NNNN` ゼロ埋め 4 桁 |
| `targetMdUri` | `vscode.Uri` | はい | — | — | 同階層 `img/` 基準 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | `img/image-NNNN.ext` 保存 + Markdown 画像参照挿入 | 上書きなし（UD-007） |
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

#### 例外系

1. 未保存新規 `.md`（`untitled:` scheme 等）への paste は拒否し、**「Save document first」** を通知する
2. ファイル移動時のパス自動更新は行わない（UD-007）
3. 参照されなくなった画像（孤児）は削除しない（RK-005 — backlog）

### Non-Goals

- 画像のリサイズ・圧縮の自動最適化
- 外部 URL への自動アップロード
- 孤児画像の自動削除（backlog）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-043–051

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
6. 同一内容に対し、連続保存で byte-identical 出力を目指す（AD-013）
7. **モード切替だけでは本節の保存処理を起動しない**（§1）

#### 例外系

1. パース不能部分は raw 保持を優先し、失敗時はユーザーに通知する
2. Raw パース失敗時は Document を壊さず、失敗解消まで save を拒否する（§1）

### Non-Goals

- 他エディタとの完全な Markdown 相互変換（RK-002）
- Raw 失敗中の「強制保存（Document 無視で Raw バッファをそのまま書く）」オプション（MVP 非採用）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-052–056、Raw パース失敗 TC（後続）

---

## §9 セキュリティ

### 概要

信頼できない `.md` / HTML / Mermaid ソースに対する防御（AD-010, RK-003）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `untrustedHtml` | `string` | 任意 | — | — | 外部ファイル取込 |
| `webviewCsp` | CSP 文字列 | はい | — | — | `default-src 'none'` 基調 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | サニタイズ済み HTML / SVG 表示 | 許可タグリスト適用 |
| 拒否 | 危険要素除去 | `<script>`, `on*` 属性等 |

### Preconditions

- `localResourceRoots` は拡張 `media/` とワークスペース `img/` に限定（AD-010）
- Extension Host 上で HTML を実行しない

### Behavior

#### 正常系

1. Webview に格 CSP を設定する（nonce 付き script/style）
2. 表示前に HTML をサニタイズする（表・画像・基本書式・Mermaid SVG を許可）
3. 画像保存先はワークスペース内に限定する

#### 例外系

1. サニタイズによりレイアウトが変わる場合がある（許容 — RK-002 とトレードオフ）

### Non-Goals

- ネットワーク経由のリモートコンテンツ取得
- 秘密情報の収集・外部送信

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-057–061

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
   - 既定 `false` のとき: 日本語 `InformationMessage` を表示し、エディタ内 **Preview / Markdown / Raw** 三点ボタンの利用を案内。ボタン **「WYSIWYG Editor で開く」** で `vsc-md-editor.openWithWysiwyg` を実行
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

---

## Related Tests

| ドキュメント | 状態 |
|-------------|------|
| [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) | **作成済** — TC-001–068。三点モード・Raw 同期・Raw パース失敗・**GFM/HTML 二形式表**は **要追記**（次: test-agent / spec-test-design、`table-gfm-html-mode`） |
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
| Preview vs Marp Preview | §1 三点 Preview と §6 Marp Preview を別概念として明示 | TC-077 |
| Preview 厳密 RO・三者同期 | Preview 入力不可、Raw↔Markdown↔Preview が Document 経由で一致 | TC-080–082 |

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
