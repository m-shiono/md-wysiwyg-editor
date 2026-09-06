# Test Specification: mermaid-snap-style-with-source

## 概要

- **対象:** **Preview / Markdown 両モードでの図下ソース併記**（旧「Preview ソース非表示」撤回）と、HIP / `securityLevel: 'strict'` / DOMPurify 回帰。見た目テーマは **VS Code kind 標準マップ**（`light`→`default`、`dark`/`highContrast`→`dark`）。**島ライト＋全 kind `default` は撤回**（`fix-mermaid-edge-styles`）
- **対応仕様:** [doc/systemspec.md](systemspec.md) §1（Preview Mermaid）、§5（正常系 4–5 / 7 / 9–11、Outputs）、§9（sanitize / strict）
- **Requirements Brief:** `temporary/requirements-brief-mermaid-snap-style-with-source.md`（AD-001–013）。テーマ／島は `temporary/requirements-brief-fix-mermaid-edge-styles.md` で上書き
- **関連 testspec:**
  - [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-130–132 Expected（ソース表示）。TC-149 標準 kind マップ
  - [testspec-mermaid-contrast-readable.md](testspec-mermaid-contrast-readable.md) — HIP・XSS・標準マップ／島撤廃（deprecate しない）
  - [testspec-fix-mermaid-edge-styles.md](testspec-fix-mermaid-edge-styles.md) — エッジ CSS フォールバック・テーマ／島の正本
- **テストコード:** `src/test/suite/unit/mermaid-snap-style-with-source.test.ts`（登録済）。**TC-005/006/012/014 Expected 追随済** — 2026-09-06
- **作成日:** 2026-09-05

### TC-130–132 / contrast-readable との関係（必須明示）

| 項目 | TC-130–132（wysiwyg） | contrast-readable | 本 testspec |
|------|----------------------|-------------------|-------------|
| 所在 | [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) / `preview-rich-embed.test.ts` | [testspec-mermaid-contrast-readable.md](testspec-mermaid-contrast-readable.md) | 本ファイル / suite |
| 旧契約 | Preview で `.mermaid-source` **非表示** | 島ライト＋ dark→`default` | 全 kind → `default`＋島ライト |
| 新契約 | Preview / Markdown とも図＋ソース表示。Preview は厳密 RO | 標準 kind マップ＋島ライト不在。HIP 維持 | **ソース併記＋Preview RO の正本**。テーマ／島は `fix-mermaid-edge-styles` と整合 |
| 扱い | Expected **更新済**（deprecate しない） | Expected **更新**（島撤回） | テーマ／島 Expected **更新**（`fix-mermaid-edge-styles`） |

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| `editorMode` | `"preview" \| "markdown" \| "raw"` | — | — | Preview / Markdown ともソース表示。Preview は RO（§1 / §5） |
| Mermaid NodeView DOM | `.mermaid-block` > `.mermaid-preview` + `.mermaid-source` | — | — | ブロック内順: 図 → ソース（AD-002） |
| CSS（Preview 非表示ルール） | `body[data-mode='preview'] .mermaid-source { display: none }` 等 | — | — | **撤廃対象**（AD-003） |
| `themeUpdated.kind` | `'light' \| 'dark' \| 'highContrast'` | — | — | 標準マップ: light→`default`、dark/HC→`dark`（`fix-mermaid-edge-styles`） |
| `mermaidSource` | `string` | 0 文字 | — | 構文エラー時も Document 保持・DOM 上ソース表示（AD-010） |
| 島 CSS スコープ | `.mermaid-preview` / `.mermaid-block` | — | — | **島ライト強制なし**。`#editor` 非対象 |

### Outputs & Failure Returns

| 条件 | 戻り値 / 期待状態 | 仕様根拠 |
|------|-------------------|---------|
| Preview + 正常 Mermaid | `.mermaid-preview` 表示、`.mermaid-source` **表示**（`display: none` でない）。DOM 順は preview → source | §5 正常系 4、AD-001–003 |
| Markdown + 正常 Mermaid | 同上（両方表示・図下ソース） | §5 正常系 5、AD-002 |
| Preview + 構文エラー | `.mermaid-error`（または preview 領域エラー）＋`.mermaid-source` **表示のまま**。Document ソース保持 | §5 Outputs、AD-010 |
| Preview ソース領域操作 | 編集イベントを Document へ送らない（厳密 RO） | §1、§5 正常系 5、AD-004 |
| kind テーマ | light→`default`、dark/HC→`dark`＋`securityLevel: 'strict'`。全 kind 強制 `default` 禁止 | §5 正常系 7、`fix-mermaid-edge-styles` |
| 島ライト | `.mermaid-preview` に明るい固定サーフェス強制 **なし** | §5 正常系 11、`fix-mermaid-edge-styles` AD-005 |
| 広い面 | `#editor` / 広い Preview 面の背景は明るい固定背景を新設しない | §5 Non-Goals |
| HIP / XSS | `HTML_INTEGRATION_POINTS: { foreignobject: true }` 維持。`script` / `on*` 除去。strict 不変 | §5 正常系 10、§9、AD-008 |
| Document 正本 | `docJson` / `markdownText` / serialize / dirty 不変（表示層のみ） | AD-001 / AD-012 |
| `themeUpdated` | kind マップに従い再初期化。Document 不変 | §5 正常系 9 |

### Preconditions & Assumptions

- Mermaid NodeView と `media/editor.css` が存在する（既存 DOM を維持し再発明しない — AD-002）
- `mermaid-contrast-readable` の HIP は前提として継承。テーマ／島は `fix-mermaid-edge-styles` と共有
- ユニットは CSS / DOM 順 / theme helper / ソース検査で足りる。Snap とのピクセル一致は Non-Goal（RK-002）
- 本フェーズは testspec 設計のみ（テストコード変更は `testspec-implementation`）

### Complexity Budget

- 表示層 CSS / theme map / NodeView 表示制御の局所契約。アルゴリズム計算量 N/A
- P2 Stress: 長いフェンスの Preview 占有（RK-004）は許容・専用 Stress TC は設けない

### Spec Gaps

- なし（ソース併記・Preview RO は維持。島ライト／全 kind `default` は撤回済み）
- **TC-149 整合:** light→`default` / dark|HC→`dark` で [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) TC-149・本 suite TC-005 と一致
- エッジ `fill: none` — [testspec-fix-mermaid-edge-styles.md](testspec-fix-mermaid-edge-styles.md) TC-001
- per-diagram frontmatter `config.theme` 食い違いは仕様許容 — 専用 TC なし

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-001 | Happy | preview-source-visible | P0 | Preview（`body[data-mode="preview"]`）で有効 Mermaid ブロックを表示 | `.mermaid-source` が表示される（`display: none` / `visibility: hidden` 等で隠さない）。`.mermaid-preview` も表示 | 旧「Preview ソース非表示」撤回（AD-001）。TC-130 新契約 | §5 正常系 4、AD-001/003 |
| TC-002 | Structural | preview-hide-css-removed | P0 | `media/editor.css`（または同等）を検査 | `body[data-mode='preview'] .mermaid-source { display: none }`（および同等の Preview 専用ソース非表示ルール）が**存在しない** | CSS 撤廃の静的検知（AD-003） | §5 正常系 4、AD-003 |
| TC-003 | Structural | source-below-preview-order | P0 | Mermaid NodeView のブロック内 DOM（Preview または Markdown） | `.mermaid-preview` が `.mermaid-source` より**先**（図の下にソース） | Snap 風上下併記・DOM 再発明禁止（AD-002） | §5 正常系 4、AD-002 |
| TC-004 | Happy | markdown-source-visible | P0 | Markdown モードで同一 Mermaid ブロック | `.mermaid-preview` と `.mermaid-source` の両方が表示。DOM 順は preview → source | Markdown 併記維持・強化（TC-131 整合） | §5 正常系 5、AD-002 |
| TC-005 | Happy | kind-theme-standard-map | P0 | kind `light` / `dark` / `highContrast` それぞれで `buildMermaidThemeConfig`（または同等） | light→`default`、dark→`dark`、highContrast→`dark`。`themeVariables` に `var(--vscode-...)` なし。`securityLevel: 'strict'`。全 kind 強制 `default` は Fail | 標準 kind マップ（`fix-mermaid-edge-styles`） | §5 正常系 7、AD-004 |
| TC-006 | Structural | no-island-light-forced | P0 | `.mermaid-preview` / `.mermaid-block` の CSS | 明るい固定サーフェス強制（例: `background-color: white`）が**存在しない** | 島ライト撤回。エッジ CSS は `fix-mermaid-edge-styles` | §5 正常系 11、AD-005 |
| TC-007 | Corner | preview-error-source-still-visible | P0 | Preview で不正 Mermaid 構文 | preview 領域に `.mermaid-error`（または同等）。`.mermaid-source` は**表示のまま**。Document ソース保持 | エラー時も非表示に戻さない（AD-010）。TC-132 新契約 | §5 Outputs、AD-010 |
| TC-008 | Corner | preview-source-readonly | P0 | Preview 表示中にソース領域へ編集イベント相当を送る / contenteditable 検査 | Document へ編集が反映されない。ソースは RO（`contenteditable=false` またはイベント非送出） | Preview 厳密 RO 維持（AD-004） | §1、§5 正常系 5、AD-004 |
| TC-009 | Structural | hip-strict-regression | P0 | sanitize options / `securityLevel` を検査（または contrast-readable TC-002 / TC-003 相当を再確認） | `HTML_INTEGRATION_POINTS: { foreignobject: true }`（または同等）あり。`securityLevel: 'strict'`。Snap 参考の sanitize なしは不採用 | セキュリティ不変（AD-008） | §5 正常系 10、§9、AD-008 |
| TC-010 | Structural | editor-wide-bg-unchanged | P1 | `#editor` / 広い Preview 面の背景ルール | Mermaid 島以外で明るい固定背景を新設していない | 面全体統一は Out（AD-006） | §5 Non-Goals、RK-001 |
| TC-011 | Structural | document-untouched | P1 | 表示層変更範囲（CSS / NodeView 表示 / theme）をソースまたは契約検査 | `docJson` / `markdownText` / serialize / dirty / Host / Marp / 画像 rewrite に触れない | 最小 diff・正本非接触（AD-001/012） | §1 表示層、AD-012 |
| TC-012 | Happy | theme-updated-follows-kind-map | P1 | Preview 表示中に `themeUpdated` で kind を切替 | 再描画経路は維持。更新後も kind マップ（dark→`dark` 等）＋strict。Document 不変 | §5 正常系 9 | §5 正常系 9、AD-004 |
| TC-013 | Corner | tc130-132-expected-aligned | P1 | wysiwyg TC-130–132 の Expected 文言と本 suite TC-001/004/007 を照合 | 旧「非表示」期待が残っていない。両所の Expected がソース表示で一致 | RK-006 防止 | AD-011 |
| TC-014 | Corner | hip-strict-no-island-regression | P1 | HIP option / `securityLevel: 'strict'` / 島ライト不在を検査（contrast-readable / `fix-mermaid-edge-styles` と整合） | HIP あり・strict・島ライト強制なし。sanitize を緩めない | 前回＋本タスク回帰 | AD-006/008 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-001, TC-004, TC-005, TC-012 | — |
| Boundary | — | 空ソースは既存 Mermaid TC。本差分は表示契約が主 |
| Structural | TC-002, TC-003, TC-006, TC-009, TC-010, TC-011 | — |
| Corner | TC-007, TC-008, TC-013, TC-014 | — |
| Stress | — | 長いフェンス占有（RK-004）は許容・専用 Stress なし |

### Complexity Notes

- ドメイン: VS Code Extension Webview（CSS / NodeView DOM / theme map）
- 競技系ドメインパターン: N/A

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR） | `test_single`: `npm run test:unit -- --grep 'mermaid-snap\|TC-00[1-9]\|TC-0[1][0-4]\|TC-13[0-2]'` |
| P2 | — | 本 testspec に P2 なし |
| 回帰 | contrast-readable + TC-152 | 既存 suite 継続 |

想定配置: `src/test/suite/unit/mermaid-snap-style-with-source.test.ts`（`doc/stack.md` `test_file_glob`）

**実装メモ（testspec-implementation）:**

1. `preview-rich-embed.test.ts` の TC-130 / TC-132 を新 Expected（ソース表示）へ更新し Red 確認
2. 本 suite で CSS 撤廃・DOM 順・標準 kind マップ・島ライト不在・Preview RO を検証
3. TC-149 / contrast-readable / `fix-mermaid-edge-styles` と Expected を整合
4. 本番コードは build-agent（TDD Green）まで変更しない

---

## Trace Results

設計更新（2026-09-06）。旧 Trace（島ライト／全 kind default Pass）は **Expected 撤回**。`testspec-implementation` で再実行。

### TC-001–004, TC-007–011, TC-013（ソース併記／RO／広い面）

**Result:** 既存契約維持 — Preview hide CSS 等は別途 Green 対象。本タスクで Expected 変更なし

---

### TC-005 (P0): 標準 kind マップ

| Step | State / Action | Value |
|------|----------------|-------|
| Input | light / dark / highContrast | `buildMermaidThemeConfig` |
| Output | default / dark / dark + strict | AD-004 |

**Result:** ❌ Fail — 現行全 kind `default` → dark/HC は Red

---

### TC-006 (P0): 島ライト強制なし

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `.mermaid-preview` CSS | — |
| Output | 明るい固定サーフェス **不在** | AD-005 |

**Result:** ❌ Fail — 現行 `background-color: white`

---

### TC-012 (P1): themeUpdated が kind マップに従う

**Result:** ❌ Fail — Expected 更新（旧: 常に default）。dark→`dark` 未実装

### TC-014 (P1): HIP / strict / 島不在回帰

**Result:** ❌ Fail — 島ライト必須 assert を撤廃し HIP/strict/島不在へ。島 white 残存で Fail

### Trace Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-001–004, TC-007–009 | P0 | ✅ | ソース併記／RO／HIP |
| TC-005, TC-006 | P0 | ❌ | テーママップ／島撤廃 — Red |
| TC-010–011, TC-013 | P1 | ✅ | 広い面／Document／TC-130 整合 |
| TC-012, TC-014 | P1 | ❌ | kind マップ／島不在 — Red |

---

## Self-Check Report

### A. Input & Constraints
- [x] ✅ Preview / Markdown 両モード入力: TC-001 / TC-004
- [x] ✅ kind 三値（標準マップ）: TC-005
- [x] N/A 整数オーバーフロー — UI/CSS 契約

### B. Structural Patterns
- [x] ✅ CSS 撤廃: TC-002
- [x] ✅ DOM 順: TC-003
- [x] ✅ 島ライト不在 / 広い面: TC-006 / TC-010
- [x] ✅ Document 非接触: TC-011
- [x] N/A グラフ非連結 — 該当なし

### C. Corner & Failure
- [x] ✅ 構文エラー時ソース表示: TC-007
- [x] ✅ Preview RO: TC-008
- [x] ✅ HIP/strict・島不在回帰: TC-009 / TC-014
- [x] N/A API 404 — 該当なし

### D. Complexity & Resources
- [x] N/A 最悪計算量 — 表示契約。長いフェンス Stress は RK-004 許容で省略

### E. API / Worker
- [x] N/A HTTP / 認証 — ローカル VS Code 拡張

### Uncovered / Spec Gaps
- エッジ `fill: none` — `fix-mermaid-edge-styles` に委譲
- Snap ピクセル一致・公式 dark 寄せは Non-Goal
- per-diagram frontmatter theme 食い違い専用 TC なし（仕様許容）
- TC-005/006/012/014 テストコードは新 Expected に追随済（2026-09-06）。本番未修正のため Red

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-06 | testspec-implementation: TC-005/006/012/014 テストコード追随。Trace 更新（意図的 Red） |
| 2026-09-06 | `fix-mermaid-edge-styles`: TC-005/006/012/014 Expected を標準 kind マップ＋島ライト撤廃へ更新。概要・Digest・Trace 整合 |
| 2026-09-05 | testspec-implementation: suite + TC-130–132 Red。Trace 更新（TC-001/002/007 Fail） |
| 2026-09-05 | 初版 — Snap 風（島ライト＋全 kind default）・両モード図下ソース併記・Preview RO・HIP/strict 回帰。TC-130–132 関係明示 |
