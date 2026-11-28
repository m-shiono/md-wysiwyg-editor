# テスト仕様書: document-outline

対象: [doc/requirements/systemspec.md §18](../requirements/systemspec.md#18-見出しアウトラインパネルdocument-outline) / [doc/design/architecture.md AD-024](../design/architecture.md)

---

## Test Matrix

| TC ID | Priority | 対象 | 条件 / 入力 | 期待結果 |
|-------|----------|------|-------------|----------|
| TC-OUT-001 | P0 | `extractOutlineHeadings` | H1〜H6 を含む Markdown | `level`, `text`, `slug`, `line`, `index` が正しく抽出される |
| TC-OUT-002 | P0 | `extractOutlineHeadings` | YAML フロントマター付き Markdown | フロントマターの行数をオフセット加算した正確な 1-based `line` を返す |
| TC-OUT-003 | P0 | `extractOutlineHeadings` | コードフェンス（` ``` ` / `~~~`）内の `#` | 見出しとして誤抽出されない |
| TC-OUT-004 | P1 | `extractOutlineHeadings` | 同名見出し重複・空文書 | 重複スラッグに `-1`, `-2` が付与され、空文書は `[]` |
| TC-OUT-005 | P0 | `findLineStartOffset` | 1行目・中間行・最終行・CRLF・範囲外 | 1-based 行番号の行頭オフセットを返し、範囲外は安全にクランプ |
| TC-OUT-006 | P0 | Webview `Outline` トグル | `button[data-action="toggle-outline"]` 押下 | `#outline-panel` の `.hidden` と `aria-pressed` が切り替わり、`editorMode` は不変 |
| TC-OUT-007 | P0 | Source モードジャンプ | アウトライン項目クリック | `raw.selectionStart` が見出し行先頭に移動し、`isDirty` は変化しない |
| TC-OUT-008 | P1 | Readonly モード | `readonly === true` で開閉・ジャンプ | Readonly でもアウトライン開閉・ジャンプが動作する |
| TC-OUT-009 | P1 | 空見出し文書 | 見出しのない Markdown でパネルを開く | `.outline-empty`（`No headings`）が表示される |
