# Test Specification: table-rich-editing

## 概要

- **対象:** 表（Table）の列アライメント（`left` \| `center` \| `right` \| `null`）の WYSIWYG 操作・CSP 安全なリアルタイム描画・GFM/HTML 双方向往復および Table Formatter 統合、行・列の入れ替え（`moveRowUp` / `moveRowDown` / `moveColumnLeft` / `moveColumnRight`）および行複製（`duplicateRow`）、Table ツールバーメニュー・右クリックコンテキストメニュー・表内キーボードショートカット（`Alt+矢印`, `Shift+Alt+ArrowDown`）統合、ならびに Excel / スプレッドシート等からの TSV / HTML `<table>` スマートペーストと誤変換防止ガード
- **対応仕様:** [doc/requirements/systemspec.md](../requirements/systemspec.md) §3（表編集）、§8（シリアライズ・保存 — 表の列アライメント往復）、§9（セキュリティ — CSP・HTML サニタイズ）、§15（スマートペースト連携）、§16（CSV/TSV・Backlog 連携）、[doc/design/architecture.md](../design/architecture.md) AD-005, AD-019
- **Requirements Brief:** `temporary/requirements-brief-table-rich-editing.md`（AD-001〜AD-005, RK-001〜RK-003）
- **テストコード（予定）:** `src/test/suite/unit/table-rich-editing.test.ts`（`.cursor/stack.md` `test_file_glob: "src/test/suite/**/*.test.ts"`）
- **作成日:** 2026-10-31

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| `tableFormat` | `'gfm'` \| `'html'` | — | — | 表ごとの永続化形式（§3） |
| `tablePipeAlignment` | `'aligned'` \| `'compact'` | — | — | GFM パイプ表の区切り配置スタイル（既定 `'aligned'`） |
| `columnAlignment` (`textAlign`) | `'left'` \| `'center'` \| `'right'` \| `null` | — | — | 既定 `null`（未指定）。TipTap `tableHeader` (`th`) / `tableCell` (`td`) の `textAlign` 属性。DOM 描画は CSP 遵守のためインライン `style` を出力せず、`data-align` / `align` 属性＋外部 CSS（`media/editor.css`）で描画（AD-001） |
| `tableOperation` | `'moveRowUp'` \| `'moveRowDown'` \| `'duplicateRow'` \| `'moveColumnLeft'` \| `'moveColumnRight'` \| `'alignLeft'` \| `'alignCenter'` \| `'alignRight'` \| `'alignClear'`（ほか既存操作） | — | — | Table ドロップダウンメニュー、`#table-context-menu`、または表内キーボードショートカットから実行（AD-003, AD-004） |
| `smartPasteInput` (TSV) | `string` (`text/plain`) | 2行×2列（非空トークン間にタブ区切り1個以上） | ソフト上限 100行×20列（超過時警告・保存許可） | 単一行テキストや行頭タブのみのインデントコードは対象外（AD-005, RK-022） |
| `smartPasteInput` (HTML) | `string` (`text/html`) | 有効な行・セル構造を持つ `<table>` | ソフト上限 100行×20列 | `<script>` や `on*` 等の危険要素を除去し、セルテキスト・`<br />`・アライメント属性のみ抽出（AD-005, §9） |
| ペースト文脈・モード | `editorMode` (`'markdown'` \| `'raw'` \| `'preview'`), `readonly`, カーソル位置（コードブロック / インラインコード / 表内外） | — | — | コードブロック・インラインコード内・Readonly・Preview 時はスマートペースト無効（通常ペーストまたはブロックへ委譲 — AD-005） |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 仕様根拠 |
|------|-------------------|---------|
| GFM 表の列アライメント往復 (`tableFormat: 'gfm'`) | mdast `table.align`（`'left'` \| `'center'` \| `'right'` \| `null`）と TipTap 各列セルの `textAlign` 属性を双方向マッピング。デリミタ行を `:---`（left）、`:---:`（center）、`---:`（right）、`---`（null）として出力。`table-formatter.ts`（Aligned / Compact）でもコロン記号を保持・整形 | §3, §8 正常系 13, AD-002 |
| HTML 表の列アライメント往復 (`tableFormat: 'html'`) | パース時に `<th/td align="...">` または `style="text-align: ..."` から `textAlign` を抽出。シリアライズ時は `<th align="center">` / `<td align="right">` 形式で出力。サニタイザ `ALLOWED_ATTR` に `align` / `data-align` を許可 | §3, §8 正常系 13, §9 正常系 2, AD-002, RK-023 |
| 列アライメント一括変更 (`alignLeft` / `alignCenter` / `alignRight` / トグル解除) | カーソルがある列の全行（ヘッダ `th` および全データ行 `td`）の対象列セルの `textAlign` 属性を一括更新。既に同一アライメントの場合は再実行で `null`（未指定）にトグル解除（または `alignClear` で解除）。GFM ⇄ HTML 変換時も `textAlign` を保持 | §3 Outputs, AD-001, AD-002 |
| Webview DOM の CSP 安全描画 | `th` / `td` にインライン `style` を出力せず `data-align` / `align` 属性を付与し、`media/editor.css` の属性セレクタで `text-align` を適用 | §3, §9 正常系 1, AD-001, RK-023 |
| 行移動 (`moveRowUp` / `moveRowDown`) | 対象行を上下の隣接行と 1 トランザクション（Undo/Redo 1 段）で入れ替え、移動先セルにキャレット追随。ヘッダ行（index 0）とデータ行（index 1）が入れ替わる場合は、入れ替え後の index 0 を `tableHeader` (`th`)、index ≥ 1 を `tableCell` (`td`) に自動正規化。先頭行（index 0）での `moveRowUp` および最終行での `moveRowDown` は安全に no-op | §3 Outputs, AD-003 |
| 列移動 (`moveColumnLeft` / `moveColumnRight`) | 対象列（全行の対応セルおよび `textAlign` 属性）を左右の隣接列と 1 トランザクションで入れ替え、移動先セルにキャレット追随。最左列での `moveColumnLeft` および最右列での `moveColumnRight` は安全に no-op | §3 Outputs, AD-003 |
| 行複製 (`duplicateRow`) | カーソルがある行の全セル内容および `textAlign` 属性をコピーし、直下にデータ行（`tableCell` / `td`）として挿入（ヘッダ行 index 0 で実行した場合も直下に `td` 行として挿入）。複製行の対応セルへキャレット追随。1 トランザクションで Undo/Redo 1 段 | §3 Outputs, AD-003 |
| UI メニュー＆ショートカット統合 | Table ドロップダウンおよび `#table-context-menu` に移動・複製・アライメント項目を英語表記で追加。Visual モード表内フォーカス時に `Alt+ArrowUp/Down/Left/Right` および `Shift+Alt+ArrowDown` が発火（`package.json` グローバル keybindings は非汚染）。Readonly / Preview / Raw 時は無効 | §3 Table UI / ショートカット, AD-004 |
| スマートペースト成功（Visual / Source） | 有効な TSV（2行×2列以上）または HTML `<table>` ペースト時、Visual モードでは新規テーブルノード挿入（先頭行 `th`、2行目以降 `td`、`insertTableFormat` 準拠）または表内展開、Source モードでは `tablePipeAlignment`（`'aligned'` \| `'compact'`）に従う GFM パイプ表テキストに変換して挿入 | §3 Outputs, §15, §16, AD-005 |
| スマートペースト発火ガード（誤変換防止） | コードブロック（`codeBlock` / Mermaid / PlantUML / Math フェンス）内、インラインコード内、Readonly / Preview 時、単一行タブ文字列、行頭タブのみのインデントコード、列数不整合テキストは変換せず通常ペーストへ委譲 | §3 スマートペースト 1, AD-005, RK-022 |
| ソフト上限超過（100行×20列） | スマートペーストや行複製等で 100行または 20列を超過した場合、既存のソフト上限警告（`checkTableLimits`）を表示し、編集・保存は継続許可 | §3 Outputs, RK-024 |

