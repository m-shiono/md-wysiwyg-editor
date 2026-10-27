# Test Specification: table-csv-and-backlog-conversion

CSV/TSV ⇄ Markdown 表形式の相互変換、および Backlog 形式（表・見出し・リスト・コード等を含むドキュメント記法）のコピー＆ペースト連携の振る舞い検証仕様。

- **対応仕様:** [doc/requirements/systemspec.md](../requirements/systemspec.md) §16
- **テストコード:**
  - `src/test/suite/unit/csv-converter.test.ts`
  - `src/test/suite/unit/backlog-converter.test.ts`
  - `src/test/suite/unit/table-csv-backlog-commands.test.ts`

## Test Matrix

| TC ID | 区分 | 項目 | 入力・条件 | 期待結果 (Expected) |
|---|---|---|---|---|
| `TC-CSV-001` | P0 | 基本的な CSV → Markdown 表変換 | カンマ区切りのテキスト（ヘッダ＋データ行） | ヘッダ行、アライメント行（`\| --- \|`）、データ行からなる整列済み Markdown テーブルが出力される |
| `TC-CSV-002` | P0 | TSV（タブ区切り）自動判別変換 | タブ文字を含む表形式テキスト（スプレッドシート等からコピー） | 区切り文字がタブと判定され、正しく Markdown テーブルに変換される |
| `TC-CSV-003` | P0 | RFC 4180 クォート・エスケープ処理 | カンマ、改行、二重引用符（`""`）をクォート内に含む CSV | クォートが解除され、改行は `<br />` に正規化され、二重引用符は単一の `"` としてセル内に反映される |
| `TC-CSV-004` | P0 | Markdown 表 → CSV 変換 | 標準的な Markdown テーブル | カンマ区切りの CSV テキストが出力される。カンマや改行、`"` を含むセルは `"` で適切に囲まれる |
| `TC-CSV-005` | P1 | Markdown 内エスケープパイプ `\|` の CSV 変換 | セル内に `\|` を含む Markdown 表 | パイプ記号がエスケープ解除され、通常の文字 `|` として CSV のセル値に出力される |
| `TC-CSV-006` | P1 | 不揃いな列数・空行の安全な補正 | 行ごとに列数が異なる CSV または末尾の空行 | 最大列数に合わせて不足セルが空文字で補完され、余計な空行は無視されて整形式テーブルが出力される |
| `TC-BL-001` | P0 | Markdown 表 → Backlog 表変換 | Markdown テーブル（アライメント指定あり） | ヘッダ行末尾に `\|h` が付与され、デリミタ行は除去され、セル配置が `LEFT:` / `CENTER:` / `RIGHT:` 接頭辞に変換される |
| `TC-BL-002` | P0 | Backlog 表 → Markdown 表変換 | Backlog テーブル（`\|h` および `LEFT:` 等の配置指定あり） | GFM Markdown テーブルに変換され、アライメント行（`\|:---\|` 等）が復元される |
| `TC-BL-003` | P0 | Backlog ⇄ Markdown 見出し・リスト変換 | 見出し（`#` ⇄ `*`）、箇条書き（`-` ⇄ `-`/`--`）、番号リスト（`1.` ⇄ `+`/`++`） | 階層構造が維持され、相互に正確な構文へ変換される |
| `TC-BL-004` | P0 | Backlog ⇄ Markdown コードブロック変換 | ````lang ... ```` ⇄ `{code:lang} ... {/code}` | 言語識別子および内部コードが保護され、相互に変換される |
| `TC-BL-005` | P1 | Backlog ⇄ Markdown 装飾・引用・リンク変換 | `**太字**` ⇄ `''太字''`、`~~取消~~` ⇄ `%%取消%%`、`>` ⇄ `>>`、`[名前](URL)` ⇄ `[[名前>URL]]` | 各インライン装飾記法が正しくマッピングされる |
| `TC-BL-006` | P1 | 表を含む複合ドキュメントの往復変換 | 見出し、リスト、コードブロック、表が混在する Markdown | Backlog 形式へ一括変換され、Backlog から Markdown への逆変換でも構文が維持される |
| `TC-CMD-001` | P0 | コマンド: CSV/TSV から Markdown 表置換 | エディタで選択された CSV/TSV 文字列 | 選択範囲が Markdown テーブルに置換される |
| `TC-CMD-002` | P0 | コマンド: Markdown 表から CSV 置換 | カーソルが位置する Markdown テーブルブロック | テーブルブロックが CSV テキストに置換される |
| `TC-CMD-003` | P1 | コマンド: Copy Table as CSV | カーソルが位置する Markdown テーブル | クリップボードに CSV テキストが格納される |
| `TC-CMD-004` | P0 | コマンド: Copy as Backlog Format | テキスト選択（またはカーソル位置の表） | クリップボードに Backlog 記法テキストが格納される |
| `TC-CMD-005` | P0 | コマンド: Paste Backlog as Markdown | クリップボードに Backlog 記法が存在する状態 | クリップボード内容が Markdown に変換され、エディタに挿入される |
