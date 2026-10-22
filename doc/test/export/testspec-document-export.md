# Test Specification: document-export

ドキュメントエクスポート機能（HTML / PDF / DOCX / PPTX 変換）の振る舞い検証仕様。

- **対応仕様:** [doc/requirements/systemspec.md](../../requirements/systemspec.md) §13
- **テストコード:** `src/test/suite/unit/document-export.test.ts`

## Test Matrix

| TC ID | 区分 | 項目 | 入力・条件 | 期待結果 (Expected) |
|---|---|---|---|---|
| `TC-EXP-001` | P0 | コマンド登録契約 | `package.json` | `md-wysiwyg-editor.exportDocument` がコマンドとして登録され、エディタタイトルメニューに配置される |
| `TC-EXP-002` | P0 | スタンドアロン HTML 出力 | Markdown 本文とローカル画像 | CSS スタイルおよび Base64 画像を含んだ単一の HTML ファイルが生成される |
| `TC-EXP-003` | P1 | PDF 出力準備 | Markdown または Marp 文書 | 印刷用スタンドアロン HTML または PDF が生成・配置される |
| `TC-EXP-004` | P1 | DOCX 出力（Pandoc 検出時） | Pandoc コマンドが利用可能 | `pandoc <input> -o <output>.docx` を実行し DOCX ファイルを出力する |
| `TC-EXP-005` | P1 | DOCX 出力（Pandoc 未検出時） | Pandoc コマンドが環境に存在しない | エラークラッシュせず、Pandoc のインストール案内通知を表示する |
| `TC-EXP-006` | P1 | PPTX 出力（Marp 文書） | `isMarpDocument(text) === true` | Marp CLI コマンド引数（`--pptx`）を構築して実行する |
| `TC-EXP-007` | P1 | PPTX 出力（非 Marp 文書） | `isMarpDocument(text) === false` | PPTX は Marp 文書専用である旨のガイダンス通知を表示し処理を中断する |
| `TC-EXP-008` | P1 | 未保存バッファの Dirty ゲート | `document.isDirty === true` | エクスポート実行前に保存確認を行い、保存後にエクスポートを実行する |
| `TC-EXP-009` | P1 | 外部 URL / データ URI 保持 | `https://` や `data:` 画像を含む文書 | URL を書き換えずにそのまま保持する |
| `TC-EXP-010` | P1 | 存在しない画像パスの耐障害性 | 存在しないローカル画像パス | クラッシュせず、元の画像パスのまま HTML を出力する |
| `TC-EXP-011` | P1 | GFM 書式（取り消し線・タスク） | GFM 記法を含む文書 | HTML に `<del>` やチェックボックスが正しく反映される |
| `TC-EXP-012` | P1 | スペース・URLエンコード画像解決 | `my%20photo.png` などのローカル画像 | `decodeURI` して正しくローカルファイルを解決・Base64 化する |
| `TC-EXP-013` | P1 | シングルクォート画像タグ解決 | `<img src='image.png'>` | シングルクォート属性でも正しく検出して Base64 化する |
| `TC-EXP-014` | P1 | H1 タイトル抽出 | `# My Great Document` で始まる文書 | `<title>My Great Document</title>` が HTML head に設定される |
| `TC-EXP-015` | P1 | メモリ内最新テキストの優先取得 | `getDocumentText` に対象 URI を渡す | VS Code 上で開かれた最新バッファ（未保存含む）を優先して読み出す |
| `TC-EXP-016` | P0 | 画像拡張子ホワイトリスト制限 | `.env`, `.pem`, `id_rsa` 等の非画像ファイル | 読み出されず Base64 化されずに安全に無視され、ローカルファイル漏洩を防ぐ |
| `TC-EXP-017` | P1 | 印刷用一時ファイル配置 | 印刷用 PDF 出力フォールバック | ワークスペース内ではなく `os.tmpdir()` 配下に一時ファイルを作成する |



