# Test Specification: fix-mermaid-edge-styles

## 概要

- **対象:** Custom Editor Webview CSP 下で Mermaid flowchart エッジが黒塗りブロブ／欠線になる問題の修正契約 — (1) Host nonce 付き presentation CSS フォールバック（`fill: none` / stroke 可視）(2) VS Code kind 標準テーママップ復帰（`light`→`default`、`dark`/`highContrast`→`dark`）(3) `.mermaid-preview` 島ライト強制撤廃 (4) HIP / `securityLevel: 'strict'` / 図下ソース併記 / Preview RO 回帰
- **対応仕様:** [doc/systemspec.md](systemspec.md) §5（正常系 7 / 10 / 11）、§1（Preview 可読性・Mermaid）、§9（CSP / sanitize）
- **Requirements Brief:** `temporary/requirements-brief-fix-mermaid-edge-styles.md`（AD-001–013）
- **関連 testspec（本タスクで Expected 更新）:**
  - [testspec-mermaid-contrast-readable.md](testspec-mermaid-contrast-readable.md) — 島ライト必須・全 kind `default` を撤回。HIP / XSS / 広い面不変は維持
  - [testspec-mermaid-snap-style-with-source.md](testspec-mermaid-snap-style-with-source.md) — 同上テーマ／島撤回。ソース併記・Preview RO は維持
  - [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-149 標準 kind マップ（本契約と一致）。TC-130–132 / TC-152 回帰参照
- **テストコード:** `src/test/suite/unit/fix-mermaid-edge-styles.test.ts`（TC-001–015 実装済・意図的 Red）
- **作成日:** 2026-09-06

### 既存 suite との関係（必須明示）

| 項目 | contrast-readable | snap-style-with-source | 本 testspec |
|------|-------------------|------------------------|-------------|
| 所在 | [testspec-mermaid-contrast-readable.md](testspec-mermaid-contrast-readable.md) | [testspec-mermaid-snap-style-with-source.md](testspec-mermaid-snap-style-with-source.md) | 本ファイル |
| 旧契約（撤回） | 島ライト＋ dark/HC → `default` | 全 kind → `default`＋島ライト | — |
| 新契約 | 標準 kind マップ＋島ライト不在。HIP/XSS 維持 | ソース併記／Preview RO／HIP 維持。テーマは本契約へ委譲 | **エッジ CSS フォールバック＋テーママップ＋島撤廃の正本** |
| 扱い | Expected **更新**（deprecate しない） | Expected **更新** | **差分 TC**（CSP／nonce／`fill:none`） |

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| VS Code `themeUpdated.kind` | `'light' \| 'dark' \| 'highContrast'` | — | — | §1。`buildMermaidThemeConfig` 入力 |
| Custom Editor CSP `style-src` | Host 生成 HTML | — | — | `${webview.cspSource} 'nonce-${nonce}'`。`'unsafe-inline'` 禁止 |
| Host nonce | `string` | — | — | フォールバック `<style>` / stylesheet と同一 nonce |
| Mermaid presentation CSS スコープ | `.mermaid-preview`（必要なら `.mermaid-block`） | — | — | エッジ／リンク相当セレクタ最小集合（flowchart 必須） |
| Mermaid SVG（sanitize 後） | `string` | — | — | CSP 無効化後もラベル／エッジ契約は HIP＋フォールバックで担保 |
| `editorMode` | `"preview" \| "markdown" \| "raw"` | — | — | ソース併記・Preview RO 回帰 |

### Outputs & Failure Returns

| 条件 | 戻り値 / 期待状態 | 仕様根拠 |
|------|-------------------|---------|
| CSP + sanitize 後の flowchart エッジ | Host nonce 付き CSS に `.mermaid-preview` スコープの `fill: none`（および stroke 可視に必要な最小規則）が存在。エッジが黒塗りブロブにならない契約 | §5 正常系 11、AD-002/003 |
| CSP 文言 | `style-src` に `'unsafe-inline'` **なし**。nonce 付き | §9、AD-001 |
| kind `light` | Mermaid `theme: 'default'` + `securityLevel: 'strict'` | §5 正常系 7、AD-004 |
| kind `dark` / `highContrast` | Mermaid `theme: 'dark'` + strict。全 kind 強制 `default` 禁止 | §5 正常系 7、AD-004 |
| 島ライト | `.mermaid-preview` / `.mermaid-block` に明るい固定サーフェス（例: `background-color: white`）を**強制しない** | §5 正常系 11、AD-005 |
| 広い面 | `#editor` 等に明るい固定背景を新設しない | §5 Non-Goals |
| HIP / XSS | `HTML_INTEGRATION_POINTS: { foreignobject: true }` 維持。`script` / `on*` 除去 | §5 正常系 10、AD-006 |
| ソース併記 | 図（`.mermaid-preview`）→ ソース（`.mermaid-source`）。Preview でも表示 | §5 正常系 4–5 |
| Preview RO | ソース領域の編集イベントを Document へ送らない | §1、§5 正常系 5 |
| Document 正本 | `docJson` / `markdownText` / serialize / dirty 不変 | AD-007 |
| `themeVariables` | `var(--vscode-...)` 再導入なし | `mermaid-theme-crash-fix` / AD-004 |

### Preconditions & Assumptions

- Webview Mermaid: `mermaid.render` → DOMPurify（HIP）→ `.mermaid-preview` 注入。SVG 内インライン `<style>` は CSP で無効化し得る
- ユニットはソース静的検査（CSP・CSS・theme helper・HIP options）＋既存 sanitize 実行経路で足りる。ピクセル完全一致・実機スクリーンショットは Non-Goal
- flowchart エッジ可視が本タスク必須受け入れ。他 diagram kind は発見次第セレクタ拡張（AD-003）— 本版では専用 TC なし

### Complexity Budget

- CSS / CSP / theme map / sanitize の局所契約。アルゴリズム計算量 N/A
- P2 Stress: 多数図のテーマ切替一括再描画は既存 §5 RK — 本 testspec では N/A

### Spec Gaps

- なし（UD なし・systemspec §5 反映済み）
- ピクセル「識別できる」は DOM/CSS/theme 契約で近似。実機目視は受け入れ補助（AD-012）
- per-diagram frontmatter `config.theme` 食い違いは仕様許容（§5 例外系 3 / RK-006）— 専用 TC なし
- sequence / class 等の他 kind エッジ欠線は Out（AD-003）

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-001 | Happy | edge-css-fallback-fill-none | P0 | Host 発行の Custom Editor HTML / `media/editor.css`（または nonce 付き `<style>`）を検査 | `.mermaid-preview`（必要なら `.mermaid-block`）スコープに flowchart エッジ／パス相当の `fill: none`（および stroke 可視に必要な最小規則）が存在する。ユーザー／Mermaid ソース由来の任意 CSS 注入経路はない | CSP で SVG 内 style が死んでも黒ブロブにならない（AD-002/003） | §5 正常系 11、AD-002 |
| TC-002 | Structural | csp-no-unsafe-inline | P0 | Custom Editor Webview CSP 生成（`markdown-editor-provider` 等） | `style-src` に `'unsafe-inline'` **なし**。`nonce-` 付き許可あり。Marp パネル CSP は本 TC 対象外 | セキュリティ不変（AD-001） | §9、AD-001 |
| TC-003 | Happy | theme-light-default | P0 | `buildMermaidThemeConfig('light')` | `theme: 'default'`、`securityLevel: 'strict'`、`themeVariables` に `var(--vscode-...)` なし | 標準マップ light | §5 正常系 7、AD-004 |
| TC-004 | Happy | theme-dark-dark | P0 | `buildMermaidThemeConfig('dark')` | `theme: 'dark'`（`'default'` 強制ではない）。strict。`var(--vscode-...)` なし | 島ライト撤回後の標準マップ | §5 正常系 7、AD-004 |
| TC-005 | Happy | theme-hc-dark | P0 | `buildMermaidThemeConfig('highContrast')` | `theme: 'dark'`。専用 HC パレット不要。strict | dark と同マップ（AD-004） | §5 正常系 7、AD-004 |
| TC-006 | Structural | no-island-light-forced | P0 | `.mermaid-preview` / `.mermaid-block` の CSS | 明るい固定サーフェス強制（例: `background-color: white` / 同等の島ライト強制）が**存在しない** | 島ライト撤回（AD-005） | §5 正常系 11、AD-005 |
| TC-007 | Corner | hip-regression | P0 | sanitize options（または contrast-readable TC-001/002 相当） | `HTML_INTEGRATION_POINTS: { foreignobject: true }`（または同等）。ラベル HTML 残存契約は contrast-readable と整合 | セキュリティ／可読性不変（AD-006） | §5 正常系 10、AD-006 |
| TC-008 | Structural | security-level-strict | P0 | `buildMermaidThemeConfig` 全 kind および initialize 経路 | いずれも `securityLevel: 'strict'` | strict 不変 | §5 正常系 7、AD-006 |
| TC-009 | Structural | source-below-diagram | P0 | Mermaid NodeView DOM 構築順 | `.mermaid-preview` が `.mermaid-source` より先（図の下にソース） | ソース併記回帰 | §5 正常系 4、snap-style |
| TC-010 | Corner | preview-source-readonly | P0 | Preview 表示中のソース領域 | 編集イベントを Document へ送らない（`contenteditable=false` またはイベント非送出） | Preview 厳密 RO | §1、§5 正常系 5 |
| TC-011 | Structural | editor-wide-bg-unchanged | P1 | `#editor` / 広い Preview 面の背景ルール | Mermaid 島以外で明るい固定背景を新設していない | 広い面変更禁止 | §5 Non-Goals、AD-005 |
| TC-012 | Structural | document-untouched | P1 | 変更対象パス（CSS / theme helper / NodeView 周辺） | `docJson` / `markdownText` / serialize / dirty / Marp / 画像 rewrite に触れない | 表示層限定（AD-007） | §1、AD-007 |
| TC-013 | Happy | theme-updated-uses-kind-map | P1 | `themeUpdated` で kind 切替後の `buildMermaidThemeConfig` 利用 | 再初期化は kind マップに従う（dark→`dark` 等）。Document 不変 | §5 正常系 9 | §5 正常系 9、AD-004 |
| TC-014 | Corner | related-suites-expected-aligned | P1 | contrast-readable / snap-style / wysiwyg TC-149 の Expected を照合 | 島ライト必須・全 kind `default` 期待が残っていない。TC-149 は light→default / dark|HC→dark | RK-005 防止 | AD-009 |
| TC-015 | Corner | xss-script-on-still-removed | P1 | ラベル付き SVG + `<script>` / `on*` を sanitize | script/on* 除去。安全ラベル残存（HIP 前提） | XSS 不変 | §5 例外系 1、§9 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-001, TC-003, TC-004, TC-005, TC-013 | — |
| Boundary | — | 空ソースは既存 Mermaid TC。本差分は契約検査が主 |
| Structural | TC-002, TC-006, TC-008, TC-009, TC-011, TC-012 | — |
| Corner | TC-007, TC-010, TC-014, TC-015 | — |
| Stress | — | 多数図再描画は既存 §5 RK。本タスク範囲外 |

### Complexity Notes

- ドメイン: VS Code Extension Webview（CSP / CSS / theme map / DOMPurify）
- 競技系ドメインパターン: N/A
- API / Worker: N/A（ローカル拡張）

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR） | `test_single`: `npm run test:unit -- --grep 'fix-mermaid-edge\|TC-00[1-9]\|TC-0[1][0-5]'` |
| P2 | — | 本 testspec に P2 なし |
| 回帰 | contrast-readable / snap-style / TC-152 / TC-130–132 / TC-149 | Expected 更新後に Red→Green |

想定配置: `src/test/suite/unit/fix-mermaid-edge-styles.test.ts`（`doc/stack.md` `test_file_glob`）

**実装メモ（testspec-implementation）:**

1. 本 suite で TC-001–015 を追加（本番コードは触らない → 意図的 Red）
2. `mermaid-contrast-readable.test.ts` / `mermaid-snap-style-with-source.test.ts` / `preview-mode-quality.test.ts` TC-149 を新 Expected に合わせて更新
3. エッジ規則の静的検査は `fill:\\s*none` と `.mermaid-preview` スコープの共起を最小 assert とする（セレクタ集合は実装に追随）

---

## Trace Results

実行: `npm run test:unit -- --grep 'fix-mermaid-edge|mermaid-contrast-readable|mermaid-snap-style|TC-149'`（2026-09-06）。本番未修正のため意図的 Red。

### TC-001 (P0): エッジ CSS フォールバック `fill: none`

| Step | State / Action | Value |
|------|----------------|-------|
| Input | Host HTML / `editor.css` | nonce 付き style |
| Output | `.mermaid-preview` スコープに `fill: none`（＋ stroke 最小規則） | AD-002 |

**Result:** ❌ Fail — 現行 `editor.css` にエッジフォールバックなし（`fill:none` 不在）

---

### TC-002 (P0): CSP に unsafe-inline なし

| Step | State / Action | Value |
|------|----------------|-------|
| Input | Custom Editor CSP | `style-src` |
| Output | nonce のみ、`unsafe-inline` 不在 | AD-001 |

**Result:** ✅ Pass — provider は nonce のみ

---

### TC-003–005 (P0): 標準 kind マップ

| Step | State / Action | Value |
|------|----------------|-------|
| Input | light / dark / highContrast | `buildMermaidThemeConfig` |
| Output | default / dark / dark | AD-004 |

**Result:** TC-003 ✅ Pass（light→default）。TC-004 / TC-005 ❌ Fail（現行全 kind `default`）

---

### TC-006 (P0): 島ライト強制なし

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `.mermaid-preview` CSS | — |
| Output | `background-color: white` 等の島ライト強制 **不在** | AD-005 |

**Result:** ❌ Fail — 現行 `background-color: white` あり

---

### TC-007–010 (P0): HIP / strict / ソース順 / Preview RO

**Result:** ✅ Pass — 既存契約継承

---

### TC-011–015 (P1)

| ID | Result | Notes |
|----|--------|-------|
| TC-011 | ✅ Pass | 広い面不変 |
| TC-012 | ✅ Pass | Document 非接触 |
| TC-013 | ❌ Fail | dark→`dark` 未実装（themeUpdated 経路） |
| TC-014 | ✅ Pass | 関連 suite Expected / テストコード整合 |
| TC-015 | ✅ Pass | XSS 除去＋ラベル残存 |

### Trace Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-001 | P0 | ❌ | エッジフォールバック未実装 |
| TC-002 | P0 | ✅ | CSP 現行維持 |
| TC-003 | P0 | ✅ | light→default |
| TC-004, TC-005 | P0 | ❌ | 現行全 kind default |
| TC-006 | P0 | ❌ | 島 white 残存 |
| TC-007–010 | P0 | ✅ | 回帰 |
| TC-011–012, TC-014–015 | P1 | ✅ | |
| TC-013 | P1 | ❌ | kind マップ未復帰 |

---

## Self-Check Report

### A. Input & Constraints
- [x] ✅ kind 三値: TC-003–005
- [x] ✅ CSP / nonce 入力: TC-001–002
- [x] N/A 整数オーバーフロー — UI/CSP 契約

### B. Structural Patterns
- [x] ✅ 島 vs 広い面: TC-006 / TC-011
- [x] ✅ DOM 順・Document 非接触: TC-009 / TC-012
- [x] ✅ CSP 構造: TC-002
- [x] N/A グラフ非連結 — 該当なし（エッジは CSS 契約）

### C. Corner & Failure
- [x] ✅ HIP / XSS / Preview RO: TC-007 / TC-010 / TC-015
- [x] ✅ 関連 suite 整合: TC-014
- [x] N/A API 404 — 該当なし

### D. Complexity & Resources
- [x] N/A 最悪計算量 — 表示契約

### E. API / Worker
- [x] N/A HTTP / 認証 — ローカル VS Code 拡張

### Uncovered / Spec Gaps
- flowchart 以外 diagram kind の欠線セレクタ — Out（AD-003）
- ピクセル目視「識別できる」— DOM/CSS/theme で近似
- per-diagram frontmatter theme 食い違い専用 TC なし（仕様許容）

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-06 | testspec-implementation: suite + 関連 Expected 追随。Trace 更新（意図的 Red） |
| 2026-09-06 | 初版 — nonce CSS エッジフォールバック・標準 kind マップ・島ライト撤廃・HIP/strict/ソース併記/Preview RO 回帰（設計のみ） |
