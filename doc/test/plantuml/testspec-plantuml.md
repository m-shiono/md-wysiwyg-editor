# Test Specification: plantuml-support

PlantUML ローカル実行レンダリング（アプローチ B）の振る舞い検証仕様。

- **対応仕様:** [doc/requirements/systemspec.md](../../requirements/systemspec.md) §12
- **テストコード:** `src/test/suite/unit/plantuml-support.test.ts`

## Test Matrix

| TC ID | 区分 | 項目 | 入力・条件 | 期待結果 (Expected) |
|---|---|---|---|---|
| `TC-PUML-001` | P0 | 環境未検出時のフォールバック | ローカルに `java` / `plantuml.jar` / `plantuml` が存在しない | エディタがクラッシュせず、図プレビュー領域を非表示（通常のフェンスブロック）とする。エラーダイアログは出さない |
| `TC-PUML-002` | P1 | 設定 `jarPath` 解決 | `md-wysiwyg-editor.plantuml.jarPath` に有効なパスが指定される | 指定された jar を用いた実行コマンド引数（`java -jar <jarPath> -tsvg -pipe`）が構築される |
| `TC-PUML-003` | P1 | 設定 `command` 解決 | `md-wysiwyg-editor.plantuml.command` にカスタムコマンドが指定される | 指定コマンドを用いた実行引数（`<command> -tsvg -pipe`）が構築される |
| `TC-PUML-004` | P0 | SVG 非同期レンダリング | 有効な PlantUML ソース（`@startuml ... @enduml`） | 標準入力から渡され、出力された SVG 文字列が正常に返却される |
| `TC-PUML-005` | P1 | レンダリングキャッシュ | 同一の PlantUML ソースを連続してレンダリング要求 | 2 回目以降はプロセス起動を行わずキャッシュされた SVG を即座に返す |
| `TC-PUML-006` | P1 | タイムアウト保護 | 実行プロセスが 5 秒以上応答しない | プロセスが SIGKILL され、タイムアウトエラーが通知されハングアップを回避する |
| `TC-PUML-007` | P0 | SVG サニタイズ | 悪意のある `<script>` や `onload` を含む SVG | DOMPurify により危険な属性・タグが除去され、安全な要素のみ DOM に注入される |
| `TC-PUML-008` | P1 | Visual モード表示契約 | `editorMode === 'markdown'` | 図プレビュー（`.plantuml-preview`）と下部ソース（`.plantuml-source`）が併記表示される |
| `TC-PUML-009` | P1 | Preview モード表示契約 | `editorMode === 'preview'` | `.plantuml-source` は `display: none` となり、図のみが表示される |
| `TC-PUML-010` | P1 | 構文エラー時のフォールバック | 不正な PlantUML 構文 | Document 正本を変更せず、エラー領域（`.plantuml-error`）に安全に通知される |
| `TC-PUML-011` | P1 | @startuml 重複防止 | ソース内に既に `@startuml ... @enduml` が記述済み | 二重付与せずそのまま実行される |
| `TC-PUML-012` | P1 | 存在しない jarPath フォールバック | 存在しないパスが `jarPath` に指定された場合 | 例外でクラッシュせず、PATH 上の `plantuml` にフォールバックする |
| `TC-PUML-013` | P1 | キャッシュリセット契約 | `resetCache()` 実行 | メモリキャッシュおよび利用可否フラグがクリアされる |
| `TC-PUML-014` | P1 | 非 UML ディレクティブ保持 | `@startmindmap`, `@startgantt`, `@startjson` など | `@startuml` でラップせず既存ディレクティブをそのまま渡す |
| `TC-PUML-015` | P1 | 大文字小文字ディレクティブの許容 | `@STARTUML` や `@StartUml` など大文字小文字混在 | 重複して `@startuml` を付与せず、そのまま正規化される |
| `TC-PUML-016` | P0 | SVG XSS 耐性 | `<svg><script>alert(1)</script></svg>` や `javascript:` | サニタイズ関数によりスクリプトタグや危険なイベントハンドラが確実に除去される |


