# Test Specification: default-editor-mode-config

Markdown ファイルを開いた際のデフォルトエディタモード（Visual / Source / Preview）を設定（`md-wysiwyg-editor.defaultMode`）によりカスタマイズする機能の検証仕様。

- **対応仕様:** [doc/requirements/systemspec.md](../requirements/systemspec.md) §1、[doc/design/architecture.md](../design/architecture.md) AD-016
- **テストコード:**
  - `src/test/suite/unit/editor-mode-config.test.ts`
  - `src/test/suite/unit/editor-modes.test.ts`

## Test Matrix

| TC ID | 区分 | 項目 | 入力・条件 | 期待結果 (Expected) |
|---|---|---|---|---|
| `TC-MODE-001` | P0 | 未設定時のデフォルト初期モード | `md-wysiwyg-editor.defaultMode` が未設定（`undefined` または空） | デフォルトとして `'markdown'`（Visual）が初期モードとして解決・設定される |
| `TC-MODE-002` | P0 | 設定値 `"source"` による初期モード解決 | `md-wysiwyg-editor.defaultMode` が `"source"` | 内部モード `'raw'` が初期モードとして解決・設定される |
| `TC-MODE-003` | P0 | 設定値 `"visual"` による初期モード解決 | `md-wysiwyg-editor.defaultMode` が `"visual"` | 内部モード `'markdown'` が初期モードとして解決・設定される |
| `TC-MODE-004` | P0 | 設定値 `"preview"` による初期モード解決 | `md-wysiwyg-editor.defaultMode` が `"preview"` | 内部モード `'preview'` が初期モードとして解決・設定される |
| `TC-MODE-005` | P1 | 不正な設定値に対するフォールバック | 未知の文字列（例: `"invalid"`, `123`, `null`） | 安全にデフォルト値 `'markdown'`（Visual）にフォールバックされる |
| `TC-MODE-006` | P1 | 設定値マッピング関数の単体検証 | `"source"`, `"visual"`, `"preview"` および不正値 | 期待される `EditorMode`（`'raw'`, `'markdown'`, `'preview'`）へ正確に変換される |
| `TC-MODE-007` | P0 | 手動モード切替と設定の独立性 | オープン後に三点ツールバーでモード切替（`setMode`） | 表示モードは正常に切り替わり、設定値（configuration）は書き換えられない |
| `TC-MODE-008` | P0 | `package.json` 設定定義スキーマ検証 | `package.json` の `contributes.configuration` | `md-wysiwyg-editor.defaultMode` が定義され、`enum: ["source", "visual", "preview"]`、`default: "visual"` が設定されていること |
| `TC-MODE-009` | P0 | 設定動的変更時のスコープ別検知 | `settings.json` の変更（ユーザー/ワークスペース/リソーススコープ） | `onDidChangeConfiguration` で `document.uri` を含む全スコープで検知され、開いているエディタに `syncDocumentModeWithConfig` で反映される |
| `TC-MODE-010` | P0 | タブフォーカス復帰時のモード再同期 | `settings.json` 編集後に Markdown タブをアクティブ化 | `onDidChangeViewState` でアクティブ復帰時に `syncDocumentModeWithConfig` が実行され、最新設定値とエディタ表示が一致する |
| `TC-MODE-011` | P0 | Webview 側 `modeChanged` の確実な強制適用 | Host からの `modeChanged` メッセージ受信 | Webview 内部状態に関わらず無条件で `applyMode` が呼び出され、UI およびエディタ状態が更新される |
