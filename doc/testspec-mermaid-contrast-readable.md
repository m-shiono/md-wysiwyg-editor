# Test Specification: mermaid-contrast-readable

## 概要

- **対象:** ダーク VS Code で Mermaid 図が黒塗り・ラベル不可視になる問題の修正契約 — (1) DOMPurify `HTML_INTEGRATION_POINTS` による `foreignObject` 内ラベル HTML 保持 (2) 島ライトキャンバス＋ライト系テーマ整合 (3) `script` / `on*` 除去継続 (4) `#editor` 等の広い面背景はダークのまま
- **対応仕様:** [doc/systemspec.md](systemspec.md) §5（正常系 7 / 10 / 11）、§9（正常系 3）、§1（Preview 可読性・Mermaid 島例外）
- **Requirements Brief:** `temporary/requirements-brief-mermaid-contrast-readable.md`（AD-001–010、UD-001=B）
- **Repro Digest:** `temporary/mermaid-contrast-repro-digest.md`
- **テストコード:** `src/test/suite/unit/mermaid-contrast-readable.test.ts`（実装済 — Red 確認 2026-09-05）。TC-152 回帰は既存 `src/test/suite/unit/fix-mermaid-dark-visibility.test.ts` を維持
- **作成日:** 2026-09-05

### TC-152 との関係（必須明示）

| 項目 | TC-152（既存） | 本 testspec（強化） |
|------|----------------|---------------------|
| 所在 | [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) / `fix-mermaid-dark-visibility.test.ts` | 本ファイル / 新規 suite |
| 検証粒度 | ソース走査: bare `DOMPurify.sanitize(svg)` 禁止、`ADD_TAGS:['foreignObject']` または `sanitizeMermaidSvg` helper | **実行時 sanitize:** fixture SVG を実際の sanitize 経路に通し、`foreignObject` **内**のラベル HTML（`div`/`span`/テキスト）が残ることを assert |
| HIP | 未検証（`ADD_TAGS` のみでも Pass し得る） | **必須:** `HTML_INTEGRATION_POINTS: { foreignobject: true }`（または同等）＋ラベル残存 |
| XSS | 契約文面のみ | 専用 TC で `script` / `on*` 除去を実行検証 |
| 島キャンバス / テーマ | 対象外 | ダーク kind → 島ライト＋`theme: 'default'`（または同等）、`#editor` 背景不変 |
| 扱い | **回帰維持**（deprecate しない） | **強化・新 TC**（TC-001+）。TC-152 Pass だけでは HIP 欠落を見逃す（repro digest） |

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| Mermaid SVG（sanitize 入力） | `string`（SVG markup） | 空に近い最小 SVG | — | flowchart 相当: `foreignObject` 内に XHTML `div`/`span` + ラベル文字列（例: `Cause A`） |
| DOMPurify options（実装） | object | — | — | `USE_PROFILES` svg/html、`ADD_TAGS:['foreignObject']`、**`HTML_INTEGRATION_POINTS: { foreignobject: true }`**（または同等）必須 |
| `themeUpdated.kind` | `'light' \| 'dark' \| 'highContrast'` | — | — | §1 postMessage。島ライトキャンバス時の実効テーマ入力 |
| VS Code カラーテーマ（観測） | dark / light / HC | — | — | ダーク時に島サーフェス・広い面背景を観測 |
| 対象 CSS スコープ | `.mermaid-preview` / `.mermaid-block` | — | — | 島のみ。`#editor` 全体は変更しない（UD-001=B） |

### Outputs & Failure Returns

| 条件 | 戻り値 / 期待状態 | 仕様根拠 |
|------|-------------------|---------|
| sanitize 成功（安全ラベル付き SVG） | `foreignObject` シェル＋内部ラベル HTML / テキスト残存。必要なら style/presentation も最小保持 | §5 正常系 10、§9 正常系 3 |
| sanitize + 危険要素混入 | `<script>` / `on*` 除去。ラベル用安全 HTML は残す | §5 例外系 1、§9、AD-001 |
| ダーク kind + 島ライトキャンバス | 島上 Mermaid `theme: 'default'`（または同等ライト系）。明るいキャンバス上で `theme: 'dark'` を使わない | §5 正常系 7、AD-006 |
| VS Code `light` | `theme: 'default'`。ライトで既に読める見た目は変えない | §5 正常系 7、AD-004 |
| ダーク時の広い面 | `#editor`（および広い Preview 面）の背景はダークのまま（島セレクタ以外で明るい固定背景を付けない） | §5 正常系 11、§1 例外、UD-001=B |
| 構文エラー | 既存 `.mermaid-error` 契約維持（本タスクで変更しない） | §5、AD-005 |
| Document 正本 | `docJson` / `markdownText` / serialize / dirty 不変 | AD-003 |

