# Test Specification: mermaid-readable-viewport

## 概要

- **対象:** Mermaid 可読ビューポート — (1) グローバル `themeVariables.fontSize: '12px'`（旧 `'8px'` / `'13px'` 置換）(2) タイトル全文可視（表示層契約）(3) Editor Preview / Rich Editor のみの初期 fit・ズームイン／アウト・パン／スクロール・再 render 時 re-fit・a11y `aria-label` (4) 密度（fontSize）と閲覧用ビューポート変換の分離 (5) Preview RO（ビューポート操作は Document 非編集）(6) Default Preview 非対象 (7) redux / HIP / strict / nonce / ELK オプトイン回帰
- **対応仕様:** [doc/systemspec.md](systemspec.md) §5（正常系 7a–7c / 9 / 13、Spec Gaps）、§1（Preview RO）、§9（CSP / sanitize）
- **Requirements Brief:** `temporary/requirements-brief-mermaid-readable-viewport.md`（AD-001–AD-013）
- **関連 testspec（本タスクで Expected 更新 — `8px`→`12px`）:**
  - [testspec-mermaid-redux-elk-fidelity.md](testspec-mermaid-redux-elk-fidelity.md) — TC-001–003 / TC-011
  - [testspec-fix-mermaid-edge-styles.md](testspec-fix-mermaid-edge-styles.md) — TC-003–005
  - [testspec-mermaid-contrast-readable.md](testspec-mermaid-contrast-readable.md) — TC-004 / 007 / 011
  - [testspec-mermaid-snap-style-with-source.md](testspec-mermaid-snap-style-with-source.md) — TC-005
  - [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-149
- **テストコード:** `src/test/suite/unit/mermaid-readable-viewport.test.ts`（実装済 — 意図的 Red まで build-agent）
- **作成日:** 2026-09-06

### 既存 suite との関係（必須明示）

| 項目 | redux-elk / edge / contrast / snap / wysiwyg | 本 testspec |
|------|-----------------------------------------------|-------------|
| 所在 | 各 `doc/testspec-mermaid-*.md` / TC-149 | 本ファイル |
| 旧契約 | グローバル `fontSize === '8px'` | — |
| 新契約 | Expected を **`'12px'`** へ更新（deprecate しない） | **密度 12px＋タイトル可視＋ビューポート UX の正本** |
| 扱い | Expected **更新** | **差分 TC**（設計のみ） |

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| VS Code `themeUpdated.kind` | `'light' \| 'dark' \| 'highContrast'` | — | — | §1。`buildMermaidThemeConfig` 入力 |
| `themeVariables.fontSize`（グローバル） | `string`（固定 px） | — | — | プロジェクト既定 **`'12px'`**。`var(--vscode-...)` 禁止 |
| `mermaidSource` | `string` | 0 文字 | — | フェンス全文。タイトル付き図・大型図の fixture 可 |
| `editorMode` | `"preview" \| "markdown" \| "raw"` | — | — | ビューポート UX は `preview` / `markdown` の Mermaid NodeView のみ |
| ビューポート操作 | UI（ローカル DOM） | 描画成功時 | — | Zoom in / Zoom out / Fit（キーボード到達・`aria-label`）。パン／ドラッグ・縦横スクロール。セッション永続なし |
| Default Preview 経路 | `native-preview` | — | — | ビューポート UI 埋め込み **なし**（Non-Goal） |

### Outputs & Failure Returns

| 条件 | 戻り値 / 期待状態 | 仕様根拠 |
|------|-------------------|---------|
| グローバル密度 | 全 kind で `themeVariables.fontSize === '12px'`。`var(--vscode-...)` なし。密度主手段に CSS `scale`/`zoom` を使わない | §5 正常系 7a、AD-001 |
| タイトル全文可視 | 図タイトルが枠外クリップ／欠落なく可視。タイトルが図左端より左にはみ出さないよう表示層で align／shift（viewBox / overflow / padding 含む） | §5 正常系 7b、AD-003 |
| 初期 fit | 描画成功後、図全体が枠内に収まる（contain / fit-to-viewport） | §5 正常系 7c、AD-004 |
| ズーム | 虫眼鏡または同等 UI でイン／アウト。ビューポート変換（CSS transform 等）で 12px 図を拡大して読める。密度契約とは別 | §5 正常系 7c、AD-005 |
| パン／スクロール | 枠内パン／ドラッグが可能（**特定修飾キー／中ボタンを必須ロックしない** — Spec Gap RK-004）。必要時に縦横スクロールバー | §5 正常系 7c / Spec Gaps、AD-006 |
| re-fit | ソース変更・再 render（debounce）および `themeUpdated` 一括再描画後に当該ブロックを再 fit | §5 正常系 7c / 9、AD-007 |
| a11y | ズーム／Fit コントロールがキーボード到達可能。`aria-label`（例: Zoom in / Zoom out / Fit）あり | §5 正常系 7c、AD-011 |
| Preview RO | ズーム／パンは閲覧操作のみ。Document 編集イベントを送らない | §1、§5 正常系 7c、AD-009 |
| Default Preview | `native-preview` 経路に Mermaid ビューポート UI なし | §5 Non-Goals、AD-002 |
| 構文エラー | `.mermaid-error`。ビューポート UI は隠すか無効化 | §5 Outputs |
| 回帰 | redux kind マップ・HIP・`securityLevel: 'strict'`・nonce 再注入・ELK オプトイン（グローバル強制なし）・ソース併記 | §5 受け入れ (a)–(e)、AD-008/009 |

### Preconditions & Assumptions

- Webview Mermaid: `mermaid.render` →（presentation 抽出／nonce 再注入）→ DOMPurify（HIP）→ `.mermaid-preview` 注入 → ビューポート枠に fit
- ユニットはテーマ helper・NodeView DOM／ハンドラ契約・CSS／静的検査で足りる。ピクセル完全一致・Chart／Snap 一致は Non-Goal
- パン開始ジェスチャの具体（中ボタン／修飾キー／専用ハンドル）は **Spec Gap** — TC は「枠内パン可能」まで。特定修飾を必須期待にしない
- 密度＝`fontSize`、閲覧＝ビューポート変換。後者の CSS transform は許容（Non-Goal の「密度主手段としての scale」とは別）

### Complexity Budget

- UI／表示契約。アルゴリズム計算量 N/A
- P2 Stress: 巨大 SVG＋高ズームの CPU／メモリ（RK-003）— 専用 Stress TC なし（図単位状態に閉じる契約を P1 で静的確認）

### Spec Gaps

- ⚠️ パン開始条件の具体ジェスチャは実装時確定（§5 Spec Gaps / RK-004）。本 testspec は「枠内パン／ドラッグが可能」まで — **特定 modifier を Expected に固定しない**
- それ以外（`12px`・タイトル可視・fit／ズーム／パン／スクロール・re-fit・a11y・Default Preview 非対象・密度≠ビューポート）は AD-001–AD-013 で確定

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-001 | Happy | fontsize-12px-all-kinds | P0 | `buildMermaidThemeConfig` 全 kind（`light` / `dark` / `highContrast`） | いずれも `themeVariables.fontSize === '12px'`。`'8px'` / `'13px'` は Fail | グローバル密度 12px（AD-001） | §5 正常系 7a |
| TC-002 | Structural | no-vscode-var-in-theme-variables | P0 | 同上 theme config | `themeVariables` に `var(--vscode-...)` **なし** | CSS 変数禁止維持 | §5 正常系 7 / 7a |
| TC-003 | Structural | density-not-css-scale | P0 | `.mermaid-preview` / 密度関連 CSS・ヘルパ | 密度の主手段として `transform: scale(...)` / `zoom` による見た目縮小を**要求しない**（ビューポート変換用 transform とは別契約） | 密度≠scale（AD-001） | §5 正常系 7a、Non-Goals |
| TC-004 | Happy | title-not-clipped | P0 | タイトル付き Mermaid 図の render／NodeView 表示層契約（viewBox / overflow / padding／title align・shift 等） | タイトル文字列が枠外クリップや欠落なく全文可視。タイトル左端が図コンテンツ左端より左にはみ出さない（align／shift）。`docJson` / `markdownText` / serialize 不変 | タイトル全文可視（AD-003） | §5 正常系 7b |
| TC-005 | Happy | initial-fit | P0 | 描画成功後の Mermaid NodeView（大きめ図 fixture 可） | 初期ビューポートが全体 fit（contain / fit-to-viewport）。枠内に図全体が収まる契約 | 初期 fit（AD-004） | §5 正常系 7c |
| TC-006 | Happy | zoom-in-out | P0 | Zoom in / Zoom out コントロール操作（または同等 API） | ズームインでビューポート拡大（transform 等）。ズームアウトで縮小。密度 `fontSize` は `'12px'` のまま | ズームで 12px 図を読める（AD-005） | §5 正常系 7c |
| TC-007 | Happy | zoom-a11y | P0 | ズーム／Fit UI | キーボード到達可能。各コントロールに `aria-label`（例: Zoom in / Zoom out / Fit）。コントラストは `--vscode-*` 系 | a11y 最低限（AD-011） | §5 正常系 7c |
| TC-008 | Happy | pan-within-frame | P0 | ズームイン後の枠内パン／ドラッグ | **枠内でパン可能**。特定修飾キー／中ボタン／専用ハンドルを**必須ロックしない**（実装が選んだジェスチャで可）。Document 編集イベントなし | パン契約＋Spec Gap（AD-006 / RK-004） | §5 正常系 7c、Spec Gaps |
| TC-009 | Happy | scrollbars-when-needed | P0 | ズームイン後に枠外細部がある状態 | 必要時に縦横スクロールバー（または同等 overflow スクロール）で細部到達可 | スクロール（AD-006） | §5 正常系 7c |
| TC-010 | Happy | refit-on-rerender | P0 | 図ソース変更→ debounce 再 render。事前にズーム／パン済みでも可 | 再 render 後に当該ブロックのビューポートが **再 fit** | re-fit（AD-007） | §5 正常系 7c |
| TC-011 | Happy | refit-on-theme-updated | P0 | `themeUpdated` 後の一括再描画 | 再描画後に当該ブロックが再 fit | テーマ切替 re-fit | §5 正常系 9 |
| TC-012 | Corner | viewport-ops-preview-ro | P0 | Preview モードでズーム／パン操作 | Document へ編集イベントを送らない（dirty / `docJson` / `markdownText` 不変）。閲覧操作のみ | Preview 厳密 RO（AD-009） | §1、§5 正常系 7c |
| TC-013 | Structural | no-default-preview-viewport | P0 | Default Preview（`native-preview`）経路・寄与コマンド／HTML | Mermaid ビューポート UI（ズーム／パン／Fit）の埋め込み・別 Webview 化が**ない** | Default Preview 非対象（AD-002） | §5 Non-Goals |
| TC-014 | Happy | redux-kind-map-regression | P0 | `buildMermaidThemeConfig` 全 kind | light→`redux`、dark/HC→`redux-dark`。`securityLevel: 'strict'`。classic `default`/`dark` マップは Fail | redux 回帰（AD-009） | §5 正常系 7 |
| TC-015 | Corner | hip-strict-regression | P0 | sanitize options および theme config | `HTML_INTEGRATION_POINTS: { foreignobject: true }`（または同等）。全 kind `securityLevel: 'strict'` | HIP / strict 回帰（AD-008） | §5 正常系 10、§9 |
| TC-016 | Structural | nonce-elk-optin-regression | P0 | nonce 再注入経路＋ ELK initialize／`layout: elk` 経路 | Host 同一 nonce 再注入契約維持（`'unsafe-inline'` なし）。グローバル `layout: 'elk'` 強制なし。`layout: elk` 指定はオプトイン成功経路 | nonce / ELK 回帰（AD-008/009） | §5 正常系 11–12 |
| TC-017 | Corner | syntax-error-hides-viewport | P1 | 構文不正 Mermaid ソース | `.mermaid-error` 表示。ビューポート UI は隠すか無効化。ソースは Document に保持 | エラー時 UI | §5 Outputs |
| TC-018 | Structural | viewport-in-preview-and-markdown | P1 | `editorMode` `preview` および `markdown` | 両モードの Mermaid NodeView にビューポート UX あり。`raw` は本 TC 対象外（島は Markdown/Preview 面） | 適用範囲（AD-002） | §5 Inputs |
| TC-019 | Boundary | per-diagram-fontsize-override | P1 | frontmatter / `%%{init}%%` で `themeVariables.fontSize` 上書き | 当該図のみ上書き可（グローバル `'12px'` を壊さない）。ネイティブ優先 | 図単位上書き許容 | §5 正常系 6 / 7a |
| TC-020 | Structural | related-suites-12px-aligned | P1 | redux-elk / edge / contrast / snap / wysiwyg TC-149 の Expected | いずれもグローバル `fontSize === '12px'`。`'13px'` 必須期待が残っていない | RK 防止・整合 | AD-001 |
| TC-021 | Structural | source-below-diagram | P1 | Mermaid NodeView DOM 順 | `.mermaid-preview` → `.mermaid-source`（図の下にソース） | ソース併記回帰 | §5 正常系 4 |
| TC-022 | Structural | no-viewport-session-persist | P1 | ビューポート状態の保存経路（設定 / workspaceState / 永続ストア） | セッション永続・設定保存を**要求しない**（MVP） | 永続 Out（AD-007） | §5 Non-Goals |
| TC-023 | Structural | document-untouched | P1 | 変更対象パス（theme / NodeView ビューポート / CSS） | `docJson` / `markdownText` / serialize / dirty / Marp / 画像 rewrite に触れない | 表示層限定（AD-009） | §5 受け入れ 13 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-001, TC-004–011, TC-014 | — |
| Boundary | TC-019 | 空ソースは既存 Mermaid TC |
| Structural | TC-002–003, TC-013, TC-016, TC-018, TC-020–023 | — |
| Corner | TC-012, TC-015, TC-017 | — |
| Stress | — | 巨大 SVG＋高ズームは RK-003。専用 P2 なし（図単位閉じるは TC-023） |

### Complexity Notes

- ドメイン: VS Code Extension Webview（Mermaid NodeView / theme / viewport UI）
- 競技系ドメインパターン: N/A
- API / Worker: N/A（ローカル拡張）

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR） | `test_single`: `npm run test:unit -- --grep 'mermaid-readable-viewport\|TC-00[1-9]\|TC-0[12][0-3]'` |
| P2 | — | 本 testspec に P2 なし |
| 回帰 | redux-elk / edge-styles / contrast / snap / TC-149 | Expected `12px` 更新後に Red→Green |

想定配置: `src/test/suite/unit/mermaid-readable-viewport.test.ts`（`doc/stack.md` `test_file_glob`）

**実装メモ（testspec-implementation）:**

1. 本 suite で TC-001–023 を追加（本番コードは触らない → 意図的 Red）
2. 関連 suite の `fontSize === '13px'` assert を `'12px'` へ更新
3. タイトル可視・fit／ズームは DOM／transform／overflow 契約で近似（ピクセル一致不要）
4. パン TC は「枠内パン可能なハンドラ／overflow 契約」を assert — **特定 modifier を固定しない**
5. Default Preview 非対象は寄与／経路の静的検査で足りる

---

## Trace Results

`npm run test:unit -- --grep 'mermaid-readable-viewport'`（2026-09-06）。本番未実装のため意図的 Red。

### TC-001–003 (P0): 密度 12px・var 禁止・密度≠scale

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 全 kind theme config + 密度 CSS | — |
| Output | `fontSize: '12px'`、`var` なし、密度主手段に scale なし | AD-001 |

**Result:** ❌ Fail（本番 `fontSize` がまだ `'13px'` / viewport 未実装 — intentional Red）

---

### TC-004–007 (P0): タイトル・fit・ズーム・a11y

| Step | State / Action | Value |
|------|----------------|-------|
| Input | タイトル付き図 + NodeView viewport UI | — |
| Output | タイトル全文可視・初期 fit・ズーム・`aria-label` | AD-003–005 / AD-011 |

**Result:** ❌ Fail（viewport / title 契約未実装 — intentional Red）

---

### TC-008–011 (P0): パン／スクロール／re-fit

| Step | State / Action | Value |
|------|----------------|-------|
| Input | ズーム後パン・ソース変更・`themeUpdated` | — |
| Output | 枠内パン可（modifier 非固定）・スクロール・再 fit | AD-006/007、Spec Gaps |

**Result:** ❌ Fail（intentional Red）

---

### TC-012–016 (P0): RO・Default Preview・回帰

| Step | State / Action | Value |
|------|----------------|-------|
| Input | Preview 操作・native-preview・theme/sanitize/nonce/ELK | — |
| Output | Document 非編集・viewport UI なし・redux/HIP/strict/nonce/ELK 維持 | AD-002/008/009 |

**Result:** ❌ / ✅ 混在可（回帰 TC は既存 Green、viewport 依存は Red）

---

### TC-017–023 (P1)

| ID | Result | Notes |
|----|--------|-------|
| TC-017 | ❌ | エラー時 UI 無効化 — intentional Red |
| TC-018 | ❌ | preview + markdown viewport — intentional Red |
| TC-019 | ❌/✅ | グローバルがまだ 13px なら Fail |
| TC-020 | ✅ | 関連 suite Expected を 12px に更新済 |
| TC-021–023 | ✅/❌ | ソース順・非永続・Document 非接触は既存契約維持可 |

### Trace Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-001–016 | P0 | ❌ Fail（意図的 Red） | テストコード実装済・本番未着手 |
| TC-017–023 | P1 | ❌/✅ 混在 | 同上 |

---

## Self-Check Report

### A. Input & Constraints
- [x] ✅ kind 三値・fontSize 12px: TC-001–002
- [x] ✅ editorMode / Default Preview: TC-013 / TC-018
- [x] N/A 整数オーバーフロー — UI 契約

### B. Structural Patterns
- [x] ✅ 密度≠scale・nonce/ELK・ソース順・Document 非接触: TC-003 / TC-016 / TC-021 / TC-023
- [x] ✅ 関連 suite 整合: TC-020
- [x] N/A グラフ非連結 — 該当なし

### C. Corner & Failure
- [x] ✅ Preview RO・HIP/strict・構文エラー UI: TC-012 / TC-015 / TC-017
- [x] ✅ パン Spec Gap（modifier 非固定）: TC-008
- [x] N/A API 404 — 該当なし

### D. Complexity & Resources
- [x] ✅ ビューポート状態は図単位・非永続: TC-022 / TC-023
- [x] N/A 最悪計算量 Stress — 専用 P2 なし（RK-003）

### E. API / Worker
- [x] N/A HTTP / 認証 — ローカル VS Code 拡張

### Uncovered / Spec Gaps
- ⚠️ パン開始ジェスチャの具体（中ボタン／修飾キー／ハンドル）— 実装時確定。TC-008 は「枠内パン可能」まで
- ピクセル目視の「読める」— transform／overflow 契約で近似
- ピンチ・高度な SR 図読解 — Out

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-06 | 初版 — `fontSize: '8px'`・タイトル全文可視・初期 fit・ズーム／a11y・パン（modifier 非固定）／スクロール・re-fit・Preview RO・Default Preview 非対象・redux/HIP/strict/nonce/ELK 回帰（設計のみ）。関連 suite `13px`→`8px` 更新指示 |
| 2026-09-06 | testspec-implementation — `mermaid-readable-viewport.test.ts` 追加・unit-entry 登録・関連 suite Expected `8px` 更新。Trace を意図的 Red に更新 |
| 2026-09-06 | 密度 polish: Expected／TC のグローバル `fontSize` を `'8px'` → `'12px'`。タイトル左欠け対策（viewBox / `getComputedTextLength` / 水平パッド）を契約に追随 |
| 2026-09-06 | タイトル align／shift: TC-004 Expected に「title left ≥ diagram content left」を追記。表示層契約を Outputs に同期 |
| 2026-09-06 | ノード寸法 polish（choice B）: Expected／TC のグローバル `fontSize` を `'10px'` → `'12px'`。flowchart `wrappingWidth: 200`・`padding: 15`、render 前 Host-nonce 測定 CSS 契約を追記 |