### Preconditions & Assumptions

- Custom Editor（`md-wysiwyg-editor.wysiwyg`）がロード済みであり、編集操作時は非 Readonly（`readonly === false`）かつ編集モード（Visual `markdown` または Source `raw`）であること
- 行/列の移動・複製・列アライメント変更は、カーソルが対象テーブル内にあること
- Webview CSP は `style-src ${webview.cspSource} 'nonce-${nonce}'` を維持し、`'unsafe-inline'` を許可しないこと（§9）

### Complexity Budget

- **表サイズ上限:** ソフト上限 $R \le 100$ 行、$C \le 20$ 列（総セル数 $R \times C \le 2,000$）
- **許容計算量:**
  - 列アライメント一括更新・行/列入れ替え・行複製: $O(R \times C)$（最大 2,000 セル走査で数ミリ秒未満）
  - GFM シリアライズ・`formatMarkdownTable`・TSV/HTML スマートペースト変換: $O(R \times C \times L)$（$L$ はセル平均文字列長）
- **想定アルゴリズム family:** 2D 配列（TipTap `tableRow` / `tableCell` 木構造および Markdown 行/列マトリクス）の線形走査・不変（immutable）変換

### Spec Gaps

- なし（`temporary/requirements-brief-table-rich-editing.md` の AD-001〜AD-005 および `doc/requirements/systemspec.md` §3 / §8 / §9 / §15 / §16 で全項目確定済み、`user_decisions_required: 0`）

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-TRE-001 | Happy | gfm-align-roundtrip | P0 | GFM パイプ表 `\| L \| C \| R \| N \|\n\| :--- \| :---: \| ---: \| --- \|\n\| a \| b \| c \| d \|` を `parseMarkdown` → `serializeMarkdown`（aligned & compact） | パース後の全行（`th` および `td`）の各列セル `attrs.textAlign` が順に `'left'`, `'center'`, `'right'`, `undefined/null` になり、再シリアライズでデリミタ行 `:---`, `:---:`, `---:`, `---` が保持される | GFM 列アライメントの parse/serialize 双方向往復を保証 | §3, §8 正常系 13, AD-002 |
| TC-TRE-002 | Happy | html-align-roundtrip | P0 | HTML 表 `<table><tr><th align="left">H1</th><th style="text-align: center">H2</th><th align="right">H3</th></tr><tr><td align="left">A</td><td style="text-align: center">B</td><td align="right">C</td></tr></table>` を `parseMarkdown` → `serializeMarkdown` | パース時に `align` 属性および `style="text-align:..."` の双方から `attrs.textAlign`（`'left'`, `'center'`, `'right'`）が抽出され、再シリアライズ時に `<th align="left">`, `<th align="center">`, `<td align="right">` 等として出力される（`sanitizeHtml` も `align` / `data-align` を除去しない） | HTML 表の列アライメント抽出・CSP 安全な正規化・永続化を保証 | §3, §8 正常系 13, §9 正常系 2, AD-002, RK-023 |
| TC-TRE-003 | Happy | column-align-bulk-toggle | P0 | 3行×3列のテーブルで列 index 1 に対して `setColumnAlignment(table, 1, 'center')` を適用し、続けて再度 `'center'`（トグル）および `'right'` を適用 | 1回目で列 index 1 の全行（ヘッダ `th` + 全データ行 `td`）の `attrs.textAlign` が `'center'` に一括更新される。同一アライメント再適用（または `'clear'` / `null`）で全行の該当列が `null`/未指定に解除され、別アライメント指定で `'right'` に更新される | 列単位の一括アライメント更新とトグル解除契約を検証 | §3 Outputs, AD-001, AD-002 |
| TC-TRE-004 | Happy | align-format-conversion | P1 | 列アライメント（left / center / right）が設定された表を `convertTableToHtml`（GFM→HTML）および `convertTableToGfm`（HTML→GFM）で相互変換後シリアライズ | GFM→HTML 変換後も各セルの `textAlign` が維持され `<th/td align="...">` が出力される。HTML→GFM 変換（セル flatten 含む）後も `textAlign` が維持されデリミタ行 `:---`, `:---:`, `---:` が出力される | GFM ⇄ HTML 形式変換で列アライメントが欠落しないことを検証 | §3 Outputs, AD-002 |
| TC-TRE-005 | Happy | move-row-up-down | P0 | ヘッダ行 `H` + データ行 `R1`, `R2`, `R3` の表で、`R2`（rowIndex 2）にカーソルを置いて `moveRowUp`、および `R1`（rowIndex 1）で `moveRowDown` を実行 | `moveRowUp` で行順序が `[H, R2, R1, R3]` になり移動先行（index 1）の対応列にキャレットが追随する。`moveRowDown` で `[H, R1, R2, R3]` に戻り移動先行（index 2）にキャレットが追随する | データ行同士の上下移動とキャレット追随の基本動作を固定 | §3 Outputs, AD-003 |
| TC-TRE-006 | Structural | move-row-header-normalization | P0 | ヘッダ行 `H`（rowIndex 0, `tableHeader`）とデータ行 `R1`（rowIndex 1, `tableCell`）を持つ表で、`R1` を `moveRowUp`（または `H` を `moveRowDown`）して先頭行と入れ替え | 行順序が `[R1, H, ...]` となり、新しい先頭行（index 0: 旧 `R1`）の全セルが `tableHeader` (`th`) に、新しい2行目（index 1: 旧 `H`）の全セルが `tableCell` (`td`) に正規化され、各セルのテキスト・`textAlign` 属性は欠損せず保持される | ヘッダ行とデータ行の入れ替え時の `th` ⇄ `td` 正規化と GFM シリアライズ整合を保証 | §3 Outputs, AD-003 |
| TC-TRE-007 | Boundary | move-row-boundary-noop | P1 | 先頭行（rowIndex 0）で `moveRowUp` を実行、および最終行（rowIndex = N-1）で `moveRowDown` を実行 | いずれも例外を投げず no-op（表構造・セル内容・変更フラグ不変）として安全に終了する | 上端・下端行での境界アクセス防止（オフバイワン対策） | §3 例外系 5, AD-003 |
| TC-TRE-008 | Happy | move-column-left-right | P0 | 3列 `[Col0(left), Col1(center), Col2(right)]` の表で、colIndex 1 で `moveColumnLeft`、続けて colIndex 0 で `moveColumnRight` を実行 | `moveColumnLeft` で全行（ヘッダ行＋全データ行）のセルおよび `textAlign` 属性が `[Col1(center), Col0(left), Col2(right)]` の順に入れ替わり、移動先列（colIndex 0）へキャレットが追随する。`moveColumnRight` で元の順序に戻る | 列単位の左右入れ替え（全行セル＋列アライメント追随）を検証 | §3 Outputs, AD-003 |
| TC-TRE-009 | Boundary | move-column-boundary-noop | P1 | 最左列（colIndex 0）で `moveColumnLeft` を実行、および最右列（colIndex = M-1）で `moveColumnRight` を実行 | いずれも例外を投げず no-op（表構造・セル内容・アライメント不変）として安全に終了する | 左端・右端列での境界アクセス防止 | §3 例外系 5, AD-003 |
| TC-TRE-010 | Happy | duplicate-row | P0 | ヘッダ行（rowIndex 0, `th`, `textAlign: 'center'`）およびデータ行（rowIndex 1, `td`, `textAlign: 'right'`）のそれぞれで `duplicateRow` を実行 | データ行での実行時は直下（rowIndex 2）に同一セル内容・同一 `textAlign` を持つ `tableCell` (`td`) 行が挿入される。ヘッダ行（rowIndex 0）での実行時も直下（rowIndex 1）に同一内容・同一 `textAlign` を持つ **データ行（`tableCell` / `td`）** が挿入され、先頭行のみが `th` のまま保たれる。キャレットは複製行の対応セルへ移動する | データ行およびヘッダ行からの行複製契約（常に `td` として直下に複製）を保証 | §3 Outputs, AD-003 |
| TC-TRE-011 | Happy | ui-menus-shortcuts-csp | P0 | `markdown-editor-provider.ts`（Table メニュー・`#table-context-menu` HTML）、`media/editor.ts`（コマンド・ショートカット・DOM 属性描画）、`media/editor.css`（アライメント CSS）、`package.json` を検証 | ① Table メニューと `#table-context-menu` の双方に `moveRowUp`, `moveRowDown`, `duplicateRow`, `moveColumnLeft`, `moveColumnRight`, `alignLeft`, `alignCenter`, `alignRight` が英語ラベル付きで存在する。<br>② `media/editor.ts` に表内ショートカット `Alt+ArrowUp/Down/Left/Right`, `Shift+Alt+ArrowDown` が実装され、`package.json` のグローバル `keybindings` は汚染されていない。<br>③ `media/editor.css` に `[data-align="left/center/right"]` または `[align="..."]` セレクタが定義され、Webview CSP に `'unsafe-inline'` が追加されていない | UI メニュー・ショートカット・CSP 安全描画の契約統合を検証 | §3, §9, AD-001, AD-004 |
| TC-TRE-012 | Happy | smart-paste-tsv | P0 | 2行×3列の TSV 文字列 `"Name\tRole\tScore\nAlice\tDev\t95\nBob\tQA\t88"` をスマートペースト判定・変換（Source モード aligned / compact、および Visual モード ` TipTap` テーブル生成） | TSV スマートペースト対象と判定（`true`）され、Source モードでは `tablePipeAlignment` に応じた GFM パイプ表テキストに変換、Visual モードでは先頭行 `tableHeader` (`th`)・2行目以降 `tableCell` (`td`) の TipTap `table` ノード（`tableFormat: insertTableFormat`）に変換される | Excel / スプレッドシートからの TSV スマートペースト基本動作を保証 | §3 スマートペースト, §15, §16, AD-005 |
| TC-TRE-013 | Happy | smart-paste-html-table | P0 | クリップボードの `text/html`（例: `<table><tr><th align="center">Item</th><th style="text-align: right">Price</th></tr><tr><td>Book<br>Note</td><td style="text-align: right">$10<script>alert(1)</script></td></tr></table>`）をスマートペースト変換 | `<script>` や `on*` 等の危険要素がサニタイズ除去され、セル内 `<br>` は改行（`<br />` / `hardBreak`）、アライメント（`center`, `right`）は `textAlign` / GFM デリミタ行（`:---:`, `---:`）として保持された状態で TipTap テーブルまたは GFM パイプ表に変換される | HTML `<table>` スマートペーストの変換精度・アライメント抽出・XSS 防御を保証 | §3 スマートペースト, §9, AD-005 |
| TC-TRE-014 | Corner | smart-paste-guards-false-positive | P0 | 以下の非テーブル入力をスマートペースト判定に渡す:<br>① 単一行タブ混じり `"hello\tworld"`<br>② 行頭タブのみのインデントコード `"\tconst a = 1;\n\tconst b = 2;"`<br>③ タブを含まない複数行テキスト `"line1\nline2"`<br>④ 列数がバラバラな非表テキスト `"a\tb\tc\nd\n1\t2\t3\t4"`<br>⑤ コードブロック / インラインコード内・Readonly / Preview モード文脈 | すべてスマートペースト対象外（`false` / `null`）と判定され、テーブル変換を行わず通常ペーストへ委譲される | ソースコード貼り付けや通常テキスト貼り付け時の誤テーブル化（RK-022）を防止 | §3 スマートペースト 1, AD-005, RK-022 |
| TC-TRE-015 | Boundary | smart-paste-min-2x2-and-quotes | P1 | 最小構成の 2行×2列 TSV `"H1\tH2\nD1\tD2"`、および RFC 4180 ダブルクォート内改行を含む TSV `"H1\tH2\n\"Line1\nLine2\"\tVal2"` をスマートペースト変換 | 2行×2列が正常にテーブル変換され、クォート内改行はセル内 `<br />`（単一改行）として1セル内に保持される（行分裂しない） | 最小 2×2 境界およびセル内改行付き TSV の RFC 4180 整合を検証 | §3 Inputs, §16, AD-005 |
| TC-TRE-016 | Boundary | table-soft-limit-warning | P1 | スマートペーストまたは行複製により 101行×3列（または 5行×21列）の表を生成し `checkTableLimits` を評価 | `exceeded === true` となりソフト上限警告メッセージが返されるが、データ自体は切り捨てられず変換・保持される | 大規模スプレッドシート貼り付け時のソフト上限警告（100行×20列 — RK-024）を検証 | §3 Outputs, RK-024 |
| TC-TRE-017 | Corner | readonly-and-mode-guards | P1 | `readonly === true` または `editorMode === 'preview'` の状態で、Table メニュー操作・右クリックメニュー表示・表内移動ショートカット・スマートペーストを実行 | すべての編集・移動・アライメント変更・スマートペーストがガードにより拒否（無効化 / no-op）され、Document は変更されない | ファイル Readonly（§4）および Preview 厳密 RO（§1）の保護契約を検証 | §1, §3 Outputs, §4, AD-004, AD-005 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-TRE-001, TC-TRE-002, TC-TRE-003, TC-TRE-004, TC-TRE-005, TC-TRE-008, TC-TRE-010, TC-TRE-011, TC-TRE-012, TC-TRE-013 | — |
| Boundary | TC-TRE-007, TC-TRE-009, TC-TRE-015, TC-TRE-016 | — |
| Structural | TC-TRE-006 | — |
| Corner | TC-TRE-014, TC-TRE-017 | — |
| Stress | — | 表のソフト上限（100行×20列）境界は TC-TRE-016（P1）で検証済み。10^5 規模の入力は仕様スコープ外（大ファイル全般は既存 TC-008/066） |

