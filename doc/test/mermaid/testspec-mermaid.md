# Test Specification: mermaid (merged)

Mermaid 関連テスト契約の正本（AD-006）。旧 5 ファイルを統合。契約内容（現行 Expected）は不変。

- **対応仕様:** [doc/requirements/systemspec.md](../../requirements/systemspec.md) §5 / §9、[architecture.md](../../design/architecture.md) AD-007
- **テストコード:** `src/test/suite/unit/mermaid-*.test.ts` · `fix-mermaid-edge-styles.test.ts`（パス同期は build-agent / AD-009）
- **統合日:** 2026-09-19

## TC ID mapping（RK-003）

旧フラット testspec の TC ID と本ファイル内の一意 ID の対応。重複ドメイン契約は各 suite 節に現行 Expected を保持し、正本解釈は最新 suite（`redux-elk-fidelity` / `readable-viewport`）を優先する。

| Former (file#TC) | Merged TC ID | Suite |
|---|---|---|
| `testspec-mermaid-contrast-readable.md#TC-001` | `TC-MCR-001` | `contrast-readable` |
| `testspec-mermaid-contrast-readable.md#TC-002` | `TC-MCR-002` | `contrast-readable` |
| `testspec-mermaid-contrast-readable.md#TC-003` | `TC-MCR-003` | `contrast-readable` |
| `testspec-mermaid-contrast-readable.md#TC-004` | `TC-MCR-004` | `contrast-readable` |
| `testspec-mermaid-contrast-readable.md#TC-005` | `TC-MCR-005` | `contrast-readable` |
| `testspec-mermaid-contrast-readable.md#TC-006` | `TC-MCR-006` | `contrast-readable` |
| `testspec-mermaid-contrast-readable.md#TC-007` | `TC-MCR-007` | `contrast-readable` |
| `testspec-mermaid-contrast-readable.md#TC-008` | `TC-MCR-008` | `contrast-readable` |
| `testspec-mermaid-contrast-readable.md#TC-009` | `TC-MCR-009` | `contrast-readable` |
| `testspec-mermaid-contrast-readable.md#TC-010` | `TC-MCR-010` | `contrast-readable` |
| `testspec-mermaid-contrast-readable.md#TC-011` | `TC-MCR-011` | `contrast-readable` |
| `testspec-mermaid-contrast-readable.md#TC-012` | `TC-MCR-012` | `contrast-readable` |
| `testspec-mermaid-snap-style-with-source.md#TC-001` | `TC-MSS-001` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-002` | `TC-MSS-002` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-003` | `TC-MSS-003` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-004` | `TC-MSS-004` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-005` | `TC-MSS-005` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-006` | `TC-MSS-006` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-007` | `TC-MSS-007` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-008` | `TC-MSS-008` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-009` | `TC-MSS-009` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-010` | `TC-MSS-010` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-011` | `TC-MSS-011` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-012` | `TC-MSS-012` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-013` | `TC-MSS-013` | `snap-style-with-source` |
| `testspec-mermaid-snap-style-with-source.md#TC-014` | `TC-MSS-014` | `snap-style-with-source` |
| `testspec-fix-mermaid-edge-styles.md#TC-001` | `TC-FME-001` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-002` | `TC-FME-002` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-003` | `TC-FME-003` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-004` | `TC-FME-004` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-005` | `TC-FME-005` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-006` | `TC-FME-006` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-007` | `TC-FME-007` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-008` | `TC-FME-008` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-009` | `TC-FME-009` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-010` | `TC-FME-010` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-011` | `TC-FME-011` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-012` | `TC-FME-012` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-013` | `TC-FME-013` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-014` | `TC-FME-014` | `fix-mermaid-edge-styles` |
| `testspec-fix-mermaid-edge-styles.md#TC-015` | `TC-FME-015` | `fix-mermaid-edge-styles` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-001` | `TC-MRE-001` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-002` | `TC-MRE-002` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-003` | `TC-MRE-003` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-004` | `TC-MRE-004` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-005` | `TC-MRE-005` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-006` | `TC-MRE-006` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-007` | `TC-MRE-007` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-008` | `TC-MRE-008` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-009` | `TC-MRE-009` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-010` | `TC-MRE-010` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-011` | `TC-MRE-011` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-012` | `TC-MRE-012` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-013` | `TC-MRE-013` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-014` | `TC-MRE-014` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-015` | `TC-MRE-015` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-016` | `TC-MRE-016` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-017` | `TC-MRE-017` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-018` | `TC-MRE-018` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-019` | `TC-MRE-019` | `redux-elk-fidelity` |
| `testspec-mermaid-redux-elk-fidelity.md#TC-020` | `TC-MRE-020` | `redux-elk-fidelity` |
| `testspec-mermaid-readable-viewport.md#TC-001` | `TC-MRV-001` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-002` | `TC-MRV-002` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-003` | `TC-MRV-003` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-004` | `TC-MRV-004` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-005` | `TC-MRV-005` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-006` | `TC-MRV-006` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-007` | `TC-MRV-007` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-008` | `TC-MRV-008` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-009` | `TC-MRV-009` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-010` | `TC-MRV-010` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-011` | `TC-MRV-011` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-012` | `TC-MRV-012` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-013` | `TC-MRV-013` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-014` | `TC-MRV-014` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-015` | `TC-MRV-015` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-016` | `TC-MRV-016` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-017` | `TC-MRV-017` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-018` | `TC-MRV-018` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-019` | `TC-MRV-019` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-020` | `TC-MRV-020` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-021` | `TC-MRV-021` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-022` | `TC-MRV-022` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-023` | `TC-MRV-023` | `readable-viewport` |
| `testspec-mermaid-readable-viewport.md#TC-024` | `TC-MRV-024` | `readable-viewport`（`mermaid-default-preview-parity`） |
| `testspec-mermaid-readable-viewport.md#TC-025` | `TC-MRV-025` | `readable-viewport`（`mermaid-default-preview-parity`） |
| `testspec-mermaid-readable-viewport.md#TC-026` | `TC-MRV-026` | `readable-viewport`（`mermaid-default-preview-parity`） |
| `testspec-mermaid-readable-viewport.md#TC-027` | `TC-MRV-027` | `readable-viewport`（`mermaid-default-preview-parity`） |


---

## Suite: contrast-readable {#suite-contrast-readable}

> Former specification: `testspec-mermaid-contrast-readable.md`（統合前旧仕様書）

## 概要

- **対象:** ダーク VS Code で Mermaid 図が黒塗り・ラベル不可視になる問題の修正契約 — (1) DOMPurify `HTML_INTEGRATION_POINTS` による `foreignObject` 内ラベル HTML 保持 (2) VS Code kind → Mermaid redux 系マップ（`light`→`redux`、`dark`/`highContrast`→`redux-dark`）— classic `default`/`dark` および **島ライト強制は撤回**（`mermaid-redux-elk-fidelity` / `fix-mermaid-edge-styles`）(3) `script` / `on*` 除去継続 (4) `#editor` 等の広い面背景はダークのまま
- **対応仕様:** [doc/requirements/systemspec.md](../../requirements/systemspec.md) §5（正常系 7 / 10 / 11）、§9（正常系 3）、§1（Preview 可読性・Mermaid）
- **Requirements Brief:** `temporary/requirements-brief-mermaid-contrast-readable.md`（AD-001–010）。テーマは `temporary/requirements-brief-mermaid-redux-elk-fidelity.md` で上書き
- **後継差分:** [testspec-mermaid-redux-elk-fidelity.md](#suite-redux-elk-fidelity) — redux マップ・nonce 再注入・ELK の正本。島撤廃は [testspec-fix-mermaid-edge-styles.md](#suite-fix-mermaid-edge-styles) と共有
- **Repro Digest:** `temporary/mermaid-contrast-repro-digest.md`
- **テストコード:** `src/test/suite/unit/mermaid-contrast-readable.test.ts`（HIP 等実装済。**テーマ Expected は `mermaid-redux-elk-fidelity` で更新要**）
- **作成日:** 2026-09-05

### TC-MCR-152 との関係（必須明示）

| 項目 | TC-MCR-152（既存） | 本 testspec（強化） |
|------|----------------|---------------------|
| 所在 | [testspec-vsc-md-wysiwyg.md](../testspec-vsc-md-wysiwyg.md) / `fix-mermaid-dark-visibility.test.ts` | 本ファイル / suite |
| 検証粒度 | ソース走査: bare `DOMPurify.sanitize(svg)` 禁止、`ADD_TAGS:['foreignObject']` または `sanitizeMermaidSvg` helper | **実行時 sanitize:** fixture SVG を実際の sanitize 経路に通し、`foreignObject` **内**のラベル HTML（`div`/`span`/テキスト）が残ることを assert |
| HIP | 未検証（`ADD_TAGS` のみでも Pass し得る） | **必須:** `HTML_INTEGRATION_POINTS: { foreignobject: true }`（または同等）＋ラベル残存 |
| XSS | 契約文面のみ | 専用 TC で `script` / `on*` 除去を実行検証 |
| テーマ / 島 | 対象外 | **redux kind マップ**（dark/HC→`redux-dark`）。島ライト強制 **なし**。`#editor` 背景不変。presentation／ELK は `mermaid-redux-elk-fidelity` |
| 扱い | **回帰維持**（deprecate しない） | **強化 TC**（TC-MCR-001+）。classic マップ Expected は **撤回**（`mermaid-redux-elk-fidelity`） |

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| Mermaid SVG（sanitize 入力） | `string`（SVG markup） | 空に近い最小 SVG | — | flowchart 相当: `foreignObject` 内に XHTML `div`/`span` + ラベル文字列（例: `Cause A`） |
| DOMPurify options（実装） | object | — | — | `USE_PROFILES` svg/html、`ADD_TAGS:['foreignObject']`、**`HTML_INTEGRATION_POINTS: { foreignobject: true }`**（または同等）必須 |
| `themeUpdated.kind` | `'light' \| 'dark' \| 'highContrast'` | — | — | §1 postMessage。redux kind マップ入力 |
| VS Code カラーテーマ（観測） | dark / light / HC | — | — | ダーク時は `redux-dark`＋広い面背景を観測 |
| 対象 CSS スコープ | `.mermaid-preview` / `.mermaid-block` | — | — | **島ライト強制なし**。`#editor` 全体は変更しない |

### Outputs & Failure Returns

| 条件 | 戻り値 / 期待状態 | 仕様根拠 |
|------|-------------------|---------|
| sanitize 成功（安全ラベル付き SVG） | `foreignObject` シェル＋内部ラベル HTML / テキスト残存。必要なら style/presentation も最小保持 | §5 正常系 10、§9 正常系 3 |
| sanitize + 危険要素混入 | `<script>` / `on*` 除去。ラベル用安全 HTML は残す | §5 例外系 1、§9、AD-001 |
| kind `dark` / `highContrast` | Mermaid `theme: 'redux-dark'`。`themeVariables.fontSize === '16px'`。`themeVariables` に `var(--vscode-...)` なし。`securityLevel: 'strict'` | §5 正常系 7 / 7a、`mermaid-display-density` |
| VS Code `light` | `theme: 'redux'` | §5 正常系 7、`mermaid-redux-elk-fidelity` AD-004 |
| 島ライト | `.mermaid-preview` / `.mermaid-block` に明るい固定サーフェス強制（例: `background-color: white`）を**置かない** | §5 正常系 11、`fix-mermaid-edge-styles` AD-005 |
| ダーク時の広い面 | `#editor`（および広い Preview 面）の背景はダークのまま（明るい固定背景を新設しない） | §5 Non-Goals |
| 構文エラー | 既存 `.mermaid-error` 契約維持（本タスクで変更しない） | §5 |
| Document 正本 | `docJson` / `markdownText` / serialize / dirty 不変 | AD-003 |

### Preconditions & Assumptions

- Webview Mermaid NodeView: `mermaid.render` → `sanitizeMermaidSvg`（または同等）→ `.mermaid-preview` 注入
- `securityLevel: 'strict'` および DOMPurify 経路は不変（AD-001）
- ユニットは fixture SVG + ソース/ CSS / theme helper 検査で足りる。ピクセル完全一致・実機スクリーンショットは Non-Goal
- TC-MCR-152 既存 suite は残し、本 suite は実行時契約を追加する

### Complexity Budget

- sanitize / CSS / theme map の局所契約。アルゴリズム計算量 N/A
- P2 Stress: 多数 Mermaid 一括再描画は既存 §5 RK 系 — 本 testspec では N/A

### Spec Gaps

- なし（HIP 維持。classic `default`/`dark`・島ライトは撤回済み — systemspec §5 / `mermaid-redux-elk-fidelity`）
- **TC-MCR-149 整合:** [testspec-vsc-md-wysiwyg.md](../testspec-vsc-md-wysiwyg.md) TC-MCR-149（light→`redux` / dark|HC→`redux-dark`）と本 suite TC-MCR-004/007/011 は **一致**。nonce／ELK は [testspec-mermaid-redux-elk-fidelity.md](#suite-redux-elk-fidelity)
- ピクセルレベルの「識別できる」は DOM/CSS/theme 契約で近似。実機目視は受け入れ補助
- per-diagram frontmatter `config.theme` の食い違いは仕様許容（§5 例外系 3）— 専用 TC なし

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-MCR-001 | Happy | hip-label-html-survive | P0 | flowchart 相当 SVG fixture（`<foreignObject><div xmlns=…>Cause A</div></foreignObject>`）を NodeView の sanitize 経路（`sanitizeMermaidSvg` または同等の実行可能関数）に通す | sanitize **実行後**の HTML に `foreignObject` があり、その**内部**にラベル文字列 `Cause A`（および `div` または同等ラベル要素）が残る。空シェル `<foreignObject></foreignObject>` のみは Fail | P0 HIP: `ADD_TAGS` だけでは子 HTML が落ちる（repro / TC-MCR-152 ギャップ） | §5 正常系 10、§9 正常系 3、AD-002/008 |
| TC-MCR-002 | Structural | hip-option-required | P0 | `media/editor.ts`（または sanitize 実装モジュール）の DOMPurify 呼び出し options を検査 | `HTML_INTEGRATION_POINTS` に `foreignobject: true`（または同等の HIP 有効化）が含まれる。`ADD_TAGS:['foreignObject']` のみでは本 TC Fail | HIP 欠落の静的検知 | §5 正常系 10、repro digest P0 |
| TC-MCR-003 | Corner | xss-script-on-removed | P0 | ラベル付き SVG に `<script>alert(1)</script>` および `onclick="…"`（または `onerror=`）を混入して sanitize | 出力に `script` タグなし、`on*` イベント属性なし。一方で安全な `foreignObject` ラベル文字列は残る | セキュリティ不変（AD-001） | §5 例外系 1、§9、AD-001 |
| TC-MCR-004 | Happy | dark-kind-theme-redux-dark | P0 | VS Code kind `dark`（および `highContrast`）の Mermaid グローバルテーマ設定 | `theme: 'redux-dark'`。`themeVariables.fontSize === '16px'`。`themeVariables` に `var(--vscode-...)` なし。`securityLevel: 'strict'` 維持。classic `'dark'` / 全 kind 強制 `'default'` は Fail | redux kind マップ＋密度 | §5 正常系 7 / 7a、`mermaid-display-density` |
| TC-MCR-005 | Structural | no-island-light-forced | P0 | `.mermaid-preview` または `.mermaid-block` の CSS（`media/editor.css` 等）を検査 | 明るい固定サーフェス強制（例: `background-color: white`）が**存在しない**。エッジ可視は `mermaid-redux-elk-fidelity`（nonce 再注入優先）／`fix-mermaid-edge-styles` TC-MCR-001 | 島ライト撤回（AD-005） | §5 正常系 11 |
| TC-MCR-006 | Structural | editor-wide-bg-unchanged | P0 | `#editor`（および広い Preview 面用セレクタ）の背景ルールをダーク文脈で検査 | `#editor` / 広い面に明るい固定背景を新設していない。ダーク時の広い面はダークのまま | 全体背景変更の禁止 | §5 Non-Goals、§1 |
| TC-MCR-007 | Happy | light-theme-redux | P1 | kind `light` のテーママップ | `theme: 'redux'`。`themeVariables.fontSize === '16px'`。`var(--vscode-...)` なし | redux＋密度 | §5 正常系 7 / 7a、`mermaid-display-density` |
| TC-MCR-008 | Boundary | empty-foreignobject-shell | P1 | 子なし `<foreignObject></foreignObject>` のみの SVG を sanitize | クラッシュせず。空シェルは許容（ラベル無し入力）。HIP 有無で落ちないこと | 空入力境界 | §5 Inputs |
| TC-MCR-009 | Corner | tc152-regression-still-green | P1 | 既存 suite `fix-mermaid-dark-visibility`（TC-MCR-152）を実行 | Pass を維持（bare sanitize 禁止 + foreignObject 許可経路） | 既存回帰の維持 | TC-MCR-152、AD-008 |
| TC-MCR-010 | Structural | document-untouched | P1 | 表示層変更（sanitize / CSS / theme）が serialize / dirty / `docJson` 経路に触れないことをソースまたは契約検査 | Mermaid 表示層ファイルに限定。Document 正本 API を変更しない | AD-003 | §1 Preview 表示層、AD-003 |
| TC-MCR-011 | Happy | high-contrast-maps-to-redux-dark | P1 | kind `highContrast` | `theme: 'redux-dark'`（TC-MCR-004 と同マップ）。`themeVariables.fontSize === '16px'`。専用 HC パレットは不要 | redux-dark＋密度 | §5 正常系 7 / 7a、`mermaid-display-density` |
| TC-MCR-012 | Corner | text-node-label-also-kept | P1 | `foreignObject` 外の `<text>Simple Approach</text>` を含む fixture を sanitize | SVG `<text>` ラベル文字列も残る（flowchart 以外／併存） | シェル以外のラベル経路 | §5 正常系 10、AD-002 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-MCR-001, TC-MCR-004, TC-MCR-007, TC-MCR-011, TC-MCR-012 | — |
| Boundary | TC-MCR-008 | — |
| Structural | TC-MCR-002, TC-MCR-005, TC-MCR-006, TC-MCR-010 | — |
| Corner | TC-MCR-003, TC-MCR-009 | — |
| Stress | — | 多数図の再描画負荷は既存 §5 RK。本タスク範囲外 |

### Complexity Notes

- ドメイン: VS Code Extension Webview（DOMPurify / CSS / theme map）。HTTP API / Worker: N/A
- 競技系ドメインパターン: N/A（文字列・SVG markup の契約検証が主）

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR） | `test_single`: `npm run test:unit -- --grep 'mermaid-contrast\|TC-MCR-00[1-9]\|TC-MCR-0[12][0-9]\|TC-MCR-152'` |
| P2 | — | 本 testspec に P2 なし |
| 回帰 | 既存 TC-MCR-152 suite 継続 | `npm run test:unit -- --grep 'TC-MCR-152'` |

想定配置: `src/test/suite/unit/mermaid-contrast-readable.test.ts`（`.cursor/stack.md` `test_file_glob`）

**実装メモ（testspec-implementation）:** sanitize の実行検証は、`sanitizeMermaidSvg` を export するか、テスト専用に同一 options で DOMPurify を呼ぶ薄いラッパを用いる。ソース正規表現のみでは TC-MCR-001 / TC-MCR-003 を満たさない。

---

## Trace Results

### TC-MCR-001 (P0): HIP 付き sanitize 後もラベル HTML 残存

| Step | State / Action | Value |
|------|----------------|-------|
| Input | fixture SVG | `foreignObject` > `div` > `Cause A` |
| 1 | `sanitizeMermaidSvg(svg)`（実行） | DOMPurify + HIP |
| Output | 結果 HTML | `foreignObject` 内に `Cause A` 残存（空シェル不可） |

**Result:** ❌ Fail（2026-09-05）— 現行 `ADD_TAGS` のみで HIP なし → `Cause A` 除去

---

### TC-MCR-002 (P0): HIP option 必須

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `media/editor.ts` sanitize options | — |
| Output | `HTML_INTEGRATION_POINTS.foreignobject === true`（または同等） | 必須 |

**Result:** ❌ Fail（2026-09-05）— 現行 options に HIP なし

---

### TC-MCR-003 (P0): script / on* 除去継続

| Step | State / Action | Value |
|------|----------------|-------|
| Input | ラベル付き SVG + `<script>` + `onclick` | — |
| 1 | sanitize 実行 | — |
| Output | script/on* なし、ラベル残存 | §9 |

**Result:** ❌ Fail（2026-09-05）— script/on* は除去されるが HIP 欠落でラベルも落ちる

---

### TC-MCR-004 (P0): ダーク kind → theme redux-dark

| Step | State / Action | Value |
|------|----------------|-------|
| Input | kind `dark` / `highContrast` | redux マップ |
| Output | Mermaid theme | `'redux-dark'`。classic `'dark'` / 強制 `'default'` は Fail |

**Result:** ⬜ Pending — Expected を classic→redux-dark に更新。テストコード未追随

---

### TC-MCR-005 (P0): 島ライト強制なし

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `editor.css` 等 | `.mermaid-preview` / `.mermaid-block` |
| Output | 明るい固定サーフェス強制 **不在** | AD-005 |

**Result:** ❌ Fail（2026-09-06）— 現行 `background-color: white` あり → 島ライト強制不在に Fail

---

### TC-MCR-006 (P0): `#editor` 広い面はダークのまま

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `#editor` 背景ルール | ダーク文脈 |
| Output | 明るい固定背景を新設していない | Non-Goals |

**Result:** ✅ Pass（2026-09-05）— `#editor` に明るい固定背景なし（回帰ガード）

---

### TC-MCR-007 (P1): light は redux

| Step | State / Action | Value |
|------|----------------|-------|
| Input | kind `light` | — |
| Output | `theme: 'redux'` | `mermaid-redux-elk-fidelity` AD-004 |

**Result:** ⬜ Pending — Expected 更新（旧: `default`）

---

### TC-MCR-008 (P1): 空 foreignObject

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `<foreignObject></foreignObject>` | — |
| Output | 例外なし | 境界 |

**Result:** ✅ Pass（2026-09-05）— 例外なく完了

---

### TC-MCR-009 (P1): TC-MCR-152 回帰維持

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 既存 TC-MCR-152 suite | — |
| Output | Pass | AD-008 |

**Result:** ✅ Pass（2026-09-05）— bare sanitize 禁止 + helper 経路維持

---

### TC-MCR-010 (P1): Document 非接触

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 変更対象パス | media CSS/TS, mermaid-theme |
| Output | serialize/dirty 非変更 | AD-003 |

**Result:** ✅ Pass（2026-09-05）— serialize/document に sanitize 非混入

---

### TC-MCR-011 (P1): highContrast → redux-dark

| Step | State / Action | Value |
|------|----------------|-------|
| Input | kind `highContrast` | — |
| Output | `theme: 'redux-dark'`（TC-MCR-004 と同方針） | `mermaid-redux-elk-fidelity` AD-004 |

**Result:** ⬜ Pending — Expected 更新（旧: classic `'dark'`）
---

### TC-MCR-012 (P1): SVG text ラベル残存

| Step | State / Action | Value |
|------|----------------|-------|
| Input | fixture with `<text>Simple Approach</text>` | — |
| Output | sanitize 後も文字列残存 | AD-002 |

**Result:** ✅ Pass（2026-09-05）— `<text>` は HIP なしでも残存

---

### Trace Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-MCR-001 | P0 | ✅ Pass | HIP ラベル残存（2026-09-06 再実行） |
| TC-MCR-002 | P0 | ✅ Pass | HIP option |
| TC-MCR-003 | P0 | ✅ Pass | XSS 除去＋ラベル残存 |
| TC-MCR-004 | P0 | ⬜ | Expected: dark→redux-dark |
| TC-MCR-005 | P0 | ❌ Fail | Expected: 島ライト強制 **不在** |
| TC-MCR-006 | P0 | ✅ Pass | 広い面不変ガード |
| TC-MCR-007 | P1 | ⬜ | Expected: light→redux |
| TC-MCR-008 | P1 | ✅ Pass | 空 FO |
| TC-MCR-009 | P1 | ✅ Pass | TC-MCR-152 契約 |
| TC-MCR-010 | P1 | ✅ Pass | AD-003 |
| TC-MCR-011 | P1 | ⬜ | Expected: HC→redux-dark |
| TC-MCR-012 | P1 | ✅ Pass | text ラベル |

---

## Self-Check Report

### A. Input & Constraints
- [x] ✅ 最小 / 空: TC-MCR-008（空 foreignObject）
- [x] ✅ 代表ラベル文字列・危険混入: TC-MCR-001 / TC-MCR-003
- [x] N/A 最大値 / 整数オーバーフロー — SVG 文字列契約。大ファイル Stress は既存 TC

### B. Structural Patterns
- [x] ✅ HIP option 構造: TC-MCR-002
- [x] ✅ 島ライト撤廃 / 広い面: TC-MCR-005 / TC-MCR-006
- [x] ✅ Document 非接触: TC-MCR-010
- [x] N/A グラフ非連結・ソート順 — 該当なし

### C. Corner & Failure
- [x] ✅ XSS 除去: TC-MCR-003
- [x] ✅ TC-MCR-152 回帰: TC-MCR-009
- [x] ✅ highContrast→redux-dark: TC-MCR-011
- [x] N/A 「解なし」API 404 — 該当なし

### D. Complexity & Resources
- [x] N/A 最悪計算量 / 再帰深度 — UI/sanitize 契約

### E. API / Worker
- [x] N/A HTTP / 認証 — ローカル VS Code 拡張

### Uncovered / Spec Gaps
- per-diagram frontmatter theme 食い違い（仕様許容）— 本版 TC なし
- ピクセル目視の「識別できる」— DOM/CSS/theme で近似
- nonce 再注入・ELK・Host CSS 縮小 — [testspec-mermaid-redux-elk-fidelity.md](#suite-redux-elk-fidelity) に委譲
- TC-MCR-004/007/011 Expected は redux 系へ更新（2026-09-06 design）。テストコード追随は testspec-implementation

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-26 | `mermaid-default-preview-parity`: TC-MCR-004/007/011 および Spec Digest Outputs のグローバル `fontSize` Expected を `'12px'` → `'16px'` に更新 |
| 2026-09-06 | `mermaid-readable-viewport`: TC-MCR-004/007/011 および Spec Digest Outputs のグローバル `fontSize` を `'13px'` → `'8px'` に更新 |
| 2026-09-06 | 密度 polish: Expected のグローバル `fontSize` を `'8px'` → `'12px'` に更新 |
| 2026-09-06 | `mermaid-display-density`: TC-MCR-004/007/011 Expected に `themeVariables.fontSize === '13px'`（`var(--vscode-...)` なし）を追加 |
| 2026-09-06 | `mermaid-redux-elk-fidelity`: TC-MCR-004/007/011 Expected を `redux`/`redux-dark` へ更新。classic `default`/`dark` 撤回。概要・Digest・Trace 整合 |
| 2026-09-06 | testspec-implementation: TC-MCR-004/005/011 テストコードを標準 kind マップ＋島撤廃へ追随。Trace 更新 |
| 2026-09-06 | `fix-mermaid-edge-styles`: TC-MCR-004/005/011 Expected を標準 kind マップ＋島ライト撤廃へ更新。概要・Spec Digest・Trace 整合 |
| 2026-09-05 | 初版 — HIP ラベル残存・島ライト＋default・XSS 除去・広い面不変・TC-MCR-152 強化関係 |
| 2026-09-05 | testspec-implementation — `mermaid-contrast-readable.test.ts` Red 実行結果を Trace に反映（6 Fail / 6 Pass） |
| 2026-09-06 | ノード寸法 polish（choice B）: Expected のグローバル `fontSize` を `'10px'` → `'12px'` に更新 |

## Suite: snap-style-with-source {#suite-snap-style-with-source}

> Former specification: `testspec-mermaid-snap-style-with-source.md`（統合前旧仕様書）

## 概要

- **対象:** **Preview / Markdown 両モードでの図下ソース併記**（旧「Preview ソース非表示」撤回）と、HIP / `securityLevel: 'strict'` / DOMPurify 回帰。見た目テーマは **VS Code kind → Mermaid redux 系マップ**（`light`→`redux`、`dark`/`highContrast`→`redux-dark`）。**島ライト＋ classic `default`/`dark` は撤回**（`mermaid-redux-elk-fidelity` / `fix-mermaid-edge-styles`）
- **対応仕様:** [doc/requirements/systemspec.md](../../requirements/systemspec.md) §1（Preview Mermaid）、§5（正常系 4–5 / 7 / 9–11、Outputs）、§9（sanitize / strict）
- **Requirements Brief:** `temporary/requirements-brief-mermaid-snap-style-with-source.md`（AD-001–013）。テーマは `temporary/requirements-brief-mermaid-redux-elk-fidelity.md` で上書き
- **関連 testspec:**
  - [testspec-vsc-md-wysiwyg.md](../testspec-vsc-md-wysiwyg.md) — TC-MSS-130–132 Expected（ソース表示）。TC-MSS-149 redux kind マップ
  - [testspec-mermaid-contrast-readable.md](#suite-contrast-readable) — HIP・XSS・redux マップ／島撤廃（deprecate しない）
  - [testspec-mermaid-redux-elk-fidelity.md](#suite-redux-elk-fidelity) — redux／nonce／ELK の正本
  - [testspec-fix-mermaid-edge-styles.md](#suite-fix-mermaid-edge-styles) — 島撤廃・CSP 回帰（Host CSS 縮小）
- **テストコード:** `src/test/suite/unit/mermaid-snap-style-with-source.test.ts`（登録済）。**テーマ Expected は `mermaid-redux-elk-fidelity` で更新要**
- **作成日:** 2026-09-05

### TC-MSS-130–132 / contrast-readable との関係（必須明示）

| 項目 | TC-MSS-130–132（wysiwyg） | contrast-readable | 本 testspec |
|------|----------------------|-------------------|-------------|
| 所在 | [testspec-vsc-md-wysiwyg.md](../testspec-vsc-md-wysiwyg.md) / `preview-rich-embed.test.ts` | [testspec-mermaid-contrast-readable.md](#suite-contrast-readable) | 本ファイル / suite |
| 旧契約 | Preview で `.mermaid-source` **非表示** | 島ライト＋ classic default/dark | classic マップ＋島ライト |
| 新契約 | Preview / Markdown とも図＋ソース表示。Preview は厳密 RO | redux マップ＋島ライト不在。HIP 維持 | **ソース併記＋Preview RO の正本**。テーマは `mermaid-redux-elk-fidelity` と整合 |
| 扱い | Expected **更新済**（deprecate しない） | Expected **更新**（redux） | テーマ Expected **更新**（`mermaid-redux-elk-fidelity`） |

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| `editorMode` | `"preview" \| "markdown" \| "raw"` | — | — | Preview / Markdown ともソース表示。Preview は RO（§1 / §5） |
| Mermaid NodeView DOM | `.mermaid-block` > `.mermaid-preview` + `.mermaid-source` | — | — | ブロック内順: 図 → ソース（AD-002） |
| CSS（Preview 非表示ルール） | `body[data-mode='preview'] .mermaid-source { display: none }` 等 | — | — | **撤廃対象**（AD-003） |
| `themeUpdated.kind` | `'light' \| 'dark' \| 'highContrast'` | — | — | redux マップ: light→`redux`、dark/HC→`redux-dark`（`mermaid-redux-elk-fidelity`） |
| `mermaidSource` | `string` | 0 文字 | — | 構文エラー時も Document 保持・DOM 上ソース表示（AD-010） |
| 島 CSS スコープ | `.mermaid-preview` / `.mermaid-block` | — | — | **島ライト強制なし**。`#editor` 非対象 |

### Outputs & Failure Returns

| 条件 | 戻り値 / 期待状態 | 仕様根拠 |
|------|-------------------|---------|
| Preview + 正常 Mermaid | `.mermaid-preview` 表示、`.mermaid-source` **表示**（`display: none` でない）。DOM 順は preview → source | §5 正常系 4、AD-001–003 |
| Markdown + 正常 Mermaid | 同上（両方表示・図下ソース） | §5 正常系 5、AD-002 |
| Preview + 構文エラー | `.mermaid-error`（または preview 領域エラー）＋`.mermaid-source` **表示のまま**。Document ソース保持 | §5 Outputs、AD-010 |
| Preview ソース領域操作 | 編集イベントを Document へ送らない（厳密 RO） | §1、§5 正常系 5、AD-004 |
| kind テーマ | light→`redux`、dark/HC→`redux-dark`＋`securityLevel: 'strict'`。classic `default`/`dark` マップ禁止 | §5 正常系 7、`mermaid-redux-elk-fidelity` |
| 島ライト | `.mermaid-preview` に明るい固定サーフェス強制 **なし** | §5 正常系 11、`fix-mermaid-edge-styles` AD-005 |
| 広い面 | `#editor` / 広い Preview 面の背景は明るい固定背景を新設しない | §5 Non-Goals |
| HIP / XSS | `HTML_INTEGRATION_POINTS: { foreignobject: true }` 維持。`script` / `on*` 除去。strict 不変 | §5 正常系 10、§9、AD-008 |
| Document 正本 | `docJson` / `markdownText` / serialize / dirty 不変（表示層のみ） | AD-001 / AD-012 |
| `themeUpdated` | kind マップに従い再初期化。Document 不変 | §5 正常系 9 |

### Preconditions & Assumptions

- Mermaid NodeView と `media/editor.css` が存在する（既存 DOM を維持し再発明しない — AD-002）
- `mermaid-contrast-readable` の HIP は前提として継承。テーマ／nonce／ELK は `mermaid-redux-elk-fidelity` と共有
- ユニットは CSS / DOM 順 / theme helper / ソース検査で足りる。Snap とのピクセル一致は Non-Goal（RK-002）
- 本フェーズは testspec 設計のみ（テストコード変更は `testspec-implementation`）

### Complexity Budget

- 表示層 CSS / theme map / NodeView 表示制御の局所契約。アルゴリズム計算量 N/A
- P2 Stress: 長いフェンスの Preview 占有（RK-004）は許容・専用 Stress TC は設けない

### Spec Gaps

- なし（ソース併記・Preview RO は維持。classic マップ／島ライトは撤回済み）
- **TC-MSS-149 整合:** light→`redux` / dark|HC→`redux-dark` で [testspec-vsc-md-wysiwyg.md](../testspec-vsc-md-wysiwyg.md) TC-MSS-149・本 suite TC-MSS-005 と一致
- エッジ可視／nonce 再注入 — [testspec-mermaid-redux-elk-fidelity.md](#suite-redux-elk-fidelity)
- per-diagram frontmatter `config.theme` 食い違いは仕様許容 — 専用 TC なし

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-MSS-001 | Happy | preview-source-visible | P0 | Preview（`body[data-mode="preview"]`）で有効 Mermaid ブロックを表示 | `.mermaid-source` が表示される（`display: none` / `visibility: hidden` 等で隠さない）。`.mermaid-preview` も表示 | 旧「Preview ソース非表示」撤回（AD-001）。TC-MSS-130 新契約 | §5 正常系 4、AD-001/003 |
| TC-MSS-002 | Structural | preview-hide-css-removed | P0 | `media/editor.css`（または同等）を検査 | `body[data-mode='preview'] .mermaid-source { display: none }`（および同等の Preview 専用ソース非表示ルール）が**存在しない** | CSS 撤廃の静的検知（AD-003） | §5 正常系 4、AD-003 |
| TC-MSS-003 | Structural | source-below-preview-order | P0 | Mermaid NodeView のブロック内 DOM（Preview または Markdown） | `.mermaid-preview` が `.mermaid-source` より**先**（図の下にソース） | Snap 風上下併記・DOM 再発明禁止（AD-002） | §5 正常系 4、AD-002 |
| TC-MSS-004 | Happy | markdown-source-visible | P0 | Markdown モードで同一 Mermaid ブロック | `.mermaid-preview` と `.mermaid-source` の両方が表示。DOM 順は preview → source | Markdown 併記維持・強化（TC-MSS-131 整合） | §5 正常系 5、AD-002 |
| TC-MSS-005 | Happy | kind-theme-redux-map | P0 | kind `light` / `dark` / `highContrast` それぞれで `buildMermaidThemeConfig`（または同等） | light→`redux`、dark→`redux-dark`、highContrast→`redux-dark`。全 kind で `themeVariables.fontSize === '16px'`。`themeVariables` に `var(--vscode-...)` なし。`securityLevel: 'strict'`。classic `default`/`dark` マップは Fail | redux kind マップ＋表示密度 | §5 正常系 7 / 7a、`mermaid-display-density` |
| TC-MSS-006 | Structural | no-island-light-forced | P0 | `.mermaid-preview` / `.mermaid-block` の CSS | 明るい固定サーフェス強制（例: `background-color: white`）が**存在しない** | 島ライト撤回。エッジ可視は `mermaid-redux-elk-fidelity` | §5 正常系 11、AD-005 |
| TC-MSS-007 | Corner | preview-error-source-still-visible | P0 | Preview で不正 Mermaid 構文 | preview 領域に `.mermaid-error`（または同等）。`.mermaid-source` は**表示のまま**。Document ソース保持 | エラー時も非表示に戻さない（AD-010）。TC-MSS-132 新契約 | §5 Outputs、AD-010 |
| TC-MSS-008 | Corner | preview-source-readonly | P0 | Preview 表示中にソース領域へ編集イベント相当を送る / contenteditable 検査 | Document へ編集が反映されない。ソースは RO（`contenteditable=false` またはイベント非送出） | Preview 厳密 RO 維持（AD-004） | §1、§5 正常系 5、AD-004 |
| TC-MSS-009 | Structural | hip-strict-regression | P0 | sanitize options / `securityLevel` を検査（または contrast-readable TC-MSS-002 / TC-MSS-003 相当を再確認） | `HTML_INTEGRATION_POINTS: { foreignobject: true }`（または同等）あり。`securityLevel: 'strict'`。Snap 参考の sanitize なしは不採用 | セキュリティ不変（AD-008） | §5 正常系 10、§9、AD-008 |
| TC-MSS-010 | Structural | editor-wide-bg-unchanged | P1 | `#editor` / 広い Preview 面の背景ルール | Mermaid 島以外で明るい固定背景を新設していない | 面全体統一は Out（AD-006） | §5 Non-Goals、RK-001 |
| TC-MSS-011 | Structural | document-untouched | P1 | 表示層変更範囲（CSS / NodeView 表示 / theme）をソースまたは契約検査 | `docJson` / `markdownText` / serialize / dirty / Host / Marp / 画像 rewrite に触れない | 最小 diff・正本非接触（AD-001/012） | §1 表示層、AD-012 |
| TC-MSS-012 | Happy | theme-updated-follows-redux-map | P1 | Preview 表示中に `themeUpdated` で kind を切替 | 再描画経路は維持。更新後も redux マップ（dark→`redux-dark` 等）＋strict。Document 不変 | §5 正常系 9 | §5 正常系 9、`mermaid-redux-elk-fidelity` AD-004 |
| TC-MSS-013 | Corner | tc130-132-expected-aligned | P1 | wysiwyg TC-MSS-130–132 の Expected 文言と本 suite TC-MSS-001/004/007 を照合 | 旧「非表示」期待が残っていない。両所の Expected がソース表示で一致 | RK-006 防止 | AD-011 |
| TC-MSS-014 | Corner | hip-strict-no-island-regression | P1 | HIP option / `securityLevel: 'strict'` / 島ライト不在を検査（contrast-readable / `fix-mermaid-edge-styles` と整合） | HIP あり・strict・島ライト強制なし。sanitize を緩めない | 前回＋本タスク回帰 | AD-006/008 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-MSS-001, TC-MSS-004, TC-MSS-005, TC-MSS-012 | — |
| Boundary | — | 空ソースは既存 Mermaid TC。本差分は表示契約が主 |
| Structural | TC-MSS-002, TC-MSS-003, TC-MSS-006, TC-MSS-009, TC-MSS-010, TC-MSS-011 | — |
| Corner | TC-MSS-007, TC-MSS-008, TC-MSS-013, TC-MSS-014 | — |
| Stress | — | 長いフェンス占有（RK-004）は許容・専用 Stress なし |

### Complexity Notes

- ドメイン: VS Code Extension Webview（CSS / NodeView DOM / theme map）
- 競技系ドメインパターン: N/A

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR） | `test_single`: `npm run test:unit -- --grep 'mermaid-snap\|TC-MSS-00[1-9]\|TC-MSS-0[1][0-4]\|TC-MSS-13[0-2]'` |
| P2 | — | 本 testspec に P2 なし |
| 回帰 | contrast-readable + TC-MSS-152 | 既存 suite 継続 |

想定配置: `src/test/suite/unit/mermaid-snap-style-with-source.test.ts`（`.cursor/stack.md` `test_file_glob`）

**実装メモ（testspec-implementation）:**

1. `preview-rich-embed.test.ts` の TC-MSS-130 / TC-MSS-132 を新 Expected（ソース表示）へ更新し Red 確認
2. 本 suite で CSS 撤廃・DOM 順・redux kind マップ・島ライト不在・Preview RO を検証
3. TC-MSS-149 / contrast-readable / `mermaid-redux-elk-fidelity` と Expected を整合
4. 本番コードは build-agent（TDD Green）まで変更しない

---

## Trace Results

設計更新（2026-09-06）。旧 Trace（島ライト／全 kind default Pass）は **Expected 撤回**。`testspec-implementation` で再実行。

### TC-MSS-001–004, TC-MSS-007–011, TC-MSS-013（ソース併記／RO／広い面）

**Result:** 既存契約維持 — Preview hide CSS 等は別途 Green 対象。本タスクで Expected 変更なし

---

### TC-MSS-005 (P0): redux kind マップ

| Step | State / Action | Value |
|------|----------------|-------|
| Input | light / dark / highContrast | `buildMermaidThemeConfig` |
| Output | redux / redux-dark / redux-dark + strict | `mermaid-redux-elk-fidelity` AD-004 |

**Result:** ⬜ Pending — Expected を classic→redux に更新。テストコード未追随

---

### TC-MSS-006 (P0): 島ライト強制なし

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `.mermaid-preview` CSS | — |
| Output | 明るい固定サーフェス **不在** | AD-005 |

**Result:** ❌ Fail — 現行 `background-color: white`

---

### TC-MSS-012 (P1): themeUpdated が redux マップに従う

**Result:** ⬜ Pending — Expected 更新（旧: classic dark→`dark`）

### TC-MSS-014 (P1): HIP / strict / 島不在回帰

**Result:** ❌ Fail — 島 white 残存で Fail（HIP/strict は維持）

### Trace Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-MSS-001–004, TC-MSS-007–009 | P0 | ✅ | ソース併記／RO／HIP |
| TC-MSS-005, TC-MSS-006 | P0 | ⬜ / ❌ | テーママップ Expected 更新／島撤廃 Red |
| TC-MSS-010–011, TC-MSS-013 | P1 | ✅ | 広い面／Document／TC-MSS-130 整合 |
| TC-MSS-012, TC-MSS-014 | P1 | ⬜ / ❌ | redux マップ Expected／島不在 |

---

## Self-Check Report

### A. Input & Constraints
- [x] ✅ Preview / Markdown 両モード入力: TC-MSS-001 / TC-MSS-004
- [x] ✅ kind 三値（redux マップ）: TC-MSS-005
- [x] N/A 整数オーバーフロー — UI/CSS 契約

### B. Structural Patterns
- [x] ✅ CSS 撤廃: TC-MSS-002
- [x] ✅ DOM 順: TC-MSS-003
- [x] ✅ 島ライト不在 / 広い面: TC-MSS-006 / TC-MSS-010
- [x] ✅ Document 非接触: TC-MSS-011
- [x] N/A グラフ非連結 — 該当なし

### C. Corner & Failure
- [x] ✅ 構文エラー時ソース表示: TC-MSS-007
- [x] ✅ Preview RO: TC-MSS-008
- [x] ✅ HIP/strict・島不在回帰: TC-MSS-009 / TC-MSS-014
- [x] N/A API 404 — 該当なし

### D. Complexity & Resources
- [x] N/A 最悪計算量 — 表示契約。長いフェンス Stress は RK-004 許容で省略

### E. API / Worker
- [x] N/A HTTP / 認証 — ローカル VS Code 拡張

### Uncovered / Spec Gaps
- nonce 再注入・ELK — `mermaid-redux-elk-fidelity` に委譲
- Snap ピクセル一致・公式 dark 寄せは Non-Goal
- per-diagram frontmatter theme 食い違い専用 TC なし（仕様許容）
- TC-MSS-005/012 Expected は redux 系へ更新（2026-09-06 design）。テストコード追随は testspec-implementation

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-26 | `mermaid-default-preview-parity`: TC-MSS-005 Expected のグローバル `fontSize` を `'12px'` → `'16px'` に更新 |
| 2026-09-06 | `mermaid-readable-viewport`: TC-MSS-005 Expected のグローバル `fontSize` を `'13px'` → `'8px'` に更新 |
| 2026-09-06 | 密度 polish: Expected のグローバル `fontSize` を `'8px'` → `'12px'` に更新 |
| 2026-09-06 | `mermaid-display-density`: TC-MSS-005 Expected に全 kind `themeVariables.fontSize === '13px'`（`var(--vscode-...)` なし）を追加 |
| 2026-09-06 | `mermaid-redux-elk-fidelity`: TC-MSS-005/012 Expected を `redux`/`redux-dark` へ更新。classic マップ撤回。概要・Digest・Trace 整合 |
| 2026-09-06 | testspec-implementation: TC-MSS-005/006/012/014 テストコード追随。Trace 更新（意図的 Red） |
| 2026-09-06 | `fix-mermaid-edge-styles`: TC-MSS-005/006/012/014 Expected を標準 kind マップ＋島ライト撤廃へ更新。概要・Digest・Trace 整合 |
| 2026-09-05 | testspec-implementation: suite + TC-MSS-130–132 Red。Trace 更新（TC-MSS-001/002/007 Fail） |
| 2026-09-05 | 初版 — Snap 風（島ライト＋全 kind default）・両モード図下ソース併記・Preview RO・HIP/strict 回帰。TC-MSS-130–132 関係明示 |
| 2026-09-06 | ノード寸法 polish（choice B）: Expected のグローバル `fontSize` を `'10px'` → `'12px'` に更新 |

## Suite: fix-mermaid-edge-styles {#suite-fix-mermaid-edge-styles}

> Former specification: `testspec-fix-mermaid-edge-styles.md`（統合前旧仕様書）

## 概要

- **対象:** Custom Editor Webview CSP 下で Mermaid flowchart エッジが黒塗りブロブ／欠線になる問題の修正契約 — (1) presentation 可視（優先は [mermaid-redux-elk-fidelity](#suite-redux-elk-fidelity) の nonce 再注入；Host 静的 CSS は欠落時の最小安全網に縮小）(2) VS Code kind → Mermaid redux 系マップ（`light`→`redux`、`dark`/`highContrast`→`redux-dark`）— classic `default`/`dark` は撤回 (3) `.mermaid-preview` 島ライト強制撤廃 (4) HIP / `securityLevel: 'strict'` / 図下ソース併記 / Preview RO 回帰
- **対応仕様:** [doc/requirements/systemspec.md](../../requirements/systemspec.md) §5（正常系 7 / 10 / 11）、§1（Preview 可読性・Mermaid）、§9（CSP / sanitize）
- **Requirements Brief:** `temporary/requirements-brief-fix-mermaid-edge-styles.md`（AD-001–013）。テーマ／presentation 正本は `temporary/requirements-brief-mermaid-redux-elk-fidelity.md` で上書き
- **後継差分:** [testspec-mermaid-redux-elk-fidelity.md](#suite-redux-elk-fidelity) — redux マップ・nonce 再注入・ELK・Host CSS 縮小の正本
- **関連 testspec（Expected 追随）:**
  - [testspec-mermaid-contrast-readable.md](#suite-contrast-readable) — HIP / XSS / 広い面不変は維持。テーマは redux 系
  - [testspec-mermaid-snap-style-with-source.md](#suite-snap-style-with-source) — ソース併記・Preview RO は維持。テーマは redux 系
  - [testspec-vsc-md-wysiwyg.md](../testspec-vsc-md-wysiwyg.md) — TC-FME-149 redux kind マップ。TC-FME-130–132 / TC-FME-152 回帰参照
- **テストコード:** `src/test/suite/unit/fix-mermaid-edge-styles.test.ts`（TC-FME-001–015 実装済 — Expected は `mermaid-redux-elk-fidelity` で更新要）
- **作成日:** 2026-09-06

### 既存 suite との関係（必須明示）

| 項目 | contrast-readable | snap-style-with-source | 本 testspec | redux-elk-fidelity |
|------|-------------------|------------------------|-------------|-------------------|
| 所在 | [testspec-mermaid-contrast-readable.md](#suite-contrast-readable) | [testspec-mermaid-snap-style-with-source.md](#suite-snap-style-with-source) | 本ファイル | [testspec-mermaid-redux-elk-fidelity.md](#suite-redux-elk-fidelity) |
| 旧契約（撤回） | classic default/dark・島ライト | 同上 | Host CSS を必須正本・classic マップ | — |
| 新契約 | redux マップ＋HIP 維持 | ソース併記／RO 維持。テーマは redux 系 | **島撤廃＋CSP 回帰**。テーマ／presentation 正本は successor へ委譲 | **redux＋nonce 再注入＋ELK の正本** |
| 扱い | Expected **更新** | Expected **更新** | Expected **更新**（Host CSS 縮小） | **差分 TC** |

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| VS Code `themeUpdated.kind` | `'light' \| 'dark' \| 'highContrast'` | — | — | §1。`buildMermaidThemeConfig` 入力 |
| Custom Editor CSP `style-src` | Host 生成 HTML | — | — | `${webview.cspSource} 'nonce-${nonce}'`。`'unsafe-inline'` 禁止 |
| Host nonce | `string` | — | — | presentation 再注入（優先）または欠落時安全網 `<style>` と同一 nonce |
| Mermaid presentation CSS スコープ | `.mermaid-preview`（必要なら `.mermaid-block`） | — | — | 優先: render 結果 nonce 再注入。静的 Host CSS は縮小／安全網 |
| Mermaid SVG（sanitize 後） | `string` | — | — | CSP 無効化後もラベル／エッジ契約は HIP＋再注入（＋任意安全網）で担保 |
| `editorMode` | `"preview" \| "markdown" \| "raw"` | — | — | ソース併記・Preview RO 回帰 |

### Outputs & Failure Returns

| 条件 | 戻り値 / 期待状態 | 仕様根拠 |
|------|-------------------|---------|
| CSP + sanitize 後の flowchart エッジ | presentation が nonce 再注入（または同等）で効き、エッジが黒塗りブロブにならない。静的 Host CSS の永続必須 `stroke: var(--vscode-foreground)` 全面上書きは要求しない（縮小／安全網可） | §5 正常系 11、`mermaid-redux-elk-fidelity` AD-002/003 |
| CSP 文言 | `style-src` に `'unsafe-inline'` **なし**。nonce 付き | §9、AD-001 |
| kind `light` | Mermaid `theme: 'redux'` + `securityLevel: 'strict'` | §5 正常系 7、`mermaid-redux-elk-fidelity` AD-004 |
| kind `dark` / `highContrast` | Mermaid `theme: 'redux-dark'` + strict。classic `default`/`dark` マップ禁止 | §5 正常系 7、`mermaid-redux-elk-fidelity` AD-004 |
| 島ライト | `.mermaid-preview` / `.mermaid-block` に明るい固定サーフェス（例: `background-color: white`）を**強制しない** | §5 正常系 11、AD-005 |
| 広い面 | `#editor` 等に明るい固定背景を新設しない | §5 Non-Goals |
| HIP / XSS | `HTML_INTEGRATION_POINTS: { foreignobject: true }` 維持。`script` / `on*` 除去 | §5 正常系 10、AD-006 |
| ソース併記 | 図（`.mermaid-preview`）→ ソース（`.mermaid-source`）。Preview でも表示 | §5 正常系 4–5 |
| Preview RO | ソース領域の編集イベントを Document へ送らない | §1、§5 正常系 5 |
| Document 正本 | `docJson` / `markdownText` / serialize / dirty 不変 | AD-007 |
| `themeVariables` | `var(--vscode-...)` 再導入なし | `mermaid-theme-crash-fix` / AD-004 |

### Preconditions & Assumptions

- Webview Mermaid: `mermaid.render` →（presentation nonce 再注入優先）→ DOMPurify（HIP）→ `.mermaid-preview` 注入。SVG 内インライン `<style>` は CSP で無効化し得る
- テーマ／nonce 再注入／ELK の正本は [testspec-mermaid-redux-elk-fidelity.md](#suite-redux-elk-fidelity)。本 suite は島撤廃・CSP・回帰の差分を維持
- ユニットはソース静的検査（CSP・CSS・theme helper・HIP options）＋既存 sanitize 実行経路で足りる。ピクセル完全一致・実機スクリーンショットは Non-Goal
- flowchart エッジ可視は successor 受け入れと整合。他 diagram kind は発見次第 — 本版では専用 TC なし

### Complexity Budget

- CSS / CSP / theme map / sanitize の局所契約。アルゴリズム計算量 N/A
- P2 Stress: 多数図のテーマ切替一括再描画は既存 §5 RK — 本 testspec では N/A

### Spec Gaps

- なし（UD なし・systemspec §5 反映済み。classic マップ／Host CSS 必須正本は `mermaid-redux-elk-fidelity` で撤回）
- ピクセル「識別できる」は DOM/CSS/theme 契約で近似。実機目視は受け入れ補助
- per-diagram frontmatter `config.theme` 食い違いは仕様許容（§5 例外系 3）— 専用 TC なし
- sequence / class 等の他 kind エッジ欠線は Out

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-FME-001 | Happy | edge-visible-via-presentation-or-safety-net | P0 | Host HTML / `media/editor.css`／（実装後は）nonce 再注入経路を検査 | flowchart エッジが黒塗りブロブにならない契約。**優先:** presentation nonce 再注入（[redux-elk-fidelity](#suite-redux-elk-fidelity) TC-FME-004/006）。静的 Host CSS は欠落時の最小安全網に限定可。永続必須の全面 `stroke: var(--vscode-foreground)` を唯一正としない。ユーザー／ソース由来の任意 CSS 注入経路はない | CSP 下のエッジ可視（Host CSS 縮小後） | §5 正常系 11、`mermaid-redux-elk-fidelity` AD-002/003 |
| TC-FME-002 | Structural | csp-no-unsafe-inline | P0 | Custom Editor Webview CSP 生成（`markdown-editor-provider` 等） | `style-src` に `'unsafe-inline'` **なし**。`nonce-` 付き許可あり。Marp パネル CSP は本 TC 対象外 | セキュリティ不変（AD-001） | §9、AD-001 |
| TC-FME-003 | Happy | theme-light-redux | P0 | `buildMermaidThemeConfig('light')` | `theme: 'redux'`、`securityLevel: 'strict'`、`themeVariables.fontSize === '16px'`、`themeVariables` に `var(--vscode-...)` なし | redux マップ light＋密度 | §5 正常系 7 / 7a、`mermaid-display-density` |
| TC-FME-004 | Happy | theme-dark-redux-dark | P0 | `buildMermaidThemeConfig('dark')` | `theme: 'redux-dark'`（classic `'dark'` / `'default'` 強制ではない）。strict。`themeVariables.fontSize === '16px'`。`var(--vscode-...)` なし | redux-dark マップ＋密度 | §5 正常系 7 / 7a、`mermaid-display-density` |
| TC-FME-005 | Happy | theme-hc-redux-dark | P0 | `buildMermaidThemeConfig('highContrast')` | `theme: 'redux-dark'`。専用 HC パレット不要。strict。`themeVariables.fontSize === '16px'`。`var(--vscode-...)` なし | HC 同マップ＋密度 | §5 正常系 7 / 7a、`mermaid-display-density` |
| TC-FME-006 | Structural | no-island-light-forced | P0 | `.mermaid-preview` / `.mermaid-block` の CSS | 明るい固定サーフェス強制（例: `background-color: white` / 同等の島ライト強制）が**存在しない** | 島ライト撤回（AD-005） | §5 正常系 11、AD-005 |
| TC-FME-007 | Corner | hip-regression | P0 | sanitize options（または contrast-readable TC-FME-001/002 相当） | `HTML_INTEGRATION_POINTS: { foreignobject: true }`（または同等）。ラベル HTML 残存契約は contrast-readable と整合 | セキュリティ／可読性不変（AD-006） | §5 正常系 10、AD-006 |
| TC-FME-008 | Structural | security-level-strict | P0 | `buildMermaidThemeConfig` 全 kind および initialize 経路 | いずれも `securityLevel: 'strict'` | strict 不変 | §5 正常系 7、AD-006 |
| TC-FME-009 | Structural | source-below-diagram | P0 | Mermaid NodeView DOM 構築順 | `.mermaid-preview` が `.mermaid-source` より先（図の下にソース） | ソース併記回帰 | §5 正常系 4、snap-style |
| TC-FME-010 | Corner | preview-source-readonly | P0 | Preview 表示中のソース領域 | 編集イベントを Document へ送らない（`contenteditable=false` またはイベント非送出） | Preview 厳密 RO | §1、§5 正常系 5 |
| TC-FME-011 | Structural | editor-wide-bg-unchanged | P1 | `#editor` / 広い Preview 面の背景ルール | Mermaid 島以外で明るい固定背景を新設していない | 広い面変更禁止 | §5 Non-Goals、AD-005 |
| TC-FME-012 | Structural | document-untouched | P1 | 変更対象パス（CSS / theme helper / NodeView 周辺） | `docJson` / `markdownText` / serialize / dirty / Marp / 画像 rewrite に触れない | 表示層限定（AD-007） | §1、AD-007 |
| TC-FME-013 | Happy | theme-updated-uses-kind-map | P1 | `themeUpdated` で kind 切替後の `buildMermaidThemeConfig` 利用 | 再初期化は redux マップに従う（dark→`redux-dark` 等）。Document 不変 | §5 正常系 9 | §5 正常系 9、`mermaid-redux-elk-fidelity` AD-004 |
| TC-FME-014 | Corner | related-suites-expected-aligned | P1 | contrast-readable / snap-style / wysiwyg TC-FME-149 / redux-elk-fidelity の Expected を照合 | classic `default`/`dark` 必須・永続必須 `vscode-foreground` stroke 正本が残っていない。TC-FME-149 は light→`redux` / dark|HC→`redux-dark` | RK 防止 | `mermaid-redux-elk-fidelity` AD-011 |
| TC-FME-015 | Corner | xss-script-on-still-removed | P1 | ラベル付き SVG + `<script>` / `on*` を sanitize | script/on* 除去。安全ラベル残存（HIP 前提） | XSS 不変 | §5 例外系 1、§9 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-FME-001, TC-FME-003, TC-FME-004, TC-FME-005, TC-FME-013 | — |
| Boundary | — | 空ソースは既存 Mermaid TC。本差分は契約検査が主 |
| Structural | TC-FME-002, TC-FME-006, TC-FME-008, TC-FME-009, TC-FME-011, TC-FME-012 | — |
| Corner | TC-FME-007, TC-FME-010, TC-FME-014, TC-FME-015 | — |
| Stress | — | 多数図再描画は既存 §5 RK。本タスク範囲外 |

### Complexity Notes

- ドメイン: VS Code Extension Webview（CSP / CSS / theme map / DOMPurify）
- 競技系ドメインパターン: N/A
- API / Worker: N/A（ローカル拡張）

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR） | `test_single`: `npm run test:unit -- --grep 'fix-mermaid-edge\|TC-FME-00[1-9]\|TC-FME-0[1][0-5]'` |
| P2 | — | 本 testspec に P2 なし |
| 回帰 | contrast-readable / snap-style / TC-FME-152 / TC-FME-130–132 / TC-FME-149 | Expected 更新後に Red→Green |

想定配置: `src/test/suite/unit/fix-mermaid-edge-styles.test.ts`（`.cursor/stack.md` `test_file_glob`）

**実装メモ（testspec-implementation）:**

1. 本 suite で TC-FME-001–015 を追加（本番コードは触らない → 意図的 Red）
2. `mermaid-contrast-readable.test.ts` / `mermaid-snap-style-with-source.test.ts` / `preview-mode-quality.test.ts` TC-FME-149 を redux Expected に合わせて更新（正本は `mermaid-redux-elk-fidelity`）
3. エッジ可視は nonce 再注入契約を優先 assert。静的 Host CSS は「必須永続 stroke」ではなく安全網縮小を検証

---

## Trace Results

実行: `npm run test:unit -- --grep 'fix-mermaid-edge|mermaid-contrast-readable|mermaid-snap-style|TC-FME-149'`（2026-09-06）。本番未修正のため意図的 Red。

### TC-FME-001 (P0): エッジ可視（再注入優先・Host CSS 縮小）

| Step | State / Action | Value |
|------|----------------|-------|
| Input | Host HTML / `editor.css`／再注入経路 | nonce 付き presentation |
| Output | 黒ブロブ回避。永続必須 `vscode-foreground` stroke 正本ではない | `mermaid-redux-elk-fidelity` AD-002/003 |

**Result:** ⬜ Pending — Expected 更新（設計）。実装・テストコード追随は successor／testspec-implementation

---

### TC-FME-002 (P0): CSP に unsafe-inline なし

| Step | State / Action | Value |
|------|----------------|-------|
| Input | Custom Editor CSP | `style-src` |
| Output | nonce のみ、`unsafe-inline` 不在 | AD-001 |

**Result:** ✅ Pass — provider は nonce のみ（回帰維持）

---

### TC-FME-003–005 (P0): redux kind マップ

| Step | State / Action | Value |
|------|----------------|-------|
| Input | light / dark / highContrast | `buildMermaidThemeConfig` |
| Output | redux / redux-dark / redux-dark | `mermaid-redux-elk-fidelity` AD-004 |

**Result:** ⬜ Pending — Expected を classic→redux に更新。テストコード未追随

---

### TC-FME-006 (P0): 島ライト強制なし

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `.mermaid-preview` CSS | — |
| Output | `background-color: white` 等の島ライト強制 **不在** | AD-005 |

**Result:** ❌ Fail — 現行 `background-color: white` あり

---

### TC-FME-007–010 (P0): HIP / strict / ソース順 / Preview RO

**Result:** ✅ Pass — 既存契約継承

---

### TC-FME-011–015 (P1)

| ID | Result | Notes |
|----|--------|-------|
| TC-FME-011 | ✅ Pass | 広い面不変 |
| TC-FME-012 | ✅ Pass | Document 非接触 |
| TC-FME-013 | ⬜ Pending | dark→`redux-dark` Expected 更新 |
| TC-FME-014 | ⬜ Pending | 関連 suite を redux Expected へ整合中 |
| TC-FME-015 | ✅ Pass | XSS 除去＋ラベル残存 |

### Trace Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-FME-001 | P0 | ⬜ | Host CSS 必須→再注入優先へ Expected 更新 |
| TC-FME-002 | P0 | ✅ | CSP 現行維持 |
| TC-FME-003–005 | P0 | ⬜ | classic→redux Expected 更新 |
| TC-FME-006 | P0 | ❌ | 島 white 残存（回帰） |
| TC-FME-007–010 | P0 | ✅ | 回帰 |
| TC-FME-011–012, TC-FME-015 | P1 | ✅ | |
| TC-FME-013–014 | P1 | ⬜ | redux マップ／suite 整合 |

---

## Self-Check Report

### A. Input & Constraints
- [x] ✅ kind 三値（redux）: TC-FME-003–005
- [x] ✅ CSP / nonce 入力: TC-FME-001–002
- [x] N/A 整数オーバーフロー — UI/CSP 契約

### B. Structural Patterns
- [x] ✅ 島 vs 広い面: TC-FME-006 / TC-FME-011
- [x] ✅ DOM 順・Document 非接触: TC-FME-009 / TC-FME-012
- [x] ✅ CSP 構造: TC-FME-002
- [x] N/A グラフ非連結 — 該当なし（エッジは presentation／安全網契約）

### C. Corner & Failure
- [x] ✅ HIP / XSS / Preview RO: TC-FME-007 / TC-FME-010 / TC-FME-015
- [x] ✅ 関連 suite 整合: TC-FME-014（redux-elk-fidelity 追随）
- [x] N/A API 404 — 該当なし

### D. Complexity & Resources
- [x] N/A 最悪計算量 — 表示契約

### E. API / Worker
- [x] N/A HTTP / 認証 — ローカル VS Code 拡張

### Uncovered / Spec Gaps
- flowchart 以外 diagram kind の欠線 — Out
- ピクセル目視「識別できる」— DOM/CSS/theme／再注入で近似
- per-diagram frontmatter theme 食い違い専用 TC なし（仕様許容）
- nonce 再注入・ELK 詳細は [testspec-mermaid-redux-elk-fidelity.md](#suite-redux-elk-fidelity)

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-26 | `mermaid-default-preview-parity`: TC-FME-003–005 Expected のグローバル `fontSize` を `'12px'` → `'16px'` に更新 |
| 2026-09-06 | `mermaid-readable-viewport`: TC-FME-003–005 Expected のグローバル `fontSize` を `'13px'` → `'8px'` に更新 |
| 2026-09-06 | 密度 polish: Expected のグローバル `fontSize` を `'8px'` → `'12px'` に更新 |
| 2026-09-06 | `mermaid-display-density`: TC-FME-003–005 Expected に `themeVariables.fontSize === '13px'`（`var(--vscode-...)` なし）を追加 |
| 2026-09-06 | `mermaid-redux-elk-fidelity`: TC-FME-001/003–005/013–014 Expected を redux マップ＋ Host CSS 縮小（再注入優先）へ更新。classic `default`/`dark`・永続必須 `vscode-foreground` stroke 正本を撤回 |
| 2026-09-06 | testspec-implementation: suite + 関連 Expected 追随。Trace 更新（意図的 Red） |
| 2026-09-06 | 初版 — nonce CSS エッジフォールバック・標準 kind マップ・島ライト撤廃・HIP/strict/ソース併記/Preview RO 回帰（設計のみ） |
| 2026-09-06 | ノード寸法 polish（choice B）: Expected のグローバル `fontSize` を `'10px'` → `'12px'` に更新 |

## Suite: redux-elk-fidelity {#suite-redux-elk-fidelity}

> Former specification: `testspec-mermaid-redux-elk-fidelity.md`（統合前旧仕様書）

## 概要

- **対象:** Mermaid 描画の忠実性向上 — (1) VS Code kind → Mermaid `redux` / `redux-dark` マップ (2) CSP 下で Mermaid presentation `<style>` を Host 同一 nonce 再注入（または同等の CSP 安全手段）(3) `@mermaid-js/layout-elk` 登録＋ frontmatter / `%%{init}%%` オプトイン ELK（グローバル強制なし・遅延ロード）(4) 静的 Host CSS エッジフォールバックの縮小／撤廃 (5) HIP / `securityLevel: 'strict'` / 図下ソース併記 / Preview RO / `'unsafe-inline'` なし回帰
- **対応仕様:** [doc/requirements/systemspec.md](../../requirements/systemspec.md) §5（正常系 7 / 10–13）、§9（CSP / sanitize）、§1（Preview RO・`themeUpdated`）
- **Requirements Brief:** `temporary/requirements-brief-mermaid-redux-elk-fidelity.md`（AD-001–015）
- **関連 testspec（本タスクで Expected 更新）:**
  - [testspec-fix-mermaid-edge-styles.md](#suite-fix-mermaid-edge-styles) — classic `default`/`dark` マップ撤回。Host CSS を「必須永続 stroke」から縮小／安全網へ
  - [testspec-mermaid-contrast-readable.md](#suite-contrast-readable) — kind マップを redux 系へ。HIP / XSS / 広い面不変は維持
  - [testspec-mermaid-snap-style-with-source.md](#suite-snap-style-with-source) — テーマ Expected を redux 系へ。ソース併記・Preview RO は維持
  - [testspec-vsc-md-wysiwyg.md](../testspec-vsc-md-wysiwyg.md) — TC-MRE-149（および TC-MRE-145 の initialize 前提）を redux マップへ
- **テストコード:** `src/test/suite/unit/mermaid-redux-elk-fidelity.test.ts`（TC-MRE-001–020 実装済 — 本番未修正のため意図的 Red）
- **作成日:** 2026-09-06

### 既存 suite との関係（必須明示）

| 項目 | edge-styles | contrast / snap | 本 testspec |
|------|-------------|-----------------|-------------|
| 所在 | [testspec-fix-mermaid-edge-styles.md](#suite-fix-mermaid-edge-styles) | contrast / snap | 本ファイル |
| 旧契約（撤回） | classic light→`default` / dark|HC→`dark`；Host CSS `stroke: var(--vscode-foreground)` 等を必須正本 | 同上テーマ前提 | — |
| 新契約 | テーマ／presentation 正本は本 suite へ委譲。Host CSS は欠落時の最小安全網に限定可 | HIP／ソース併記／RO 維持。テーマは redux 系 | **redux マップ＋nonce 再注入＋ELK オプトインの正本** |
| 扱い | Expected **更新**（deprecate しない） | Expected **更新** | **差分 TC**（設計のみ） |

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| VS Code `themeUpdated.kind` | `'light' \| 'dark' \| 'highContrast'` | — | — | §1。`buildMermaidThemeConfig` 入力 |
| Custom Editor CSP `style-src` | Host 生成 HTML | — | — | `${webview.cspSource} 'nonce-${nonce}'`。`'unsafe-inline'` 禁止 |
| Host nonce | `string` | — | — | presentation `<style>` 再注入と同一 |
| Mermaid `render` 結果 | SVG + presentation `<style>` | — | — | 抽出→危険構文除去→nonce 付与→`.mermaid-preview` / 図スコープ再注入 |
| `mermaidSource`（ELK） | `string` | — | — | frontmatter / `%%{init}%%` に `layout: elk`（等）。フェンス全文・非 strip |
| `mermaidSource`（既定） | `string` | — | — | `layout` 未指定 → dagre 系既定（グローバル ELK 強制なし） |
| ELK ローダ | `@mermaid-js/layout-elk` | — | — | `registerLayoutLoaders`。動的 import / 遅延ロード可 |
| `editorMode` | `"preview" \| "markdown" \| "raw"` | — | — | ソース併記・Preview RO 回帰 |

### Outputs & Failure Returns

| 条件 | 戻り値 / 期待状態 | 仕様根拠 |
|------|-------------------|---------|
| kind `light` | Mermaid `theme: 'redux'` + `securityLevel: 'strict'`。`themeVariables.fontSize === '16px'`。`themeVariables` に `var(--vscode-...)` なし | §5 正常系 7 / 7a、AD-004、`mermaid-display-density` |
| kind `dark` / `highContrast` | Mermaid `theme: 'redux-dark'` + strict。`themeVariables.fontSize === '16px'`。classic `default`/`dark` マップ禁止。`var(--vscode-...)` なし | §5 正常系 7 / 7a、AD-004、`mermaid-display-density` |
| nonce 再注入 | render 由来 presentation `<style>` が Host 同一 nonce 付きで Webview に存在。セレクタは `.mermaid-preview` / 図スコープに閉じる。ユーザー／ソース由来の任意 CSS 素通しなし | §5 正常系 11、AD-002 |
| CSP | `style-src` に `'unsafe-inline'` **なし** | §9、AD-001 |
| flowchart エッジ可視 | CSP＋sanitize＋再注入後、エッジが黒塗りブロブにならず stroke が可視（DOM/CSS 契約で近似） | §5 受け入れ (b) |
| Host CSS 縮小 | 永続必須の `stroke: var(--vscode-foreground)` 全面上書きを要求しない。残す場合は「本物 CSS 欠落時の安全網」に限定し redux 配色を壊さない | §5 正常系 11、AD-003 |
| `layout: elk` 指定図 | ELK ローダ登録完了後に描画成功（SVG / 図表示）。登録前要求はロード完了待ちまたは図単位エラー | §5 正常系 12、AD-005/007 |
| `layout` 未指定 | グローバル initialize に `layout: 'elk'` 強制なし。既定は Mermaid オープン既定（dagre 系） | §5 正常系 12、AD-006 |
| ELK 登録／ロード失敗 | 当該図のみエラー。Webview 全体は止めない | §5 Outputs、AD-007/012 |
| HIP / XSS | `HTML_INTEGRATION_POINTS: { foreignobject: true }` 維持。`script` / `on*` 除去 | §5 正常系 10、AD-008 |
| ソース併記 | 図（`.mermaid-preview`）→ ソース（`.mermaid-source`）。Preview でも表示 | §5 正常系 4–5 |
| Preview RO | ソース領域の編集イベントを Document へ送らない | §1、§5 正常系 5 |
| Document 正本 | `docJson` / `markdownText` / serialize / dirty 不変 | AD-009 |

### Preconditions & Assumptions

- Webview Mermaid: `mermaid.render` →（presentation 抽出／nonce 再注入）→ DOMPurify（HIP）→ `.mermaid-preview` 注入。SVG 内インライン `<style>` は CSP で無効化し得る
- ユニットはソース静的検査（CSP・theme helper・ELK 登録／遅延 import・Host CSS）＋既存 sanitize／NodeView 契約で足りる。ピクセル完全一致・Chart／Snap 一致は Non-Goal
- ELK 必須受け入れは flowchart 等 ELK 対応 kind。未対応 kind は既存レイアウトのまま（専用 TC なし）

### Complexity Budget

- テーマ／CSP／nonce／ELK 登録の局所契約。アルゴリズム計算量 N/A
- P2 Stress: 多数図のテーマ切替一括再描画・初回 ELK バンドル肥大は RK — 本 testspec では専用 Stress TC なし（P1 で遅延ロード契約のみ）

### Spec Gaps

- なし（UD なし・systemspec §5 反映済み）
- ピクセル「識別できる」は DOM/CSS/theme／再注入契約で近似。実機目視は受け入れ補助
- per-diagram frontmatter `config.theme` / `config.layout` 食い違いは仕様許容（§5 例外系 3）— 専用 TC なし（ELK オプトイン成功は TC-MRE-007）
- Chart 専用アイコン／常時 ELK／`'unsafe-inline'` 緩和は Out

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-MRE-001 | Happy | theme-light-redux | P0 | `buildMermaidThemeConfig('light')`（または同等） | `theme: 'redux'`、`securityLevel: 'strict'`、`themeVariables.fontSize === '16px'`、`themeVariables` に `var(--vscode-...)` なし。classic `'default'` マップは Fail | kind→redux＋表示密度（AD-004 / `mermaid-display-density`） | §5 正常系 7 / 7a |
| TC-MRE-002 | Happy | theme-dark-redux-dark | P0 | `buildMermaidThemeConfig('dark')` | `theme: 'redux-dark'`（`'dark'` classic / `'default'` 強制ではない）。strict。`themeVariables.fontSize === '16px'`。`var(--vscode-...)` なし | dark→redux-dark＋密度 | §5 正常系 7 / 7a |
| TC-MRE-003 | Happy | theme-hc-redux-dark | P0 | `buildMermaidThemeConfig('highContrast')` | `theme: 'redux-dark'`。専用 HC パレット不要。strict。`themeVariables.fontSize === '16px'`。`var(--vscode-...)` なし | HC 同マップ＋密度（AD-004） | §5 正常系 7 / 7a |
| TC-MRE-004 | Happy | nonce-presentation-reinject | P0 | Mermaid `render` 結果に presentation `<style>` を含む fixture／経路を検査（または再注入ヘルパの契約） | Host 発行と**同一 nonce** 付き `<style>` が Webview に再注入される（セレクタは `.mermaid-preview` / 当該図スコープ）。ユーザー／Mermaid ソース由来の任意 CSS 素通し経路なし。同等の CSP 安全手段でも可（`'unsafe-inline'` は不可） | CSP 下で本物 presentation を効かせる（AD-002） | §5 正常系 11 |
| TC-MRE-005 | Structural | csp-no-unsafe-inline | P0 | Custom Editor Webview CSP 生成 | `style-src` に `'unsafe-inline'` **なし**。`nonce-` 付き許可あり。Marp パネル CSP は本 TC 対象外 | セキュリティ不変（AD-001） | §9 |
| TC-MRE-006 | Happy | flowchart-edge-visible-after-reinject | P0 | CSP＋HIP sanitize＋nonce 再注入後の flowchart エッジ契約（静的 CSS／再注入 style の共起、またはヘルパ出力） | エッジ／パスが黒塗りブロブにならない契約（`fill: none` 相当が presentation 再注入側、または欠落時のみ最小安全網）。永続必須の全面 `stroke: var(--vscode-foreground)` 上書きを**唯一の正**としない | 受け入れ (b) | §5 正常系 11、受け入れ |
| TC-MRE-007 | Happy | layout-elk-after-register | P0 | frontmatter または `%%{init}%%` で `layout: elk`（互換 flowchart ELK 指定可）のフェンス全文を render 経路に渡す。事前に `registerLayoutLoaders`（または遅延登録完了） | ELK ローダ登録後に図が描画成功（SVG／`.mermaid-preview` 成功経路）。フェンス全文・非 strip | ELK オプトイン成功（AD-005） | §5 正常系 6/12 |
| TC-MRE-008 | Structural | no-global-forced-elk | P0 | グローバル `mermaid.initialize`／`buildMermaidThemeConfig`（または同等）を検査 | `layout: 'elk'`（または同等の全図 ELK 強制）が**含まれない**。`layout` 未指定ソースは dagre 系既定のまま | オプトインのみ（AD-006） | §5 正常系 12、Non-Goals |
| TC-MRE-009 | Structural | host-css-edge-fallback-shrunk | P0 | `media/editor.css`（または Host nonce 静的エッジ CSS）を検査 | 永続必須の `stroke: var(--vscode-foreground)` 等による redux 配色上書きを**要求しない**。残存する場合はコメント／範囲が「本物 CSS 欠落時の安全網」に限定され、島ライト強制は不在 | Host CSS 縮小（AD-003） | §5 正常系 11 |
| TC-MRE-010 | Corner | hip-regression | P0 | sanitize options（または contrast-readable TC-MRE-001/002 相当） | `HTML_INTEGRATION_POINTS: { foreignobject: true }`（または同等）。ラベル HTML 残存契約は contrast-readable と整合 | HIP 不変（AD-008） | §5 正常系 10 |
| TC-MRE-011 | Structural | security-level-strict | P0 | `buildMermaidThemeConfig` 全 kind および initialize 経路 | いずれも `securityLevel: 'strict'`。全 kind で `themeVariables.fontSize === '16px'`（`var(--vscode-...)` なし） | strict 不変＋グローバル密度 | §5 正常系 7 / 7a、AD-008、`mermaid-display-density` |
| TC-MRE-012 | Structural | source-below-diagram | P0 | Mermaid NodeView DOM 構築順 | `.mermaid-preview` が `.mermaid-source` より先（図の下にソース） | ソース併記回帰 | §5 正常系 4 |
| TC-MRE-013 | Corner | preview-source-readonly | P0 | Preview 表示中のソース領域 | 編集イベントを Document へ送らない（`contenteditable=false` またはイベント非送出） | Preview 厳密 RO | §1、§5 正常系 5 |
| TC-MRE-014 | Structural | elk-lazy-register | P1 | `@mermaid-js/layout-elk` の import／`registerLayoutLoaders` 呼び出し箇所 | 動的 import／コード分割、または初回 ELK 要求時登録のいずれか。初期バンドルへの不用意な静的肥大化を避ける契約 | 遅延ロード（AD-007） | §5 正常系 12 |
| TC-MRE-015 | Corner | elk-register-failure-isolated | P1 | ELK ローダ登録／import が失敗する mock | 当該図のみエラー表示。Webview 全体のメッセージングは停止しない（try-catch 隔離） | 失敗隔離（AD-007/012） | §5 Outputs |
| TC-MRE-016 | Happy | theme-updated-uses-redux-map | P1 | `themeUpdated` で kind 切替後の `buildMermaidThemeConfig` 利用 | 再初期化は redux マップに従う（dark→`redux-dark` 等）。Document 不変 | §5 正常系 9 | §5 正常系 9、AD-012 |
| TC-MRE-017 | Structural | document-untouched | P1 | 変更対象パス（theme／nonce 再注入／ELK／NodeView 周辺） | `docJson` / `markdownText` / serialize / dirty / Marp / 画像 rewrite に触れない | 表示層限定（AD-009） | §1、AD-009 |
| TC-MRE-018 | Corner | related-suites-expected-aligned | P1 | edge-styles / contrast / snap / wysiwyg TC-MRE-149 の Expected を照合 | classic `default`/`dark` 必須期待・永続必須 `vscode-foreground` stroke 正本が残っていない。TC-MRE-149 は light→`redux` / dark|HC→`redux-dark` | RK-007 防止 | AD-011 |
| TC-MRE-019 | Corner | xss-script-on-still-removed | P1 | ラベル付き SVG + `<script>` / `on*` を sanitize | script/on* 除去。安全ラベル残存（HIP 前提） | XSS 不変 | §5 例外系 1、§9 |
| TC-MRE-020 | Structural | no-island-light-forced | P1 | `.mermaid-preview` / `.mermaid-block` の CSS | 明るい固定サーフェス強制（例: `background-color: white`）が**存在しない** | 島ライト撤回維持 | §5 正常系 11 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-MRE-001–004, TC-MRE-006–007, TC-MRE-016 | — |
| Boundary | — | 空ソースは既存 Mermaid TC。本差分は契約検査が主 |
| Structural | TC-MRE-005, TC-MRE-008–009, TC-MRE-011–012, TC-MRE-014, TC-MRE-017, TC-MRE-020 | — |
| Corner | TC-MRE-010, TC-MRE-013, TC-MRE-015, TC-MRE-018–019 | — |
| Stress | — | 多数図再描画・バンドル肥大は RK。専用 Stress なし |

### Complexity Notes

- ドメイン: VS Code Extension Webview（CSP / nonce / theme map / ELK loader / DOMPurify）
- 競技系ドメインパターン: N/A
- API / Worker: N/A（ローカル拡張）

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR） | `test_single`: `npm run test:unit -- --grep 'mermaid-redux-elk\|TC-MRE-00[1-9]\|TC-MRE-0[12][0-9]'` |
| P2 | — | 本 testspec に P2 なし |
| 回帰 | contrast-readable / snap-style / edge-styles / TC-MRE-149 / TC-MRE-152 / TC-MRE-130–132 | Expected 更新後に Red→Green |

想定配置: `src/test/suite/unit/mermaid-redux-elk-fidelity.test.ts`（`.cursor/stack.md` `test_file_glob`）

**実装メモ（testspec-implementation）:**

1. 本 suite で TC-MRE-001–020 を追加（本番コードは触らない → 意図的 Red）
2. `fix-mermaid-edge-styles` / `mermaid-contrast-readable` / `mermaid-snap-style-with-source` / wysiwyg TC-MRE-149（＋ TC-MRE-145 initialize 前提）を新 Expected に合わせて更新
3. nonce 再注入は「同一 nonce 属性＋ presentation セレクタ／`fill: none` 相当の共起」を最小 assert とする
4. ELK は `registerLayoutLoaders` 呼び出しと `layout: elk` ソース経路の契約検査で足りる（実 ELK エンジン結合は任意）

---

## Trace Results

実行: `npm run test:unit -- --grep 'mermaid-redux-elk|fix-mermaid-edge|mermaid-contrast-readable|mermaid-snap-style|TC-MRE-149'`（2026-09-06）。本番未修正のため意図的 Red。

### TC-MRE-001–003 (P0): redux kind マップ

| Step | State / Action | Value |
|------|----------------|-------|
| Input | light / dark / highContrast | `buildMermaidThemeConfig` |
| Output | redux / redux-dark / redux-dark + strict | AD-004 |

**Result:** ❌ Fail（Red）— 現行実装は classic `default`/`dark`。テストコード実装済

---

### TC-MRE-004–006 (P0): nonce 再注入＋エッジ可視＋CSP

| Step | State / Action | Value |
|------|----------------|-------|
| Input | render presentation style + Host nonce + CSP | — |
| Output | 同一 nonce 再注入、`unsafe-inline` なし、黒ブロブ回避 | AD-001/002 |

**Result:** ❌ Fail（Red）— nonce 再注入未実装。TC-MRE-005 CSP は Pass 想定

---

### TC-MRE-007–009 (P0): ELK オプトイン／非強制／Host CSS 縮小

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `layout: elk` 図 / 未指定図 / Host CSS | — |
| Output | 登録後成功・グローバル ELK なし・永続 vscode-foreground 必須なし | AD-003/005/006 |

**Result:** ❌ Fail（Red）— layout-elk 未導入。TC-MRE-008 非強制は Pass 想定。TC-MRE-009 Host CSS 縮小 Red

---

### TC-MRE-010–013 (P0): HIP / strict / ソース順 / Preview RO

**Result:** ✅ Pass 想定 — 既存契約継承の回帰 assert

---

### TC-MRE-014–020 (P1)

| ID | Result | Notes |
|----|--------|-------|
| TC-MRE-014 | ❌ | 遅延ロード未実装 Red |
| TC-MRE-015 | ❌ | ELK 失敗隔離経路未実装 Red |
| TC-MRE-016 | ❌ | themeUpdated→redux マップ Red（実装が classic） |
| TC-MRE-017 | ✅ | Document 非接触（静的検査） |
| TC-MRE-018 | ✅ | 関連 suite Expected／テストを redux へ整合済 |
| TC-MRE-019 | ✅ | XSS 除去 |
| TC-MRE-020 | ✅ | 島ライト不在 |

### Trace Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-MRE-001–004, TC-MRE-006–007, TC-MRE-009 | P0 | ❌ Red | 本番未実装 |
| TC-MRE-005, TC-MRE-008, TC-MRE-010–013 | P0 | ✅ / 部分 | 回帰・非強制・CSP |
| TC-MRE-014–016 | P1 | ❌ Red | ELK／redux マップ |
| TC-MRE-017–020 | P1 | ✅ | 整合・XSS・島 |

---

## Self-Check Report

### A. Input & Constraints
- [x] ✅ kind 三値: TC-MRE-001–003
- [x] ✅ CSP / nonce / ELK ソース入力: TC-MRE-004–008
- [x] N/A 整数オーバーフロー — UI/CSP 契約

### B. Structural Patterns
- [x] ✅ グローバル ELK 非強制・Host CSS 縮小・CSP: TC-MRE-005 / TC-MRE-008–009
- [x] ✅ DOM 順・Document 非接触: TC-MRE-012 / TC-MRE-017
- [x] ✅ 遅延ロード構造: TC-MRE-014
- [x] N/A グラフ非連結 — 該当なし（ELK は登録契約）

### C. Corner & Failure
- [x] ✅ HIP / XSS / Preview RO / ELK 失敗隔離: TC-MRE-010 / TC-MRE-013 / TC-MRE-015 / TC-MRE-019
- [x] ✅ 関連 suite 整合: TC-MRE-018
- [x] N/A API 404 — 該当なし

### D. Complexity & Resources
- [x] ✅ 遅延ロードで初期肥大回避: TC-MRE-014（P1）
- [x] N/A 最悪計算量 Stress — 表示契約。バンドル RK は専用 P2 なし

### E. API / Worker
- [x] N/A HTTP / 認証 — ローカル VS Code 拡張

### Uncovered / Spec Gaps
- flowchart 以外 diagram kind の ELK／CSP 崩れ — Out（RK-004）
- ピクセル目視「識別できる」— DOM/CSS/theme／再注入で近似
- per-diagram frontmatter theme 食い違い専用 TC なし（仕様許容）

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-26 | `mermaid-default-preview-parity`: TC-MRE-001–003 / TC-MRE-011 および Spec Digest Outputs のグローバル `fontSize` Expected を `'12px'` → `'16px'` に更新 |
| 2026-09-06 | `mermaid-readable-viewport`: TC-MRE-001–003 / TC-MRE-011 および Spec Digest Outputs のグローバル `fontSize` を `'13px'` → `'8px'` に更新 |
| 2026-09-06 | 密度 polish: Expected のグローバル `fontSize` を `'8px'` → `'12px'` に更新 |
| 2026-09-06 | `mermaid-display-density`: TC-MRE-001–003 / TC-MRE-011 Expected にグローバル `themeVariables.fontSize === '13px'`（`var(--vscode-...)` なし）を追加。Spec Digest Outputs 追随 |
| 2026-09-06 | testspec-implementation: `mermaid-redux-elk-fidelity.test.ts` TC-MRE-001–020 追加。関連 suite Expected を redux へ追随。Trace を意図的 Red で更新 |
| 2026-09-06 | 初版 — redux kind マップ・nonce presentation 再注入・ELK オプトイン／非強制・Host CSS 縮小・HIP/strict/ソース併記/Preview RO/`unsafe-inline` なし回帰（設計のみ） |
| 2026-09-06 | ノード寸法 polish（choice B）: Expected のグローバル `fontSize` を `'10px'` → `'12px'` に更新 |

## Suite: readable-viewport {#suite-readable-viewport}

> Former specification: `testspec-mermaid-readable-viewport.md`（統合前旧仕様書）

## 概要

- **対象:** Mermaid 可読ビューポート — (1) グローバル `themeVariables.fontSize: '16px'`＋測定用 Host nonce CSS `font-size: 16px`・**`font-family: "trebuchet ms", verdana, arial, sans-serif`**・**`line-height: 1.2`**（測定と描画の一致 — `mermaid-label-metrics`）(2) タイトル全文可視（表示層契約）(3) Editor Preview / Rich Editor のみ: **初期・再 render・テーマ切替は scale 1（自然サイズ・自動 contain なし）**・はみ出しはスクロール・**Fit ボタン押下時のみ contain**・**小さい軸は中央寄せ**・**ズーム原点＝ビューポート中央**・ズームイン／アウト・パン／スクロール・a11y `aria-label` (4) 密度（fontSize）と閲覧用ビューポート変換の分離 (5) Preview RO（ビューポート操作は Document 非編集）(6) Default Preview 非対象 (7) redux / HIP / strict / nonce / ELK オプトイン／ソース併記回帰。**ピクセル完全一致は Non-Goal**
- **対応仕様:** [doc/requirements/systemspec.md](../../requirements/systemspec.md) §5（正常系 7a–7c / 9 / 13、Spec Gaps）、§1（Preview RO）、§9（CSP / sanitize）
- **Requirements Brief:** `mermaid-label-metrics`（継承 `mermaid-default-preview-parity` AD-001–AD-015 / `mermaid-readable-viewport`）
- **関連 testspec:**
  - [testspec-mermaid-redux-elk-fidelity.md](#suite-redux-elk-fidelity) — TC-MRE-001–003 / TC-MRE-011
  - [testspec-fix-mermaid-edge-styles.md](#suite-fix-mermaid-edge-styles) — TC-FME-003–005
  - [testspec-mermaid-contrast-readable.md](#suite-contrast-readable) — TC-MCR-004 / 007 / 011
  - [testspec-mermaid-snap-style-with-source.md](#suite-snap-style-with-source) — TC-MSS-005
  - [testspec-vsc-md-wysiwyg.md](../testspec-vsc-md-wysiwyg.md) — TC-149
- **テストコード:** `src/test/suite/unit/mermaid-readable-viewport.test.ts`（TC-MRV-001–027。Expected scale 1／Fit のみ contain／ラベルタイポ — 意図的 Red 待ち Green）
- **作成日:** 2026-09-06

### 既存 suite との関係（必須明示）

| 項目 | redux-elk / edge / contrast / snap / wysiwyg | 本 testspec |
|------|-----------------------------------------------|-------------|
| 所在 | 各 suite / TC-149 | 本ファイル |
| 旧契約 | グローバル `fontSize === '16px'`。初期 fit（自動 contain）・re-fit | — |
| 新契約 | `fontSize: '16px'` 維持。ラベル `font-family` / `line-height: 1.2`。初期・再 render・テーマ切替は **scale 1**（Fit のみ contain） | **密度 16px＋ラベルタイポ＋自然サイズ／Fit のみ contain＋中央寄せ＋ズーム原点中央の正本** |
| 扱い | Expected **維持／追随** | **差分更新**（`mermaid-label-metrics`） |

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| VS Code `themeUpdated.kind` | `'light' \| 'dark' \| 'highContrast'` | — | — | §1。`buildMermaidThemeConfig` 入力 |
| `themeVariables.fontSize`（グローバル） | `string`（固定 px） | — | — | プロジェクト既定 **`'16px'`**。`var(--vscode-...)` 禁止 |
| ラベル `font-family` / `line-height` | CSS | — | — | Mermaid default 相当 **`"trebuchet ms", verdana, arial, sans-serif`**・**`line-height: 1.2`**（エディタ本文 1.6 非継承） |
| 測定用 Host nonce CSS | `font-size` / `font-family` / `line-height` | — | — | `mermaid.render` **前**にラベル測定コンテキストへ **`font-size: 16px`**・同一 `font-family`・**`line-height: 1.2`**（Host 同一 nonce。`'unsafe-inline'` なし） |
| `mermaidSource` | `string` | 0 文字 | — | フェンス全文。タイトル付き図・小型／大型図の fixture 可 |
| `editorMode` | `"preview" \| "markdown" \| "raw"` | — | — | ビューポート UX は `preview` / `markdown` の Mermaid NodeView のみ |
| ビューポート操作 | UI（ローカル DOM） | 描画成功時 | — | Zoom in / Zoom out / Fit（キーボード到達・`aria-label`）。パン／ドラッグ・縦横スクロール。セッション永続なし |
| Default Preview 経路 | `native-preview` | — | — | ビューポート UI 埋め込み **なし**（Non-Goal） |

### Outputs & Failure Returns

| 条件 | 戻り値 / 期待状態 | 仕様根拠 |
|------|-------------------|---------|
| グローバル密度 | 全 kind で `themeVariables.fontSize === '16px'`。`var(--vscode-...)` なし。密度主手段に CSS `scale`/`zoom` を使わない | §5 正常系 7a、`mermaid-label-metrics` |
| ラベルタイポ | ラベル `font-family` が Mermaid default 相当。`line-height: 1.2`（エディタ 1.6 非継承） | §5 正常系 7a |
| 測定＝描画 | Host nonce 測定 CSS も `font-size: 16px`・同一 `font-family`・`line-height: 1.2`。測定と presentation 再注入後が食い違わない | §5 正常系 7a |
| タイトル全文可視 | 図タイトルが枠外クリップ／欠落なく可視。タイトルが図左端より左にはみ出さないよう表示層で align／shift（viewBox / overflow / padding 含む）。中央寄せ実装がタイトル可視を悪化させない | §5 正常系 7b |
| 自然サイズ（scale 1） | 初期描画成功・再 render・テーマ切替後は **scale 1**。**自動 contain（fit-to-viewport）なし**。はみ出し軸は縮小せず縦横スクロール | §5 正常系 7c |
| Fit のみ contain | ユーザーが Fit を押したときだけ枠内 contain / fit-to-viewport | §5 正常系 7c |
| 中央寄せ | 初期／再 render／テーマ切替（scale 1）および Fit 後、図の描画境界がビューポートより**小さい軸**で中央寄せ（水平・垂直とも。片軸のみ小さい場合は当該軸のみ） | §5 正常系 7c |
| ズーム | 虫眼鏡または同等 UI でイン／アウト。ビューポート変換（CSS transform 等）で 16px 図を拡大して読める。密度契約とは別。ピボット／`transform-origin`（または同等）は **ビューポート中央** | §5 正常系 7c |
| パン／スクロール | 枠内パン／ドラッグが可能（**特定修飾キー／中ボタンを必須ロックしない** — Spec Gap）。必要時に縦横スクロールバー。パン後ずれは **次の Fit** で中央寄せに戻る（再 render／テーマ切替は Fit ではなく **scale 1**） | §5 正常系 7c / Spec Gaps |
| scale 1 リセット | ソース変更・再 render（debounce）および `themeUpdated` 一括再描画後に当該ブロックを **scale 1（自然サイズ・中央寄せ含む。自動 contain なし）** に戻す | §5 正常系 7c / 9 |
| a11y | ズーム／Fit コントロールがキーボード到達可能。`aria-label`（例: Zoom in / Zoom out / Fit）あり | §5 正常系 7c |
| Preview RO | ズーム／パンは閲覧操作のみ。Document 編集イベントを送らない | §1、§5 正常系 7c |
| Default Preview | `native-preview` 経路に Mermaid ビューポート UI なし | §5 Non-Goals |
| 構文エラー | `.mermaid-error`。ビューポート UI は隠すか無効化 | §5 Outputs |
| 回帰 | redux kind マップ・HIP・`securityLevel: 'strict'`・nonce 再注入・ELK オプトイン（グローバル強制なし）・ソース併記・ズーム／パン／Fit／`aria-label`・`wrappingWidth: 200`／`padding: 15` 維持 | §5 受け入れ (a)–(e)(n) |
| Non-Goal | VS Code Default Preview / Snap / Chart との**ピクセル完全一致**は要求しない。初期・再 render・テーマ切替後の自動 contain は要求しない | §5 Non-Goals |

### Preconditions & Assumptions

- Webview Mermaid: 測定 nonce CSS（font-size / font-family / line-height）→ `mermaid.render` →（presentation 抽出／nonce 再注入）→ DOMPurify（HIP）→ `.mermaid-preview` 注入 → **scale 1＋小さい軸中央寄せ**（Fit 時のみ contain）
- ユニットはテーマ helper・NodeView DOM／ハンドラ契約・CSS／静的検査で足りる。ピクセル完全一致・Chart／Snap 一致は Non-Goal
- パン開始ジェスチャの具体（中ボタン／修飾キー／専用ハンドル）は **Spec Gap** — TC は「枠内パン可能」まで。特定修飾を必須期待にしない
- 密度＝`fontSize`、閲覧＝ビューポート変換。後者の CSS transform は許容（Non-Goal の「密度主手段としての scale」とは別）
- 中央寄せの検証は transform／translate／layout 契約で近似（ピクセル完全一致不要）

### Complexity Budget

- UI／表示契約。アルゴリズム計算量 N/A
- P2 Stress: 巨大 SVG＋高ズームの CPU／メモリ（RK-003）— 専用 Stress TC なし（図単位状態に閉じる契約を P1 で静的確認）

### Spec Gaps

- ⚠️ パン開始条件の具体ジェスチャは実装時確定（§5 Spec Gaps）。本 testspec は「枠内パン／ドラッグが可能」まで — **特定 modifier を Expected に固定しない**
- それ以外（`16px`・ラベル `font-family` / `line-height: 1.2`・測定 nonce 同値・タイトル可視・自然サイズ／Fit のみ contain／中央寄せ／ズーム原点中央／パン／スクロール・scale 1 リセット・a11y・Default Preview 非対象・密度≠ビューポート）は `mermaid-label-metrics` で確定

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-MRV-001 | Happy | fontsize-16px-all-kinds | P0 | `buildMermaidThemeConfig` 全 kind（`light` / `dark` / `highContrast`） | いずれも `themeVariables.fontSize === '16px'`。`'12px'` / `'8px'` / `'13px'` は Fail | グローバル密度 16px | §5 正常系 7a |
| TC-MRV-002 | Structural | no-vscode-var-in-theme-variables | P0 | 同上 theme config | `themeVariables` に `var(--vscode-...)` **なし** | CSS 変数禁止維持 | §5 正常系 7 / 7a |
| TC-MRV-003 | Structural | density-not-css-scale | P0 | `.mermaid-preview` / 密度関連 CSS・ヘルパ | 密度の主手段として `transform: scale(...)` / `zoom` による見た目縮小を**要求しない**（ビューポート変換用 transform とは別契約） | 密度≠scale | §5 正常系 7a、Non-Goals |
| TC-MRV-004 | Happy | title-not-clipped | P0 | タイトル付き Mermaid 図の render／NodeView 表示層契約（viewBox / overflow / padding／title align・shift 等） | タイトル文字列が枠外クリップや欠落なく全文可視。タイトル左端が図コンテンツ左端より左にはみ出さない（align／shift）。`docJson` / `markdownText` / serialize 不変 | タイトル全文可視 | §5 正常系 7b |
| TC-MRV-005 | Happy | initial-natural-scale | P0 | 描画成功後の Mermaid NodeView（大きめ図 fixture 可） | 初期ビューポートは **scale 1（自然サイズ）**。自動 contain / fit-to-viewport **なし**。はみ出しはスクロールで到達 | 自然サイズ既定 | §5 正常系 7c |
| TC-MRV-006 | Happy | zoom-in-out | P0 | Zoom in / Zoom out コントロール操作（または同等 API） | ズームインでビューポート拡大（transform 等）。ズームアウトで縮小。密度 `fontSize` は `'16px'` のまま | ズームで 16px 図を読める（回帰維持） | §5 正常系 7c |
| TC-MRV-007 | Happy | zoom-a11y | P0 | ズーム／Fit UI | キーボード到達可能。各コントロールに `aria-label`（例: Zoom in / Zoom out / Fit）。コントラストは `--vscode-*` 系。Fit 操作が利用可能（押下時のみ contain） | a11y＋Fit 回帰 | §5 正常系 7c |
| TC-MRV-008 | Happy | pan-within-frame | P0 | ズームイン後の枠内パン／ドラッグ | **枠内でパン可能**。特定修飾キー／中ボタン／専用ハンドルを**必須ロックしない**（実装が選んだジェスチャで可）。Document 編集イベントなし | パン契約＋Spec Gap | §5 正常系 7c、Spec Gaps |
| TC-MRV-009 | Happy | scrollbars-when-needed | P0 | ズームイン後／自然サイズではみ出しがある状態 | 必要時に縦横スクロールバー（または同等 overflow スクロール）で細部到達可 | スクロール回帰 | §5 正常系 7c |
| TC-MRV-010 | Happy | scale-one-on-rerender | P0 | 図ソース変更→ debounce 再 render。事前にズーム／パン済みでも可 | 再 render 後に当該ブロックのビューポートが **scale 1（自然サイズ・中央寄せ含む。自動 contain なし — TC-MRV-024）** | scale 1 リセット | §5 正常系 7c |
| TC-MRV-011 | Happy | scale-one-on-theme-updated | P0 | `themeUpdated` 後の一括再描画 | 再描画後に当該ブロックが **scale 1（自然サイズ・中央寄せ含む。自動 contain なし — TC-MRV-024）** | テーマ切替 scale 1 | §5 正常系 9 |
| TC-MRV-012 | Corner | viewport-ops-preview-ro | P0 | Preview モードでズーム／パン操作 | Document へ編集イベントを送らない（dirty / `docJson` / `markdownText` 不変）。閲覧操作のみ | Preview 厳密 RO | §1、§5 正常系 7c |
| TC-MRV-013 | Structural | no-default-preview-viewport | P0 | Default Preview（`native-preview`）経路・寄与コマンド／HTML | Mermaid ビューポート UI（ズーム／パン／Fit）の埋め込み・別 Webview 化が**ない** | Default Preview 非対象 | §5 Non-Goals |
| TC-MRV-014 | Happy | redux-kind-map-regression | P0 | `buildMermaidThemeConfig` 全 kind | light→`redux`、dark/HC→`redux-dark`。`securityLevel: 'strict'`。classic `default`/`dark` マップは Fail | redux 回帰 | §5 正常系 7 |
| TC-MRV-015 | Corner | hip-strict-regression | P0 | sanitize options および theme config | `HTML_INTEGRATION_POINTS: { foreignobject: true }`（または同等）。全 kind `securityLevel: 'strict'` | HIP / strict 回帰 | §5 正常系 10、§9 |
| TC-MRV-016 | Structural | nonce-elk-optin-regression | P0 | nonce 再注入経路＋ ELK initialize／`layout: elk` 経路 | Host 同一 nonce 再注入契約維持（`'unsafe-inline'` なし）。グローバル `layout: 'elk'` 強制なし。`layout: elk` 指定はオプトイン成功経路 | nonce / ELK 回帰 | §5 正常系 11–12 |
| TC-MRV-017 | Corner | syntax-error-hides-viewport | P1 | 構文不正 Mermaid ソース | `.mermaid-error` 表示。ビューポート UI は隠すか無効化。ソースは Document に保持 | エラー時 UI | §5 Outputs |
| TC-MRV-018 | Structural | viewport-in-preview-and-markdown | P1 | `editorMode` `preview` および `markdown` | 両モードの Mermaid NodeView にビューポート UX あり。`raw` は本 TC 対象外（島は Markdown/Preview 面） | 適用範囲 | §5 Inputs |
| TC-MRV-019 | Boundary | per-diagram-fontsize-override | P1 | frontmatter / `%%{init}%%` で `themeVariables.fontSize` 上書き | 当該図のみ上書き可（グローバル `'16px'` を壊さない）。ネイティブ優先 | 図単位上書き許容 | §5 正常系 6 / 7a |
| TC-MRV-020 | Structural | related-suites-16px-aligned | P1 | redux-elk / edge / contrast / snap / wysiwyg TC-149 の Expected | いずれもグローバル `fontSize === '16px'`。`'12px'` / `'13px'` 必須期待が残っていない | RK 防止・整合 | §5 正常系 7a |
| TC-MRV-021 | Structural | source-below-diagram | P1 | Mermaid NodeView DOM 順 | `.mermaid-preview` → `.mermaid-source`（図の下にソース） | ソース併記回帰 | §5 正常系 4 |
| TC-MRV-022 | Structural | no-viewport-session-persist | P1 | ビューポート状態の保存経路（設定 / workspaceState / 永続ストア） | セッション永続・設定保存を**要求しない**（MVP） | 永続 Out | §5 Non-Goals |
| TC-MRV-023 | Structural | document-untouched | P1 | 変更対象パス（theme / NodeView ビューポート / CSS） | `docJson` / `markdownText` / serialize / dirty / Marp / 画像 rewrite に触れない | 表示層限定 | §5 受け入れ 13 |
| TC-MRV-024 | Happy | center-natural-and-fit | P0 | 図の描画境界がビューポートより小さい軸がある fixture。初期 scale 1・Fit 操作・再 render／`themeUpdated`（scale 1）の各後 | **小さい軸のみ**中央寄せ（水平・垂直とも）。初期／再 render／テーマ切替は scale 1（自動 contain なし）。**Fit 押下時のみ contain**。大きい軸のはみ出しはスクロール。ピクセル完全一致は不要 | 中央寄せ＋自然サイズ／Fit | §5 正常系 7c、受け入れ (h)(i) |
| TC-MRV-025 | Happy | zoom-origin-viewport-center | P0 | Zoom in／Zoom out（または同等 API）。`transform-origin`／ピボット（または同等）を検査 | ズームのピボット／`transform-origin`（または同等）が **ビューポート中央**。密度 `fontSize` は `'16px'` のまま | ズーム原点中央 | §5 正常系 7c、受け入れ (j) |
| TC-MRV-026 | Structural | measure-nonce-css-label-metrics | P0 | `mermaid.render` **前**の Host 同一 nonce 測定 CSS（ラベル測定コンテキスト）および `themeVariables.fontSize` | 測定 CSS が **`font-size: 16px`**・**`font-family` に trebuchet ms（Verdana / Arial / sans-serif 含む）**・**`line-height: 1.2`**（`themeVariables.fontSize === '16px'` と一致）。`var(--vscode-...)` なし。`style-src` に `'unsafe-inline'` なし | 測定＝描画＋ラベルタイポ | §5 正常系 7a、受け入れ (f)(f2) |
| TC-MRV-027 | Corner | pan-then-fit-recenters | P1 | ズーム後にパンで手動オフセットを付けたのち Fit 操作 | パン後のずれは許容。**次の Fit で TC-MRV-024 の中央寄せに戻る**（再 render／テーマ切替は Fit ではなく scale 1）。ズーム／パン／Fit／`aria-label` 回帰は壊れない | パン後 Fit 中央復帰 | §5 正常系 7c、受け入れ (l) |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-MRV-001, TC-MRV-004–011, TC-MRV-014, TC-MRV-024–025 | — |
| Boundary | TC-MRV-019 | 空ソースは既存 Mermaid TC |
| Structural | TC-MRV-002–003, TC-MRV-013, TC-MRV-016, TC-MRV-018, TC-MRV-020–023, TC-MRV-026 | — |
| Corner | TC-MRV-012, TC-MRV-015, TC-MRV-017, TC-MRV-027 | — |
| Stress | — | 巨大 SVG＋高ズームは RK-003。専用 P2 なし（図単位閉じるは TC-MRV-023） |

### Complexity Notes

- ドメイン: VS Code Extension Webview（Mermaid NodeView / theme / viewport UI）
- 競技系ドメインパターン: N/A
- API / Worker: N/A（ローカル拡張）

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR） | `test_single`: `npm run test:unit -- --grep 'mermaid-readable-viewport\|TC-MRV-00[1-9]\|TC-MRV-0[12][0-7]'` |
| P2 | — | 本 testspec に P2 なし |
| 回帰 | redux-elk / edge-styles / contrast / snap / TC-149 | Expected `16px` 更新後に Red→Green |

想定配置: `src/test/suite/unit/mermaid-readable-viewport.test.ts`（`.cursor/stack.md` `test_file_glob`）

**実装メモ（testspec-implementation）:**

1. TC-MRV-005 / 010 / 011 / 024 を「初期 fit／re-fit」→「scale 1（自然サイズ）・Fit のみ contain」へ更新（本番は現行 auto-refit のため意図的 Red 可）
2. TC-MRV-026（および TC-003c）に測定 CSS `font-family`（trebuchet ms）／`line-height: 1.2` を追加
3. Fit ボタン経路の contain・中央寄せ・ズーム原点中央・`aria-label`・`wrappingWidth: 200`／`padding: 15`／`fontSize: '16px'` は維持
4. 中央寄せ・ズーム原点は DOM／transform／`transform-origin`／layout 契約で近似（**ピクセル完全一致不要**）
5. パン TC は「枠内パン可能なハンドラ／overflow 契約」を assert — **特定 modifier を固定しない**
6. Default Preview 非対象・redux／HIP／strict／nonce／ELK／ソース併記は既存回帰 TC を維持
---

## Trace Results

testspec-implementation（2026-09-26 / `mermaid-label-metrics`）。Expected を scale 1／Fit のみ contain／ラベルタイポへ更新。本番は現行 auto-`fitToViewport`／測定 CSS に `font-family`・`line-height` 未設定のため **意図的 Red**。

### TC-MRV-001–003 / TC-MRV-026 (P0): 密度 16px・測定 nonce・ラベルタイポ・var 禁止・密度≠scale

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 全 kind theme config + 測定 Host nonce CSS + 密度 CSS | — |
| Output | `fontSize: '16px'`、測定 `font-size: 16px`・`font-family` trebuchet・`line-height: 1.2`、`var` なし、密度主手段に scale なし | §5 7a |

**Result:** ❌ Fail（意図的 Red）— 測定 CSS に `font-family` / `line-height: 1.2` 未設定。2026-09-26

---

### TC-MRV-004–007 (P0): タイトル・自然サイズ・ズーム・a11y／Fit

**Result:** ❌/✅ 混在 — TC-MRV-005（scale 1・自動 contain なし）は現行 auto-refit のため Red。タイトル／a11y／Fit ボタン契約は既存 Green 想定

---

### TC-MRV-008–011 (P0): パン／スクロール／scale 1 リセット（中央寄せ含む）

**Result:** ❌/✅ — パン／スクロール経路は既存。TC-MRV-010/011 は scale 1 期待のため現行 refit で Red

---

### TC-MRV-012–016 (P0): RO・Default Preview・redux／HIP／strict／nonce／ELK 回帰

**Result:** ✅ — 回帰 TC は Green（ビューポート既定以外）

---

### TC-MRV-024–025 (P0): 中央寄せ・ズーム原点中央

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 小図 fixture + scale 1／Fit；ズーム操作 | — |
| Output | 小さい軸のみ中央；初期／再 render／テーマは scale 1；Fit のみ contain；`transform-origin`＝ビューポート中央 | §5 7c |

**Result:** ❌ Fail（意図的 Red）— 初期／再 render が auto-`fitToViewport`。ズーム原点は別途。2026-09-26

---

### TC-MRV-017–023 / TC-MRV-027 (P1)

| ID | Result | Notes |
|----|--------|-------|
| TC-MRV-017–018 | ✅ | 既存契約維持 |
| TC-MRV-019 | ✅ | グローバル `'16px'` |
| TC-MRV-020 | ✅ | 関連 suite Expected／テストを `16px` に整合 |
| TC-MRV-021–023 | ✅ | ソース順・非永続・Document 非接触 |
| TC-MRV-027 | ❌/✅ | Fit 中央復帰経路は既存。scale 1 契約追随で Red の可能性 |

### Trace Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-MRV-005, TC-MRV-010–011, TC-MRV-024, TC-MRV-026 | P0 | ❌ Red | 自然サイズ／ラベルタイポ未実装 |
| TC-MRV-001–004, TC-MRV-006–009, TC-MRV-012–023, TC-MRV-025, TC-MRV-027 | P0/P1 | ✅/混在 | 既存契約＋Fit／ズーム原点 |

---

## Self-Check Report

### A. Input & Constraints
- [x] ✅ kind 三値・fontSize 16px・ラベルタイポ: TC-MRV-001–002 / TC-MRV-026
- [x] ✅ editorMode / Default Preview: TC-MRV-013 / TC-MRV-018
- [x] N/A 整数オーバーフロー — UI 契約

### B. Structural Patterns
- [x] ✅ 密度≠scale・測定 nonce／タイポ・nonce/ELK・ソース順・Document 非接触: TC-MRV-003 / TC-MRV-026 / TC-MRV-016 / TC-MRV-021 / TC-MRV-023
- [x] ✅ 関連 suite 整合: TC-MRV-020
- [x] ✅ 自然サイズ／Fit のみ contain／中央寄せ・ズーム原点: TC-MRV-005 / TC-MRV-024–025
- [x] N/A グラフ非連結 — 該当なし

### C. Corner & Failure
- [x] ✅ Preview RO・HIP/strict・構文エラー UI: TC-MRV-012 / TC-MRV-015 / TC-MRV-017
- [x] ✅ パン Spec Gap（modifier 非固定）＋Fit で中央復帰: TC-MRV-008 / TC-MRV-027
- [x] N/A API 404 — 該当なし

### D. Complexity & Resources
- [x] ✅ ビューポート状態は図単位・非永続: TC-MRV-022 / TC-MRV-023
- [x] N/A 最悪計算量 Stress — 専用 P2 なし

### E. API / Worker
- [x] N/A HTTP / 認証 — ローカル VS Code 拡張

### Uncovered / Spec Gaps
- ⚠️ パン開始ジェスチャの具体（中ボタン／修飾キー／ハンドル）— 実装時確定。TC-MRV-008 は「枠内パン可能」まで
- ピクセル目視の「読める」／中央寄せの完全一致 — transform／overflow／origin 契約で近似（Non-Goal）
- ピンチ・高度な SR 図読解・密度スライダー — Out

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-26 | `mermaid-label-metrics`: 初期／再 render／テーマ切替 Expected を scale 1（自動 contain 撤回）へ。Fit のみ contain。小さい軸は中央寄せ・はみ出しはスクロール。測定 CSS に `font-family`（trebuchet ms）／`line-height: 1.2` を追加。TC-MRV-005/010/011/024/026/027 Expected 更新。改訂履歴追記 |
| 2026-09-26 | testspec-implementation — `mermaid-readable-viewport.test.ts` を `'16px'` 追随＋TC-MRV-024–027 追加。関連 suite（redux-elk / edge / contrast / snap / preview-mode）の fontSize Expected を `'16px'` に更新。Trace を意図的 Red に更新 |
| 2026-09-26 | `mermaid-default-preview-parity`: グローバル `fontSize` Expected `'12px'`→`'16px'`。測定 nonce `font-size: 16px`（TC-MRV-026）。中央寄せ（TC-MRV-024）・ズーム原点中央（TC-MRV-025）・パン後 Fit 復帰（TC-MRV-027）追加。ズーム／パン／Fit／aria-label／redux／strict／HIP／nonce／ELK／ソース併記回帰維持。ピクセル完全一致は Non-Goal。テストコード未変更 |
| 2026-09-06 | 初版 — `fontSize: '8px'`・タイトル全文可視・初期 fit・ズーム／a11y・パン（modifier 非固定）／スクロール・re-fit・Preview RO・Default Preview 非対象・redux/HIP/strict/nonce/ELK 回帰（設計のみ）。関連 suite `13px`→`8px` 更新指示 |
| 2026-09-06 | testspec-implementation — `mermaid-readable-viewport.test.ts` 追加・unit-entry 登録・関連 suite Expected `8px` 更新。Trace を意図的 Red に更新 |
| 2026-09-06 | 密度 polish: Expected／TC のグローバル `fontSize` を `'8px'` → `'12px'`。タイトル左欠け対策（viewBox / `getComputedTextLength` / 水平パッド）を契約に追随 |
| 2026-09-06 | タイトル align／shift: TC-MRV-004 Expected に「title left ≥ diagram content left」を追記。表示層契約を Outputs に同期 |
| 2026-09-06 | ノード寸法 polish（choice B）: Expected／TC のグローバル `fontSize` を `'10px'` → `'12px'`。flowchart `wrappingWidth: 200`・`padding: 15`、render 前 Host-nonce 測定 CSS 契約を追記 |


## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-26 | `mermaid-label-metrics`: readable-viewport Expected を自然サイズ（scale 1）／Fit のみ contain／ラベルタイポへ更新。統合改訂履歴追記 |
| 2026-09-26 | `mermaid-default-preview-parity`: 統合 testspec の全 suite Expected を `'12px'`→`'16px'`。readable-viewport に TC-MRV-024–027（中央寄せ・ズーム原点・測定 nonce・パン後 Fit 復帰）追加。改訂履歴追記 |
| 2026-09-19 | doc-reorg: 5 Mermaid testspec を本ファイルへ統合。パス移設／Mermaid 統合。契約内容不変 |
| 2026-10-03 | doc 整理: Mermaid 旧個別アーカイブ削除に伴う記述更新 |