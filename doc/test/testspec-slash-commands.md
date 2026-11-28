# テスト仕様書: slash-commands

対象: [doc/requirements/systemspec.md §20](../requirements/systemspec.md#20-スラッシュコマンドメニューslash-command-menu) / [doc/design/architecture.md AD-026](../design/architecture.md)

---

## Test Matrix

| TC ID | Priority | 対象 | 条件 / 入力 | 期待結果 |
|-------|----------|------|-------------|----------|
| TC-SLASH-001 | P0 | `detectSlashTrigger` | 行頭 `/`, `/mer`, 空白直後 `hello /tab` | `{ query, matchLength }` を返す |
| TC-SLASH-002 | P0 | `detectSlashTrigger` | `https://example.com/a`, `foo/bar`, `/mer a` | `null` を返す（誤起動しない） |
| TC-SLASH-003 | P0 | `filterSlashCommands` | `""`, `mer`, `puml`, `math`, `table`, `zzzz` | 空は全件、各キーワードで該当候補、`zzzz` は `[]` |
| TC-SLASH-004 | P0 | Visual モード `/` 入力 | `/mer` 入力 | `#slash-menu` が表示され Mermaid 候補に絞り込まれる |
| TC-SLASH-005 | P0 | 候補確定（クリック / `Enter`） | Mermaid 選択確定 | トリガー文字列 `/mer` が削除され `language: 'mermaid'` のコードブロックが挿入される |
| TC-SLASH-006 | P0 | `Escape` キー | メニュー表示中に `Escape` | `#slash-menu` が閉じる |
| TC-SLASH-007 | P0 | Readonly / Preview ガード | `readonly === true` または `preview` モード | `#slash-menu` は開かない |
| TC-SLASH-008 | P1 | コードブロック内ガード | `codeBlock` 内で `/` 入力 | `#slash-menu` は開かない |
| TC-SLASH-009 | P0 | IME 変換中ガード | `compositionstart` 中 | `#slash-menu` は開かない |
| TC-SLASH-010 | P0 | スラッシュコマンド・通常編集後の Undo カーソル復元（回帰） | 本文途中で `/mer` 挿入後 `Ctrl+Z`、および文字挿入後 `Ctrl+Z` | 挿入前カーソル位置へ正確に復元され、`#slash-menu` は再表示されない |