### Complexity Notes

- 制約: ソフト上限 $R \le 100$ 行、$C \le 20$ 列
- 想定計算量: 行/列移動・複製・アライメント更新は $O(R \times C)$、TSV/HTML パース・整形は入力文字数 $N$ に対して $O(N)$
- HTTP API / Worker ドメイン: N/A（ローカル完結の VS Code 拡張機能）

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR で常時実行） | `test_single`: `npm run test:unit -- --grep 'TC-TRE-'` |
| P2 | — | 本 testspec に P2 なし（100×20 上限境界は P1 TC-TRE-016 で高速実行可能） |

想定テストファイル配置: `src/test/suite/unit/table-rich-editing.test.ts`（`.cursor/stack.md` の `test_file_glob: "src/test/suite/**/*.test.ts"` に準拠）

---

## Trace Results

> Phase 3 机上トレース（テストコード実装・実行結果は後続の `testspec-implementation` / `build-agent` フェーズで記録）。

### TC-TRE-001 (P0): GFM パイプ表の列アライメント往復

| Step | State / Action | Value |
|------|----------------|-------|
| Input | Markdown 文字列 | `\| L \| C \| R \| N \|\n\| :--- \| :---: \| ---: \| --- \|\n\| a \| b \| c \| d \|` |
| 1 | `parseMarkdown(md)` | mdast `table.align` `['left', 'center', 'right', null]` から各行のセル `attrs.textAlign` に `'left'`, `'center'`, `'right'`（`null` は属性省略または `null`）をマッピング。**注意:** 編集でセル内容や `textAlign` が変わった場合、または初回往復でもデリミタ行のコロンが維持される |
| 2 | `serializeMarkdown(doc, { tablePipeAlignment: 'compact' })` | `tipTapTableToMdast` が先頭行（または列）の `textAlign` から mdast `table.align = ['left', 'center', 'right', null]` を構築し、`gfmTableToMarkdown` が `\| :--- \| :---: \| ---: \| --- \|` を出力 |
| Output | 最終 Markdown | デリミタ行に `:---`, `:---:`, `---:`, `---` を保持した GFM パイプ表 |