### Preconditions & Assumptions

- Webview Mermaid NodeView: `mermaid.render` → `sanitizeMermaidSvg`（または同等）→ `.mermaid-preview` 注入
- `securityLevel: 'strict'` および DOMPurify 経路は不変（AD-001）
- ユニットは fixture SVG + ソース/ CSS / theme helper 検査で足りる。ピクセル完全一致・実機スクリーンショットは Non-Goal
- TC-152 既存 suite は残し、本 suite は実行時契約を追加する

### Complexity Budget

- sanitize / CSS / theme map の局所契約。アルゴリズム計算量 N/A
- P2 Stress: 多数 Mermaid 一括再描画は既存 §5 RK 系 — 本 testspec では N/A

### Spec Gaps

- なし（UD-001=B・HIP・島ライト＋default は systemspec 反映済み）
- **既存 TC-149 整合:** [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) TC-149 は dark/highContrast → Mermaid `'dark'` を期待。本タスクの島ライト方針では **島上実効テーマは `'default'`（または同等）** に上書きされる（§5 正常系 7）。実装時は TC-149 期待値の更新または本 suite への委譲を `testspec-implementation` / build で整合させる
- ピクセルレベルの「識別できる」は自動テストでは DOM/CSS/theme 契約で近似。実機目視は受け入れ補助（AD-005）
- per-diagram frontmatter `config.theme` の食い違いは仕様許容（§5 例外系 3）— 専用 TC は任意（P2 相当・本版では設けない）

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-001 | Happy | hip-label-html-survive | P0 | flowchart 相当 SVG fixture（`<foreignObject><div xmlns=…>Cause A</div></foreignObject>`）を NodeView の sanitize 経路（`sanitizeMermaidSvg` または同等の実行可能関数）に通す | sanitize **実行後**の HTML に `foreignObject` があり、その**内部**にラベル文字列 `Cause A`（および `div` または同等ラベル要素）が残る。空シェル `<foreignObject></foreignObject>` のみは Fail | P0 HIP: `ADD_TAGS` だけでは子 HTML が落ちる（repro / TC-152 ギャップ） | §5 正常系 10、§9 正常系 3、AD-002/008 |
| TC-002 | Structural | hip-option-required | P0 | `media/editor.ts`（または sanitize 実装モジュール）の DOMPurify 呼び出し options を検査 | `HTML_INTEGRATION_POINTS` に `foreignobject: true`（または同等の HIP 有効化）が含まれる。`ADD_TAGS:['foreignObject']` のみでは本 TC Fail | HIP 欠落の静的検知 | §5 正常系 10、repro digest P0 |
| TC-003 | Corner | xss-script-on-removed | P0 | ラベル付き SVG に `<script>alert(1)</script>` および `onclick="…"`（または `onerror=`）を混入して sanitize | 出力に `script` タグなし、`on*` イベント属性なし。一方で安全な `foreignObject` ラベル文字列は残る | セキュリティ不変（AD-001） | §5 例外系 1、§9、AD-001 |
| TC-004 | Happy | dark-island-light-theme | P0 | VS Code kind `dark`（および `highContrast`）で島ライトキャンバス方針が有効なときの Mermaid グローバル／実効テーマ設定 | 島上は `theme: 'default'`（または同等ライト系）。明るいキャンバス上で `theme: 'dark'` を使わない。`themeVariables` に `var(--vscode-...)` なし。`securityLevel: 'strict'` 維持 | 黒塗り再発防止（AD-006） | §5 正常系 7、AD-006/010 |
| TC-005 | Happy | dark-island-light-canvas-css | P0 | ダーク想定で `.mermaid-preview` または `.mermaid-block` の CSS（`media/editor.css` 等）を検査 | 当該セレクタにスコープした明るいサーフェス（背景）が定義されている。セレクタが島に限定されている | UD-001=B 島のみ明るく | §5 正常系 11、§1 例外、AD-007 |
| TC-006 | Structural | editor-wide-bg-unchanged | P0 | `#editor`（および広い Preview 面用セレクタ）の背景ルールをダーク文脈で検査 | Mermaid 島以外で `#editor` / 広い面に明るい固定背景を新設していない。ダーク時の広い面はダークのまま | 全体背景変更の禁止（UD-001=B） | §5 Non-Goals、§1、AD-007 |
| TC-007 | Happy | light-theme-unchanged | P1 | kind `light` のテーママップ | `theme: 'default'`。ライト向け見た目をダーク用島例外で壊さない | AD-004 | §5 正常系 7、AD-004 |
| TC-008 | Boundary | empty-foreignobject-shell | P1 | 子なし `<foreignObject></foreignObject>` のみの SVG を sanitize | クラッシュせず。空シェルは許容（ラベル無し入力）。HIP 有無で落ちないこと | 空入力境界 | §5 Inputs |
| TC-009 | Corner | tc152-regression-still-green | P1 | 既存 suite `fix-mermaid-dark-visibility`（TC-152）を実行 | Pass を維持（bare sanitize 禁止 + foreignObject 許可経路） | 既存回帰の維持 | TC-152、AD-008 |
| TC-010 | Structural | document-untouched | P1 | 表示層変更（sanitize / CSS / theme）が serialize / dirty / `docJson` 経路に触れないことをソースまたは契約検査 | Mermaid 表示層ファイルに限定。Document 正本 API を変更しない | AD-003 | §1 Preview 表示層、AD-003 |
| TC-011 | Happy | high-contrast-no-silhouette-break | P1 | kind `highContrast` | 島上は dark と同様ライト系テーマ＋島キャンバス方針。専用 HC パレットは不要だが `theme: 'dark'` を明るい島に載せない | AD-010 | §5 正常系 7、AD-010 |
| TC-012 | Corner | text-node-label-also-kept | P1 | `foreignObject` 外の `<text>Simple Approach</text>` を含む fixture を sanitize | SVG `<text>` ラベル文字列も残る（flowchart 以外／併存） | シェル以外のラベル経路 | §5 正常系 10、AD-002 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-001, TC-004, TC-005, TC-007, TC-011, TC-012 | — |
| Boundary | TC-008 | — |
| Structural | TC-002, TC-006, TC-010 | — |
| Corner | TC-003, TC-009 | — |
| Stress | — | 多数図の再描画負荷は既存 §5 RK。本タスク範囲外 |

