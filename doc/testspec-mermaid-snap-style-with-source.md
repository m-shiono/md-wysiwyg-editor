# Test Specification: mermaid-snap-style-with-source

## 概要

- **対象:** Mermaid Snap 風見た目条件（島ライトキャンバス＋全 VS Code kind でグローバル `theme: 'default'`）と、**Preview / Markdown 両モードでの図下ソース併記**。旧「Preview ソース非表示」撤回。HIP / `securityLevel: 'strict'` / DOMPurify は回帰維持
- **対応仕様:** [doc/systemspec.md](systemspec.md) §1（Preview Mermaid・島例外）、§5（正常系 4–5 / 7 / 9–11、Outputs）、§9（sanitize / strict）
- **Requirements Brief:** `temporary/requirements-brief-mermaid-snap-style-with-source.md`（AD-001–013）
- **関連 testspec:**
  - [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — **TC-130–132 Expected を本契約へ更新**（旧「Preview ソース非表示」撤回）。TC-082 表示層文言も整合
  - [testspec-mermaid-contrast-readable.md](testspec-mermaid-contrast-readable.md) — HIP・島ライト・XSS 回帰（deprecate しない）
- **テストコード:** `src/test/suite/unit/mermaid-snap-style-with-source.test.ts`（`unit-entry.ts` 登録済）。`preview-rich-embed.test.ts` TC-130–132 をソース表示 Expected に更新済（意図的 Red）
- **作成日:** 2026-09-05

### TC-130–132 / contrast-readable との関係（必須明示）

| 項目 | TC-130–132（wysiwyg） | contrast-readable | 本 testspec |
|------|----------------------|-------------------|-------------|
| 所在 | [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) / `preview-rich-embed.test.ts` | [testspec-mermaid-contrast-readable.md](testspec-mermaid-contrast-readable.md) | 本ファイル / 新規 suite |
| 旧契約 | Preview で `.mermaid-source` **非表示** | — | **撤回** |
| 新契約 | Preview / Markdown とも図＋ソース表示。Preview は厳密 RO。エラー時もソース表示 | — | **正本の詳細契約**（DOM 順・CSS 撤廃・全 kind default） |
| 島ライト / HIP | 対象外 | P0 本家 | **回帰参照**（再実装しない・Pass 維持を assert） |
| 扱い | Expected **更新**（deprecate しない）。本 suite と期待を揃える | **回帰維持** | **差分 TC**（ソース併記＋Snap 条件の明確化） |

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| `editorMode` | `"preview" \| "markdown" \| "raw"` | — | — | Preview / Markdown ともソース表示。Preview は RO（§1 / §5） |
| Mermaid NodeView DOM | `.mermaid-block` > `.mermaid-preview` + `.mermaid-source` | — | — | ブロック内順: 図 → ソース（AD-002） |
| CSS（Preview 非表示ルール） | `body[data-mode='preview'] .mermaid-source { display: none }` 等 | — | — | **撤廃対象**（AD-003） |
| `themeUpdated.kind` | `'light' \| 'dark' \| 'highContrast'` | — | — | いずれもグローバル `theme: 'default'`（AD-005） |
| `mermaidSource` | `string` | 0 文字 | — | 構文エラー時も Document 保持・DOM 上ソース表示（AD-010） |
| 島 CSS スコープ | `.mermaid-preview` / `.mermaid-block` | — | — | 明るいサーフェス。`#editor` 非対象（AD-006） |

### Outputs & Failure Returns

| 条件 | 戻り値 / 期待状態 | 仕様根拠 |
|------|-------------------|---------|
| Preview + 正常 Mermaid | `.mermaid-preview` 表示、`.mermaid-source` **表示**（`display: none` でない）。DOM 順は preview → source | §5 正常系 4、AD-001–003 |
| Markdown + 正常 Mermaid | 同上（両方表示・図下ソース） | §5 正常系 5、AD-002 |
| Preview + 構文エラー | `.mermaid-error`（または preview 領域エラー）＋`.mermaid-source` **表示のまま**。Document ソース保持 | §5 Outputs、AD-010 |
| Preview ソース領域操作 | 編集イベントを Document へ送らない（厳密 RO） | §1、§5 正常系 5、AD-004 |
| 全 kind テーマ | `mermaid.initialize` → `theme: 'default'`＋`securityLevel: 'strict'`。島上で `theme: 'dark'` 禁止 | §5 正常系 7、AD-005 |
| 島ライトキャンバス | `.mermaid-preview`（必要なら `.mermaid-block`）に明るいサーフェス | §5 正常系 11、AD-006 |
| 広い面 | `#editor` / 広い Preview 面の背景は島セレクタ以外で明るい固定背景を新設しない | §5 Non-Goals、AD-006 |
| HIP / XSS | `HTML_INTEGRATION_POINTS: { foreignobject: true }` 維持。`script` / `on*` 除去。strict 不変 | §5 正常系 10、§9、AD-008 |
| Document 正本 | `docJson` / `markdownText` / serialize / dirty 不変（表示層のみ） | AD-001 / AD-012 |
| `themeUpdated` | kind 変更でも島上は `default` のまま。再描画経路は維持 | §5 正常系 9、AD-013 |

### Preconditions & Assumptions

- Mermaid NodeView と `media/editor.css` が存在する（既存 DOM を維持し再発明しない — AD-002）
- `mermaid-contrast-readable` の島ライト＋HIP は前提として継承（AD-007）
- ユニットは CSS / DOM 順 / theme helper / ソース検査で足りる。Snap とのピクセル一致は Non-Goal（RK-002）
- テストコード・本番実装は本フェーズでは変更しない（設計のみ）

### Complexity Budget

- 表示層 CSS / theme map / NodeView 表示制御の局所契約。アルゴリズム計算量 N/A
- P2 Stress: 長いフェンスの Preview 占有（RK-004）は許容・専用 Stress TC は設けない

### Spec Gaps

- なし（UD なし・systemspec §1/§5 反映済み）
- **TC-149 整合:** [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) TC-149 は dark/highContrast → Mermaid `'dark'` を期待。本契約では **全 kind → `'default'`**。`testspec-implementation` で TC-149 Expected 更新または本 suite / contrast-readable への委譲を行う（本版では TC-130–132 を優先更新済み）
- ピクセル「識別できる」は DOM/CSS/theme 契約で近似。実機目視は受け入れ補助
- per-diagram frontmatter `config.theme` 食い違いは仕様許容（§5 例外系 3）— 専用 TC なし

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-001 | Happy | preview-source-visible | P0 | Preview（`body[data-mode="preview"]`）で有効 Mermaid ブロックを表示 | `.mermaid-source` が表示される（`display: none` / `visibility: hidden` 等で隠さない）。`.mermaid-preview` も表示 | 旧「Preview ソース非表示」撤回（AD-001）。TC-130 新契約 | §5 正常系 4、AD-001/003 |
| TC-002 | Structural | preview-hide-css-removed | P0 | `media/editor.css`（または同等）を検査 | `body[data-mode='preview'] .mermaid-source { display: none }`（および同等の Preview 専用ソース非表示ルール）が**存在しない** | CSS 撤廃の静的検知（AD-003） | §5 正常系 4、AD-003 |
| TC-003 | Structural | source-below-preview-order | P0 | Mermaid NodeView のブロック内 DOM（Preview または Markdown） | `.mermaid-preview` が `.mermaid-source` より**先**（図の下にソース） | Snap 風上下併記・DOM 再発明禁止（AD-002） | §5 正常系 4、AD-002 |
| TC-004 | Happy | markdown-source-visible | P0 | Markdown モードで同一 Mermaid ブロック | `.mermaid-preview` と `.mermaid-source` の両方が表示。DOM 順は preview → source | Markdown 併記維持・強化（TC-131 整合） | §5 正常系 5、AD-002 |
| TC-005 | Happy | all-kinds-theme-default | P0 | kind `light` / `dark` / `highContrast` それぞれで `buildMermaidThemeConfig`（または同等） | いずれも `theme: 'default'`。島上で `theme: 'dark'` を返さない。`themeVariables` に `var(--vscode-...)` なし。`securityLevel: 'strict'` | Snap 条件のテーマ固定（AD-005） | §5 正常系 7、AD-005 |
| TC-006 | Happy | island-light-canvas | P0 | `.mermaid-preview` / `.mermaid-block` の CSS | 島にスコープした明るいサーフェス（背景）が定義されている | Snap 条件の島キャンバス（AD-006）。contrast-readable 継承 | §5 正常系 11、AD-006/007 |
| TC-007 | Corner | preview-error-source-still-visible | P0 | Preview で不正 Mermaid 構文 | preview 領域に `.mermaid-error`（または同等）。`.mermaid-source` は**表示のまま**。Document ソース保持 | エラー時も非表示に戻さない（AD-010）。TC-132 新契約 | §5 Outputs、AD-010 |
| TC-008 | Corner | preview-source-readonly | P0 | Preview 表示中にソース領域へ編集イベント相当を送る / contenteditable 検査 | Document へ編集が反映されない。ソースは RO（`contenteditable=false` またはイベント非送出） | Preview 厳密 RO 維持（AD-004） | §1、§5 正常系 5、AD-004 |
| TC-009 | Structural | hip-strict-regression | P0 | sanitize options / `securityLevel` を検査（または contrast-readable TC-002 / TC-003 相当を再確認） | `HTML_INTEGRATION_POINTS: { foreignobject: true }`（または同等）あり。`securityLevel: 'strict'`。Snap 参考の sanitize なしは不採用 | セキュリティ不変（AD-008） | §5 正常系 10、§9、AD-008 |
| TC-010 | Structural | editor-wide-bg-unchanged | P1 | `#editor` / 広い Preview 面の背景ルール | Mermaid 島以外で明るい固定背景を新設していない | 面全体統一は Out（AD-006） | §5 Non-Goals、RK-001 |
| TC-011 | Structural | document-untouched | P1 | 表示層変更範囲（CSS / NodeView 表示 / theme）をソースまたは契約検査 | `docJson` / `markdownText` / serialize / dirty / Host / Marp / 画像 rewrite に触れない | 最小 diff・正本非接触（AD-001/012） | §1 表示層、AD-012 |
| TC-012 | Happy | theme-updated-stays-default | P1 | Preview 表示中に `themeUpdated` で kind を切替 | 再描画経路は維持。更新後も `theme: 'default'`＋strict。Document 不変 | AD-013 | §5 正常系 9、AD-013 |
| TC-013 | Corner | tc130-132-expected-aligned | P1 | wysiwyg TC-130–132 の Expected 文言と本 suite TC-001/004/007 を照合 | 旧「非表示」期待が残っていない。両所の Expected がソース表示で一致 | RK-006 防止 | AD-011 |
| TC-014 | Corner | contrast-readable-still-green | P1 | `mermaid-contrast-readable` suite（HIP・島ライト・XSS）を実行 | Pass 維持（本タスクで sanitize を緩めない） | 前回タスク回帰 | AD-007/008 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-001, TC-004, TC-005, TC-006, TC-012 | — |
| Boundary | — | 空ソースは既存 Mermaid TC。本差分は表示契約が主 |
| Structural | TC-002, TC-003, TC-009, TC-010, TC-011 | — |
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
2. 本 suite で CSS 撤廃・DOM 順・全 kind default・Preview RO を追加
3. TC-149 Expected は全 kind → default に整合（または本 suite TC-005 へ委譲明記）
4. 本番コードは build-agent（TDD Green）まで変更しない

---

## Trace Results

実行: `node ./out/test/runUnit.js --grep 'mermaid-snap'`（2026-09-05）。本番 `media/` 未変更のため **意図的 Red**。

### TC-001 (P0): Preview でソース表示

| Step | State / Action | Value |
|------|----------------|-------|
| Input | Preview + valid Mermaid | `body[data-mode="preview"]` CSS |
| Output | `.mermaid-source` / `.mermaid-preview` | 両方 visible（hide ルール不在） |

**Result:** ❌ Fail — `body[data-mode='preview'] .mermaid-source { display: none }` が残存

---

### TC-002 (P0): Preview 非表示 CSS 撤廃

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `editor.css` | Preview `.mermaid-source` 非表示ルール |
| Output | 当該ルール | 不在 |

**Result:** ❌ Fail — ルール存在（AD-003 未充足）

---

### TC-003 (P0): 図 → ソース DOM 順

| Step | State / Action | Value |
|------|----------------|-------|
| Input | Mermaid NodeView DOM | `media/editor.ts` |
| Output | preview が source より先行 | AD-002 |

**Result:** ✅ Pass

---

### TC-004 (P0): Markdown 両方表示

| Step | State / Action | Value |
|------|----------------|-------|
| Input | Markdown + Mermaid | CSS + NodeView |
| Output | preview + source visible、順 preview→source | TC-131 整合 |

**Result:** ✅ Pass

---

### TC-005 (P0): 全 kind → default

| Step | State / Action | Value |
|------|----------------|-------|
| Input | light / dark / highContrast | `buildMermaidThemeConfig` |
| Output | `theme: 'default'` + strict | AD-005 |

**Result:** ✅ Pass

---

### TC-006 (P0): 島ライトキャンバス

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `.mermaid-preview` CSS | — |
| Output | 明るいサーフェス | AD-006 |

**Result:** ✅ Pass

---

### TC-007 (P0): Preview エラー時もソース表示

| Step | State / Action | Value |
|------|----------------|-------|
| Input | Preview + invalid Mermaid | hide CSS + `.mermaid-error` |
| Output | error + source visible | AD-010 / TC-132 |

**Result:** ❌ Fail — Preview hide CSS 残存

---

### TC-008 (P0): Preview ソース RO

| Step | State / Action | Value |
|------|----------------|-------|
| Input | Preview ソース領域 | `setEditable(false)` 経路 |
| Output | Document 非更新 | AD-004 |

**Result:** ✅ Pass

---

### TC-009 (P0): HIP / strict 回帰

**Result:** ✅ Pass

### TC-010 (P1): 広い面背景不変

**Result:** ✅ Pass

### TC-011 (P1): Document 非接触

**Result:** ✅ Pass

### TC-012 (P1): themeUpdated 後も default

**Result:** ✅ Pass

### TC-013 (P1): TC-130–132 Expected 整合

**Result:** ✅ Pass — testspec + `preview-rich-embed` テストコードともソース表示契約

### TC-014 (P1): contrast-readable 回帰

**Result:** ✅ Pass

### Trace Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-001, TC-002, TC-007 | P0 | ❌ Fail | Preview `.mermaid-source` hide CSS 残存 — build-agent Green 対象 |
| TC-003–006, TC-008–009 | P0 | ✅ Pass | 既存 DOM / theme / HIP / RO |
| TC-010–014 | P1 | ✅ Pass | 広い面・Document・整合・回帰 |
| TC-130, TC-132（wysiwyg） | — | ❌ Fail | 同 hide CSS — Red 整合 |
| TC-131 | — | ✅ Pass | Markdown 非表示なし |

---

## Self-Check Report

### A. Input & Constraints
- [x] ✅ Preview / Markdown 両モード入力: TC-001 / TC-004
- [x] ✅ kind 三値: TC-005
- [x] N/A 整数オーバーフロー — UI/CSS 契約

### B. Structural Patterns
- [x] ✅ CSS 撤廃: TC-002
- [x] ✅ DOM 順: TC-003
- [x] ✅ Document 非接触 / 広い面: TC-010 / TC-011
- [x] N/A グラフ非連結 — 該当なし

### C. Corner & Failure
- [x] ✅ 構文エラー時ソース表示: TC-007
- [x] ✅ Preview RO: TC-008
- [x] ✅ HIP/strict・contrast 回帰: TC-009 / TC-014
- [x] N/A API 404 — 該当なし

### D. Complexity & Resources
- [x] N/A 最悪計算量 — 表示契約。長いフェンス Stress は RK-004 許容で省略

### E. API / Worker
- [x] N/A HTTP / 認証 — ローカル VS Code 拡張

### Uncovered / Spec Gaps
- TC-149（dark→dark）期待は実装フェーズで全 kind → default に整合（上記 Spec Gaps）
- Snap ピクセル一致・公式 dark 寄せは Non-Goal
- per-diagram frontmatter theme 食い違い専用 TC なし（仕様許容）

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-05 | testspec-implementation: suite + TC-130–132 Red。Trace 更新（TC-001/002/007 Fail） |
| 2026-09-05 | 初版 — Snap 風（島ライト＋全 kind default）・両モード図下ソース併記・Preview RO・HIP/strict 回帰。TC-130–132 関係明示 |