**Result:** ✅ 机上トレース Pass（仕様 §3 / §8 正常系 13 と一致）

---

### TC-TRE-002 (P0): HTML 表の列アライメント往復とサニタイズ保持

| Step | State / Action | Value |
|------|----------------|-------|
| Input | HTML 表を含む Markdown | `<table><tr><th align="left">H1</th><th style="text-align: center">H2</th><th align="right">H3</th></tr><tr><td align="left">A</td><td style="text-align: center">B</td><td align="right">C</td></tr></table>` |
| 1 | `sanitizeHtml` / `parseHtmlTableToTipTap` | `<th/td>` の `align` 属性または `style="text-align: ..."` から `'left' \| 'center' \| 'right'` を抽出し、TipTap セル `attrs.textAlign` に設定 |
| 2 | `tipTapTableToHtml` → `sanitizeHtml` | `cell.attrs?.textAlign` がある場合 `<th align="left">`, `<th align="center">`, `<td align="right">` を出力し、`sanitizeHtml` の `ALLOWED_ATTR`（`align`, `data-align` 追加）を通過 |
| Output | 最終 HTML 表 | `<th align="left">H1</th>`, `<th align="center">H2</th>`, `<th align="right">H3</th>` 等を含む HTML `<table>` |

**Result:** ✅ 机上トレース Pass（仕様 §3 / §9 正常系 2 / RK-023 と一致）