### Complexity Notes

- ドメイン: VS Code Extension Webview（DOMPurify / CSS / theme map）。HTTP API / Worker: N/A
- 競技系ドメインパターン: N/A（文字列・SVG markup の契約検証が主）

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR） | `test_single`: `npm run test:unit -- --grep 'mermaid-contrast\|TC-00[1-9]\|TC-0[12][0-9]\|TC-152'` |
| P2 | — | 本 testspec に P2 なし |
| 回帰 | 既存 TC-152 suite 継続 | `npm run test:unit -- --grep 'TC-152'` |

想定配置: `src/test/suite/unit/mermaid-contrast-readable.test.ts`（`doc/stack.md` `test_file_glob`）

**実装メモ（testspec-implementation）:** sanitize の実行検証は、`sanitizeMermaidSvg` を export するか、テスト専用に同一 options で DOMPurify を呼ぶ薄いラッパを用いる。ソース正規表現のみでは TC-001 / TC-003 を満たさない。

---

## Trace Results

### TC-001 (P0): HIP 付き sanitize 後もラベル HTML 残存

| Step | State / Action | Value |
|------|----------------|-------|
| Input | fixture SVG | `foreignObject` > `div` > `Cause A` |
| 1 | `sanitizeMermaidSvg(svg)`（実行） | DOMPurify + HIP |
| Output | 結果 HTML | `foreignObject` 内に `Cause A` 残存（空シェル不可） |

**Result:** ❌ Fail（2026-09-05）— 現行 `ADD_TAGS` のみで HIP なし → `Cause A` 除去

---

### TC-002 (P0): HIP option 必須

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `media/editor.ts` sanitize options | — |
| Output | `HTML_INTEGRATION_POINTS.foreignobject === true`（または同等） | 必須 |

**Result:** ❌ Fail（2026-09-05）— 現行 options に HIP なし

---

### TC-003 (P0): script / on* 除去継続

| Step | State / Action | Value |
|------|----------------|-------|
| Input | ラベル付き SVG + `<script>` + `onclick` | — |
| 1 | sanitize 実行 | — |
| Output | script/on* なし、ラベル残存 | §9 |

**Result:** ❌ Fail（2026-09-05）— script/on* は除去されるが HIP 欠落でラベルも落ちる

---

### TC-004 (P0): ダーク kind → 島上 theme default

| Step | State / Action | Value |
|------|----------------|-------|
| Input | kind `dark` / `highContrast` | 島ライト方針 |
| Output | Mermaid theme | `'default'`（または同等）。島上で `'dark'` 禁止 |

**Result:** ❌ Fail（2026-09-05）— 現行 `mermaid-theme.ts` は dark→`'dark'`（TC-149 と衝突。実装時に整合）

---

### TC-005 (P0): 島ライトキャンバス CSS

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `editor.css` 等 | `.mermaid-preview` / `.mermaid-block` |
| Output | スコープ付き明るい背景 | 島のみ |

