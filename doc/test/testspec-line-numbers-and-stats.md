# テスト仕様書: line-numbers-and-stats

対象: [doc/requirements/systemspec.md §17](../requirements/systemspec.md#17-行番号表示および文字数単語数ステータス表示line-numbers-and-document-stats) / [doc/design/architecture.md AD-023](../design/architecture.md)

---

## Test Matrix

| TC ID | Priority | 対象 | 条件 / 入力 | 期待結果 |
|-------|----------|------|-------------|----------|
| TC-STATS-001 | P0 | `countDocumentStats` | 空文字列 `""` | `charCount: 0`, `wordCount: 0`, `lineCount: 1`, `selectedCharCount: 0`, `selectedWordCount: 0` |
| TC-STATS-002 | P0 | `countDocumentStats` | 英語・日本語混在 `"Hello 世界\nテスト test"` | 改行除外の文字数（18）、単語数（Hello, 世, 界, テ, ス, ト, test の 7 語）、`lineCount: 2` |
| TC-STATS-003 | P1 | `countDocumentStats` | サロゲートペア（絵文字 `"👍a\r\nb"`） | 絵文字を 1 文字としてカウントし CRLF 改行を除外 |
| TC-STATS-004 | P0 | `countDocumentStats` | `selectedText` 指定あり | `selectedCharCount` / `selectedWordCount` が選択範囲分として集計される |
| TC-STATS-005 | P0 | `computeLineColumnFromOffset` | 先頭・途中・末尾・CRLF・範囲外オフセット | 1-based の `line`, `column` と `lineCount` を返し、範囲外は安全にクランプ |
| TC-STATS-006 | P1 | `estimateVisualLineNumber` | Visual モードのアンカーテキスト・ブロック比率 | テキスト一致またはブロック比率で `1..lineCount` の行番号を推定 |
| TC-STATS-007 | P0 | `formatStatusBarText` / Tooltip | `raw` / `markdown` / `preview` 各モード（選択あり・なし） | 各モード形式（`Ln X, Col Y` / `Ln X / Total` / `Total lines`）と選択併記を返す |
| TC-STATS-008 | P0 | `MarkdownEditorProvider` | `cursorStatus` メッセージ受信 | アクティブ時に `StatusBarItem.text` を更新・`show()` し、`document.isDirty` は `false` のまま |
| TC-STATS-009 | P0 | `MarkdownEditorProvider` | パネル非アクティブ化・破棄・TextEditor 切替 | `StatusBarItem.hide()` が呼ばれる |
| TC-STATS-010 | P0 | Webview HTML (`getHtml`) | 生成 HTML | `#raw-line-numbers` と `#raw-editor-main`（内に `#raw-search-backdrop` と `#raw-editor`）を含み、インライン style 不使用 |