---

### TC-TRE-003 (P0): 列アライメント一括更新とトグル解除

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 3×3 TipTap `table` ノード、対象 `colIndex = 1` | 初期 `textAlign` は全セル未指定（`null` / `undefined`） |
| 1 | `setColumnAlignment(table, 1, 'center')`（またはトグル関数） | 全行（row 0 `th`, row 1 `td`, row 2 `td`）の `colIndex === 1` のセル `attrs.textAlign` が `'center'` に更新される（col 0, col 2 は不変） |
| 2 | 再度同列に `'center'` をトグル適用 | 既に現在列が `'center'` のため `textAlign` が `null`（未指定）に解除される |
| Output | 更新後 `table` ノード | 列全体の `textAlign` が一貫して更新・解除される |

**Result:** ✅ 机上トレース Pass（仕様 §3 Outputs / AD-001, AD-002 と一致）

---

### TC-TRE-004 (P1): GFM ⇄ HTML 形式変換時の列アライメント保持

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 列アライメント `['left', 'center', 'right']` を持つ GFM 表 | `tableFormat: 'gfm'` |
| 1 | `convertTableToHtml(doc, 0)` → `serializeMarkdown` | `tableFormat: 'html'` となり、`<th align="left">`, `<th align="center">`, `<th align="right">` が出力される |
| 2 | `convertTableToGfm(htmlDoc, 0)` → `serializeMarkdown` | `flattenCellContent` 実行時もセルの `attrs.textAlign` が維持され、`| :--- | :---: | ---: |` が出力される |
| Output | 変換後 Markdown | 両方向の形式変換で列アライメントが欠落しない |

