# Architecture — vsc-md-editor

製品の基本設計（HOW 境界・レイヤ方針）。振る舞い契約（WHAT）の正本は [systemspec.md](../requirements/systemspec.md) です。

§ 契約内の AD 参照は ID リンクで相互参照します。

---

### アーキテクチャ方針（AD-* 要約）

| ID | 方針（WHAT） |
|----|-------------|
| AD-001 | TypeScript / VS Code Extension Host / npm / `@vscode/test-electron` |
| AD-002 | `*.md` を Custom Editor（viewType `vsc-md-editor.wysiwyg`）で開く。Extension Host 上の `MarkdownDocument` が dirty・undo/redo・save および表示内容の正本 |
| AD-003 | **Markdown モード**は Webview 内 TipTap（ProseMirror）WYSIWYG。対象ノードは見出し（h1–h6）、太字、斜体、取り消し線（GFM `~~`）、箇条書き、番号リスト、タスクリスト、リンク、インラインコード、コードブロック、引用、水平線、表（§3）等（書式ツールバー契約は §2） |
| AD-004 | 編集内容 ↔ ディスク `.md` は remark/unified パイプラインで変換。HTML 混在・拡張ブロックを許容。出力は決定的（AD-013） |
| AD-005 | 表は per-table `tableFormat`（`gfm` \| `html`）で永続化する。新規挿入のデフォルトは GFM パイプ表。形式切替は Table メニューの明示操作のみ（§3） |
| AD-006 | ファイル単位 Readonly は **全編集面**（Markdown / Raw）をロック。Preview モードとは別概念。状態はワークスペースに永続化 |
| AD-007 | Mermaid はコードブロック + リアルタイム描画。VS Code kind → Mermaid `redux` / `redux-dark` マップ、グローバル表示密度は `themeVariables.fontSize: '12px'`（固定 px。`var(--vscode-...)` 禁止。密度の主手段は `fontSize` — CSS `scale`/`zoom` を密度代替にしない）。flowchart は stock Mermaid 既定に近い hug→wrap（`wrappingWidth: 200`・`padding: 15`）。CSP 下では `mermaid.render` **測定時**にも Host 同一 nonce CSS でラベル `font-size: 12px` を効かせ、測定と描画の食い違いを防ぐ（`'unsafe-inline'` なし）。**密度（fontSize）と閲覧用ビューポート変換（fit／ズーム／パン）は別契約**（§5 / `mermaid-readable-viewport`）。図タイトル全文がクリップされないこと。ビューポート UX（初期 fit・ズームイン／アウト・パン／ドラッグ・縦横スクロール・再 render 時 re-fit・a11y `aria-label`）は **Editor Preview / Rich Editor の Mermaid NodeView のみ**（Default Preview 埋め込みなし）。CSP 下 Host 同一 nonce による presentation `<style>` 再注入、`@mermaid-js/layout-elk` 登録＋ frontmatter / `%%{init}%%` オプトイン ELK（遅延ロード・グローバル強制なし — §5）。classic `default`/`dark` マップおよび静的 Host CSS エッジフォールバック優先は撤回（`mermaid-redux-elk-fidelity`）。**Preview / Markdown とも図の下にソース併記**。編集はテキストのみ（Preview は厳密 RO・ズーム／パンは閲覧操作のみ）。`securityLevel: 'strict'`・HIP・`'unsafe-inline'` なしは不変 |
| AD-008 | **Marp Preview** はサイド/パネル（§6）を維持。**Preview モード**（§1）でも `isMarpDocument(markdownText)` 検出時は同一 Webview 内 `#preview-marp-root` に Host 生成 HTML を RO 表示可。別 UI インスタンス・別責務は維持。編集は Markdown / Raw 側 |
| AD-009 | 画像 paste → 同階層 `img/image-NNNN.ext` に保存し相対パスを挿入。表示時は Host が `img/` 配下のみ `asWebviewUri` で rewrite（§7 / §9）。serialize / ディスクは常に相対パス |
| AD-010 | Webview CSP + HTML サニタイズ。許可タグ・属性を限定 |
| AD-011 | Extension Host と Webview を別バンドルし `media/` に配置 |
| AD-012 | シリアライズ round-trip のユニットテスト + Custom Editor 統合テスト |
| AD-013 | 保存時の整形ルールを固定し Git diff 可読性を確保 |
| AD-014 | ビルトイン Markdown エディタとの共存（エディタ関連付けの切替可能） |
| AD-015 | Output チャンネルで障害ログ。ユーザー向けはエディタ内インライン表示を優先 |
| AD-016 | 同一 Custom Editor 内に **Preview / Markdown / Raw** 三点モード。初期モードは **Raw**（`DEFAULT_EDITOR_MODE = 'raw'`）。モード切替 alone ではディスク書き込みしない。**Default Preview**（§1 / §10・表示ラベル）は mode-toolbar の非モード導線であり、4 つ目の `editorMode` ではない |

---

## HOW 境界・レイヤ方針

| レイヤ | 責務 | 備考 |
|--------|------|------|
| Extension Host | `MarkdownDocument` 正本、コマンド、画像 URI rewrite、Marp Host HTML、CSP / nonce、永続化 | AD-002, AD-009, AD-010, AD-015 |
| Webview（Custom Editor） | TipTap / Preview / Raw UI、Mermaid NodeView、表示層のみ | AD-003, AD-007, AD-016 |
| Serialize pipeline | remark/unified 往復、決定的整形 | AD-004, AD-013 |
| Bundles | Host と Webview を別バンドルし `media/` 配置 | AD-011 |
| Tests | round-trip ユニット + Custom Editor 統合 | AD-012 |

詳細な Inputs / Outputs / Behavior は requirements の各 § を正とする。本ファイルは AD-* 要約とレイヤ境界のみを保持する。

## Related requirements

- [doc/requirements/systemspec.md](../requirements/systemspec.md) — §1–§10、共通 Non-Goals、RK-*、Spec Gaps

## 改訂履歴

| 日付 | 節 | 変更内容 |
|------|-----|---------|
| 2026-09-19 | doc-reorg layout | 旧 `doc/systemspec.md` から AD-* 要約を分割移設。契約内容不変 |