**Result:** ❌ Fail（2026-09-05）— 島ライト背景未定義

---

### TC-006 (P0): `#editor` 広い面はダークのまま

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `#editor` 背景ルール | ダーク文脈 |
| Output | 島以外で明るい固定背景を新設していない | UD-001=B |

**Result:** ✅ Pass（2026-09-05）— `#editor` に明るい固定背景なし（回帰ガード）

---

### TC-007 (P1): light は default のまま

| Step | State / Action | Value |
|------|----------------|-------|
| Input | kind `light` | — |
| Output | `theme: 'default'` | AD-004 |

**Result:** ✅ Pass（2026-09-05）— light→default 一致

---

### TC-008 (P1): 空 foreignObject

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `<foreignObject></foreignObject>` | — |
| Output | 例外なし | 境界 |

**Result:** ✅ Pass（2026-09-05）— 例外なく完了

---

### TC-009 (P1): TC-152 回帰維持

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 既存 TC-152 suite | — |
| Output | Pass | AD-008 |

**Result:** ✅ Pass（2026-09-05）— bare sanitize 禁止 + helper 経路維持

---

### TC-010 (P1): Document 非接触

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 変更対象パス | media CSS/TS, mermaid-theme |
| Output | serialize/dirty 非変更 | AD-003 |

**Result:** ✅ Pass（2026-09-05）— serialize/document に sanitize 非混入

---

### TC-011 (P1): highContrast 破綻なし

| Step | State / Action | Value |
|------|----------------|-------|
| Input | kind `highContrast` | — |
| Output | 島上ライト系（dark と同方針） | AD-010 |

**Result:** ❌ Fail（2026-09-05）— 現行は highContrast→`'dark'`

---

### TC-012 (P1): SVG text ラベル残存

| Step | State / Action | Value |
|------|----------------|-------|
| Input | fixture with `<text>Simple Approach</text>` | — |
| Output | sanitize 後も文字列残存 | AD-002 |

**Result:** ✅ Pass（2026-09-05）— `<text>` は HIP なしでも残存

---

### Trace Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-001 | P0 | ❌ Fail | HIP 実行 — Cause A 除去 |
| TC-002 | P0 | ❌ Fail | HIP option 欠落 |
| TC-003 | P0 | ❌ Fail | ラベル残存要件で Fail（XSS 除去自体は動作） |
| TC-004 | P0 | ❌ Fail | dark→dark（default 要） |
| TC-005 | P0 | ❌ Fail | 島 CSS 未実装 |
| TC-006 | P0 | ✅ Pass | 広い面不変ガード |
| TC-007 | P1 | ✅ Pass | light→default |
| TC-008 | P1 | ✅ Pass | 空 FO |
| TC-009 | P1 | ✅ Pass | TC-152 契約 |
| TC-010 | P1 | ✅ Pass | AD-003 |
| TC-011 | P1 | ❌ Fail | HC→dark |
| TC-012 | P1 | ✅ Pass | text ラベル |

---

## Self-Check Report

### A. Input & Constraints
- [x] ✅ 最小 / 空: TC-008（空 foreignObject）
- [x] ✅ 代表ラベル文字列・危険混入: TC-001 / TC-003
- [x] N/A 最大値 / 整数オーバーフロー — SVG 文字列契約。大ファイル Stress は既存 TC

### B. Structural Patterns
- [x] ✅ HIP option 構造: TC-002
- [x] ✅ 島 vs 広い面セレクタ分離: TC-005 / TC-006
- [x] ✅ Document 非接触: TC-010
- [x] N/A グラフ非連結・ソート順 — 該当なし

### C. Corner & Failure
- [x] ✅ XSS 除去: TC-003
- [x] ✅ TC-152 回帰: TC-009
- [x] ✅ highContrast: TC-011
- [x] N/A 「解なし」API 404 — 該当なし

### D. Complexity & Resources
- [x] N/A 最悪計算量 / 再帰深度 — UI/sanitize 契約

### E. API / Worker
- [x] N/A HTTP / 認証 — ローカル VS Code 拡張

### Uncovered / Spec Gaps
- per-diagram frontmatter theme 食い違い（仕様許容）— 本版 TC なし
- ピクセル目視の「識別できる」— DOM/CSS/theme で近似
- TC-149（dark→dark）との期待値衝突は実装フェーズで整合（上記 Spec Gaps）

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-05 | 初版 — HIP ラベル残存・島ライト＋default・XSS 除去・広い面不変・TC-152 強化関係 |
| 2026-09-05 | testspec-implementation — `mermaid-contrast-readable.test.ts` Red 実行結果を Trace に反映（6 Fail / 6 Pass） |