**Result:** ✅ 机上トレース Pass（仕様 §3 Outputs / AD-002 と一致）

---

### TC-TRE-005 (P0): データ行の上下移動 (`moveRowUp` / `moveRowDown`)

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 4行 `[H, R1, R2, R3]` の表、`rowIndex = 2` (`R2`) | — |
| 1 | `moveRowUp` 実行 | `rowIndex = 2` と `rowIndex = 1` を入れ替え。行順序は `[H, R2, R1, R3]`、新しい選択行は `1` |
| 2 | `rowIndex = 1` で `moveRowDown` 実行 | `rowIndex = 1` と `rowIndex = 2` を入れ替え。行順序は `[H, R1, R2, R3]`、新しい選択行は `2` |
| Output | 更新後テーブル & 移動先インデックス | データ欠損なく行が入れ替わり、移動先行が返る |

**Result:** ✅ 机上トレース Pass（仕様 §3 Outputs / AD-003 と一致）

---

### TC-TRE-006 (P0): ヘッダ行とデータ行の入れ替え時の `th` ⇄ `td` 正規化

| Step | State / Action | Value |
|------|----------------|-------|
| Input | row 0 (`th`: `["H1", "H2"]`), row 1 (`td`: `["A1", "A2"]`), row 2 (`td`: `["B1", "B2"]`) | `rowIndex = 1` で `moveRowUp`（または `rowIndex = 0` で `moveRowDown`） |
| 1 | 行入れ替え + セル種別正規化 | row 0 と row 1 の順序を入れ替えた後、index 0 の全セルを `type: 'tableHeader'` (`th`) に、index ≥ 1 の全セルを `type: 'tableCell'` (`td`) に正規化する |
| Output | 正規化後テーブル | row 0 が `["A1", "A2"]` (`th`)、row 1 が `["H1", "H2"]` (`td`)、row 2 が `["B1", "B2"]` (`td`) となり、GFM シリアライズでも先頭行がヘッダとして正しく出力される |

**Result:** ✅ 机上トレース Pass（仕様 §3 Outputs / AD-003 と一致）

---

### TC-TRE-007 (P1): 行移動の上端・下端 no-op

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 3行の表 | `rowIndex = 0` で `moveRowUp`、`rowIndex = 2` で `moveRowDown` |
| Output | 戻り値 / 状態 | 変更なし（`moved: false` または同一構造）、例外なし |

**Result:** ✅ 机上トレース Pass（仕様 §3 例外系 5 / AD-003 と一致）

---

### TC-TRE-008 (P0): 列の左右移動 (`moveColumnLeft` / `moveColumnRight`)

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 3列 `[C0(left), C1(center), C2(right)]` の表、`colIndex = 1` | — |
| 1 | `moveColumnLeft` 実行 | 全行で col 1 と col 0 のセル（`content` および `attrs.textAlign`）が入れ替わり、`[C1(center), C0(left), C2(right)]` となる。移動先 `colIndex = 0` |
| 2 | `colIndex = 0` で `moveColumnRight` 実行 | 全行で col 0 と col 1 が入れ替わり、元の `[C0(left), C1(center), C2(right)]` に戻る。移動先 `colIndex = 1` |
| Output | 更新後テーブル & 移動先列インデックス | 全行のセルと列アライメントが整合したまま入れ替わる |

**Result:** ✅ 机上トレース Pass（仕様 §3 Outputs / AD-003 と一致）

---

### TC-TRE-009 (P1): 列移動の左端・右端 no-op

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 3列の表 | `colIndex = 0` で `moveColumnLeft`、`colIndex = 2` で `moveColumnRight` |
| Output | 戻り値 / 状態 | 変更なし（no-op）、例外なし |

**Result:** ✅ 机上トレース Pass（仕様 §3 例外系 5 / AD-003 と一致）

---

### TC-TRE-010 (P0): 行複製 (`duplicateRow`)

| Step | State / Action | Value |
|------|----------------|-------|
| Input | row 0 (`th`, `textAlign: 'center'`, `"Header"`), row 1 (`td`, `textAlign: 'right'`, `"Data1"`) | — |
| 1 | `rowIndex = 1`（データ行）で `duplicateRow` | row 2 に `type: 'tableCell'` (`td`), `textAlign: 'right'`, `"Data1"` のディープコピー行が挿入される。移動先 `rowIndex = 2` |
| 2 | `rowIndex = 0`（ヘッダ行）で `duplicateRow` | row 1 に **`type: 'tableCell'` (`td`)**, `textAlign: 'center'`, `"Header"` の行が挿入される（row 0 のみ `th` を維持）。移動先 `rowIndex = 1` |
| Output | 更新後テーブル | セル内容と `textAlign` を保持したデータ行（`td`）が直下に挿入される |

**Result:** ✅ 机上トレース Pass（仕様 §3 Outputs / AD-003 と一致）

---

