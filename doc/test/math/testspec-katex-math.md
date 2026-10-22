# Test Specification: katex-math-rendering

KaTeX を用いた数式レンダリング（LaTeX 記法）の振る舞い検証仕様。

- **対応仕様:** [doc/requirements/systemspec.md](../../requirements/systemspec.md) §14
- **テストコード:** `src/test/suite/unit/katex-math.test.ts`

## Test Matrix

| TC ID | 区分 | 項目 | 入力・条件 | 期待結果 (Expected) |
|---|---|---|---|---|
| `TC-MATH-001` | P0 | パッケージ依存とインポート | `package.json` | `katex` が dependencies に登録され、`media/editor.ts` でインポートされる |
| `TC-MATH-002` | P0 | 数式ブロックの NodeView 構造 | `language === "math" \|\| language === "latex"` | `.math-block` コンテナ内に `.math-preview` と `.math-source` を配置する |
| `TC-MATH-003` | P0 | 正常系レンダリング | 有効な LaTeX 式（例: `E = mc^2`） | `katex.renderToString` により MathML / HTML が正常に生成される |
| `TC-MATH-004` | P1 | 構文エラー時のフォールバック | 不正な LaTeX 構文 | エディタがクラッシュせず、`throwOnError: false` または `.katex-error` で安全に表示される |
| `TC-MATH-005` | P0 | DOMPurify サニタイズ | レンダリングされた数式 HTML | DOMPurify により安全にサニタイズされた上で DOM に挿入される |
| `TC-MATH-006` | P1 | Preview モード表示契約 | `body[data-mode='preview']` | CSS により `.math-source` が `display: none` となり、数式プレビューのみが表示される |
| `TC-MATH-007` | P1 | 複雑数式レンダリング | 積分・シグマ・分数・マルチライン数式 | KaTeX により正常に構造化 MathML/HTML が生成される |
| `TC-MATH-008` | P1 | 空白・空数式入力の耐障害性 | 空文字または空白のみの数式ブロック | クラッシュせず、プレビューが空となり安全に処理される |
| `TC-MATH-009` | P1 | テキストマクロ・日本語数式 | `\text{...}` 内に Unicode / 日本語を含む式 | エラーなく正常にテキスト埋め込み数式が描画される |
| `TC-MATH-010` | P1 | 大文字混在言語識別子の許容 | ````Math```` や ````LaTeX```` などのフェンス | 小文字正規化され、正常に `.math-block` として初期化・更新される |
| `TC-MATH-011` | P1 | displayMode 有効化契約 | `media/editor.ts` | `displayMode: true` を指定してブロック数式として中央配置・独立表示される |
| `TC-MATH-012` | P0 | KaTeX スタイルシート読み込み | `src/providers/markdown-editor-provider.ts` | Webview `<head>` に `katex.min.css` の `<link>` が配置され、数式レイアウト崩れを防ぐ |