### TC-TRE-011 (P0): UI メニュー・ショートカット・CSP 安全描画契約

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `markdown-editor-provider.ts`, `media/editor.ts`, `media/editor.css`, `package.json` | ソース・DOM 構造検査 |
| 1 | Table メニュー & `#table-context-menu` | `moveRowUp` (`Move row up`), `moveRowDown` (`Move row down`), `duplicateRow` (`Duplicate row`), `moveColumnLeft` (`Move column left`), `moveColumnRight` (`Move column right`), `alignLeft` (`Align Left`), `alignCenter` (`Align Center`), `alignRight` (`Align Right`) が双方に存在 |
| 2 | ショートカット & `package.json` | `media/editor.ts` で `Alt+ArrowUp/Down/Left/Right` と `Shift+Alt+ArrowDown` を処理。`package.json` の `contributes.keybindings` には追加しない |
| 3 | CSP & CSS | `media/editor.css` に `[data-align="left/center/right"]`（および `[align="..."]`）の `text-align` ルールが存在し、CSP `style-src` に `'unsafe-inline'` がない |
| Output | 契約検証結果 | 全項目一致 |

**Result:** ✅ 机上トレース Pass（仕様 §3 / §9 / AD-001, AD-004 と一致）

---

### TC-TRE-012 (P0): TSV スマートペースト（Visual / Source）

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `text/plain`: `"Name\tRole\tScore\nAlice\tDev\t95\nBob\tQA\t88"` | 3行×3列 TSV |
| 1 | TSV 判定 | 2行以上、全行に非空トークン間のタブがあり列数（3列）が一致 → 有効な TSV と判定 |
| 2 | Source モード変換 | `tablePipeAlignment: 'aligned'` または `'compact'` に従い、ヘッダ行 `Name \| Role \| Score` + デリミタ行 + データ2行の GFM パイプ表文字列を生成 |
| 3 | Visual モード変換 | `tableFormat: insertTableFormat`、row 0 が `tableHeader` (`th`)、row 1–2 が `tableCell` (`td`) の TipTap `table` ノードを生成 |
| Output | 変換結果 | Source / Visual 両モードで即座にテーブルとして挿入可能 |

**Result:** ✅ 机上トレース Pass（仕様 §3 スマートペースト / AD-005 と一致）

---

### TC-TRE-013 (P0): HTML `<table>` スマートペーストと XSS サニタイズ

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `text/html`: `<table><tr><th align="center">Item</th><th style="text-align: right">Price</th></tr><tr><td>Book<br>Note</td><td style="text-align: right" onclick="evil()">$10<script>alert(1)</script></td></tr></table>` | クリップボード HTML |
| 1 | サニタイズ & パース | `<script>` と `onclick` を除去。1列目 `textAlign: 'center'`、2列目 `textAlign: 'right'`、セル内 `<br>` を改行（`<br />` / `hardBreak`）として抽出 |
| 2 | Visual / Source 変換 | Visual では `textAlign` 付き TipTap `table` ノード、Source では `\| :---: \| ---: \|` デリミタ行と `Book<br />Note` を持つ GFM パイプ表テキストを生成 |
| Output | 変換結果 | スクリプトやイベントハンドラを含まず、改行とアライメントを保持したテーブル |

**Result:** ✅ 机上トレース Pass（仕様 §3 スマートペースト / §9 / AD-005 と一致）

---

### TC-TRE-014 (P0): スマートペースト発火ガード（誤変換防止）

| Step | State / Action | Value |
|------|----------------|-------|
| Input | ① `"hello\tworld"`（1行）<br>② `"\tconst a = 1;\n\tconst b = 2;"`（行頭タブのみのコード）<br>③ `"line1\nline2"`（タブなし）<br>④ `"a\tb\tc\nd\n1\t2\t3\t4"`（列数不一致・1列行混在）<br>⑤ `inCodeBlock: true` / `inInlineCode: true` / `readonly: true` / `editorMode: 'preview'` | 各種ガード対象入力 |
| 1 | スマートペースト判定実行 | いずれもガード条件に該当し `false` / `null` を返す |
| Output | 判定結果 | テーブル変換を行わず通常ペーストへ委譲（誤変換ゼロ） |

**Result:** ✅ 机上トレース Pass（仕様 §3 スマートペースト 1 / AD-005 / RK-022 と一致）

---

### TC-TRE-015〜017 (P1): 境界値・ソフト上限・Readonly ガード要約

| ID | Priority | Expected summary |
|----|----------|------------------|
| TC-TRE-015 | P1 | 最小 2行×2列 TSV および RFC 4180 クォート内改行を含む TSV がセル内 `<br />` 付きで正しくテーブル変換される |
| TC-TRE-016 | P1 | 101行×3列または 5行×21列の表で `checkTableLimits` が警告（`exceeded: true`）を返し、データは欠損しない |
| TC-TRE-017 | P1 | `readonly: true` または `editorMode !== 'markdown'`（Source ペースト除く Preview 等）で全テーブル編集・移動・スマートペーストが無効化される |

**Result:** ✅ 机上トレース Pass

---

### Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-TRE-001〜003, 005〜006, 008, 010〜014 | P0 | ✅ Pass (`src/test/suite/unit/table-rich-editing.test.ts` Green) | 10 P0 TCs — 実装・単体テスト Pass 確認済み |
| TC-TRE-004, 007, 009, 015〜017 | P1 | ✅ Pass (`src/test/suite/unit/table-rich-editing.test.ts` Green) | 7 P1 TCs — 境界・変換・ガード網羅、単体テスト Pass 確認済み |

---

## Self-Check Report

### A. Input & Constraints

- [x] **最小値 / 空の入力:** 最小 2行×2列 TSV 境界（TC-TRE-015）、1行や空・タブなし入力のスマートペースト拒否（TC-TRE-014）、アライメント未指定 `null`（TC-TRE-001, TC-TRE-003）を定義済み。
- [x] **最大値 / オーバーフロー:** ソフト上限 100行×20列超過時の警告とデータ保持（TC-TRE-016）を定義済み。数値オーバーフローは非該当。
- [x] **符号・型:** `textAlign` の列挙型（`'left' | 'center' | 'right' | null`）、`tableFormat`（`'gfm' | 'html'`）、`tablePipeAlignment`（`'aligned' | 'compact'`）を網羅。

### B. Structural Patterns

- [x] **全要素同一 / 偏り:** 同一アライメントの再適用によるトグル解除（TC-TRE-003）、全行の同一列一括更新（TC-TRE-003, TC-TRE-008）をカバー。
- [x] **順序・ソート:** 行の上下入れ替え（TC-TRE-005）、ヘッダ行とデータ行の入れ替え時の `th` ⇄ `td` 正規化（TC-TRE-006）、列の左右入れ替え（TC-TRE-008）、行複製時の直下挿入（TC-TRE-010）をカバー。
- [x] **非連結・サイクル:** N/A — グラフ探索非該当。

### C. Corner & Failure

- [x] **解が存在しない場合 / ガード拒否:** コードブロック内・インラインコード内・行頭タブインデントコード・単一行タブ・列数不整合時のスマートペースト非発火（TC-TRE-014）、Readonly / Preview 時の操作拒否（TC-TRE-017）、XSS 危険タグ除去（TC-TRE-013）をカバー。
- [x] **先頭・末尾のアクセス:** 先頭行（index 0）での `moveRowUp` no-op、最終行（index N-1）での `moveRowDown` no-op（TC-TRE-007）、最左列（index 0）での `moveColumnLeft` no-op、最右列（index M-1）での `moveColumnRight` no-op（TC-TRE-009）、先頭行（ヘッダ index 0）での `duplicateRow`（TC-TRE-010）および先頭行との入れ替え（TC-TRE-006）をすべてカバー。

### D. Complexity & Resources

- [x] **時間計算量:** 表サイズ上限 100×20 に対して $O(R \times C)$ の線形処理であり、ミリ秒単位で完了。
- [x] **スタック深度:** N/A — 深い再帰処理なし（テーブルの深さは `table` → `tableRow` → `tableCell` の固定階層）。

### E. API / Worker（該当時）

- [x] **HTTP ステータス:** N/A — ローカル VS Code 拡張機能。
- [x] **認証・認可:** N/A — 外部通信・認証なし。Webview CSP（`'unsafe-inline'` 禁止）と HTML サニタイズは TC-TRE-002, TC-TRE-011, TC-TRE-013 で検証。
- [x] **外部依存失敗:** N/A — 外部ネットワーク依存なし。
- [x] **空 body / 不正 JSON:** 不正な表構文・列数不一致・非テーブルテキストのフォールバックを TC-TRE-014 で検証。

### Uncovered / Spec Gaps

- なし（全 AD-001〜AD-005 および RK-001〜RK-003 を TC-TRE-001〜017 にマッピング済み）。

### AD-* Traceability（`table-rich-editing`）

| AD / Risk | 内容 | 対応 TC |
|-----------|------|---------|
| AD-001 | 列アライメント内部モデル（`textAlign`）と CSP 安全な DOM 描画（`data-align` / `align` + CSS） | TC-TRE-001, TC-TRE-002, TC-TRE-003, TC-TRE-011 |
| AD-002 | GFM / HTML 表のアライメント往復シリアライズ・Table Formatter 統合・列単位一括更新 | TC-TRE-001, TC-TRE-002, TC-TRE-003, TC-TRE-004 |
| AD-003 | 行・列の入れ替え（`moveRowUp/Down`, `moveColumnLeft/Right`）・行複製（`duplicateRow`）・ヘッダ `th/td` 正規化・端 no-op | TC-TRE-005, TC-TRE-006, TC-TRE-007, TC-TRE-008, TC-TRE-009, TC-TRE-010 |
| AD-004 | UI 導線（Table ツールバー・`#table-context-menu`・`Alt+矢印` / `Shift+Alt+Down` ショートカット・RO/Preview ガード） | TC-TRE-011, TC-TRE-017 |
| AD-005 | スマートペースト（TSV 2×2 以上 / HTML `<table>` の Visual / Source 挿入・発火ガード） | TC-TRE-012, TC-TRE-013, TC-TRE-014, TC-TRE-015, TC-TRE-017 |
| RK-001 / RK-022 | タブインデントされたコード等の TSV 誤変換防止 | TC-TRE-014 |
| RK-002 / RK-023 | HTML `style="text-align: ..."` の `textAlign` 正規化と CSP 遵守 | TC-TRE-002, TC-TRE-011, TC-TRE-013 |
| RK-003 / RK-024 | 大規模スプレッドシート貼り付け時のソフト上限（100行×20列）警告 | TC-TRE-016 |

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-10-31 | 初版作成（`table-rich-editing` Phase 1〜3: Spec Digest、Test Matrix TC-TRE-001〜017、机上トレース、Self-Check Report） |
| 2026-10-31 | `testspec-implementation`: `src/test/suite/unit/table-rich-editing.test.ts` に TC-TRE-001〜017（17件）を実装、`src/test/unit-entry.ts` に登録し TDD Red 動作を確認 |
| 2026-11-01 | `review-agent`: 全 17 TC（P0 10件・P1 7件）の TDD Green / Pass 状態を Trace Results Summary に反映 |
