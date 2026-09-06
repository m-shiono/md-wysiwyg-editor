# Test Specification: mermaid-redux-elk-fidelity

## 概要

- **対象:** Mermaid 描画の忠実性向上 — (1) VS Code kind → Mermaid `redux` / `redux-dark` マップ (2) CSP 下で Mermaid presentation `<style>` を Host 同一 nonce 再注入（または同等の CSP 安全手段）(3) `@mermaid-js/layout-elk` 登録＋ frontmatter / `%%{init}%%` オプトイン ELK（グローバル強制なし・遅延ロード）(4) 静的 Host CSS エッジフォールバックの縮小／撤廃 (5) HIP / `securityLevel: 'strict'` / 図下ソース併記 / Preview RO / `'unsafe-inline'` なし回帰
- **対応仕様:** [doc/systemspec.md](systemspec.md) §5（正常系 7 / 10–13）、§9（CSP / sanitize）、§1（Preview RO・`themeUpdated`）
- **Requirements Brief:** `temporary/requirements-brief-mermaid-redux-elk-fidelity.md`（AD-001–015）
- **関連 testspec（本タスクで Expected 更新）:**
  - [testspec-fix-mermaid-edge-styles.md](testspec-fix-mermaid-edge-styles.md) — classic `default`/`dark` マップ撤回。Host CSS を「必須永続 stroke」から縮小／安全網へ
  - [testspec-mermaid-contrast-readable.md](testspec-mermaid-contrast-readable.md) — kind マップを redux 系へ。HIP / XSS / 広い面不変は維持
  - [testspec-mermaid-snap-style-with-source.md](testspec-mermaid-snap-style-with-source.md) — テーマ Expected を redux 系へ。ソース併記・Preview RO は維持
  - [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-149（および TC-145 の initialize 前提）を redux マップへ
- **テストコード:** `src/test/suite/unit/mermaid-redux-elk-fidelity.test.ts`（TC-001–020 実装済 — 本番未修正のため意図的 Red）
- **作成日:** 2026-09-06

### 既存 suite との関係（必須明示）

| 項目 | edge-styles | contrast / snap | 本 testspec |
|------|-------------|-----------------|-------------|
| 所在 | [testspec-fix-mermaid-edge-styles.md](testspec-fix-mermaid-edge-styles.md) | contrast / snap | 本ファイル |
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
| kind `light` | Mermaid `theme: 'redux'` + `securityLevel: 'strict'`。`themeVariables.fontSize === '8px'`。`themeVariables` に `var(--vscode-...)` なし | §5 正常系 7 / 7a、AD-004、`mermaid-display-density` |
| kind `dark` / `highContrast` | Mermaid `theme: 'redux-dark'` + strict。`themeVariables.fontSize === '8px'`。classic `default`/`dark` マップ禁止。`var(--vscode-...)` なし | §5 正常系 7 / 7a、AD-004、`mermaid-display-density` |
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
- per-diagram frontmatter `config.theme` / `config.layout` 食い違いは仕様許容（§5 例外系 3）— 専用 TC なし（ELK オプトイン成功は TC-007）
- Chart 専用アイコン／常時 ELK／`'unsafe-inline'` 緩和は Out

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-001 | Happy | theme-light-redux | P0 | `buildMermaidThemeConfig('light')`（または同等） | `theme: 'redux'`、`securityLevel: 'strict'`、`themeVariables.fontSize === '8px'`、`themeVariables` に `var(--vscode-...)` なし。classic `'default'` マップは Fail | kind→redux＋表示密度（AD-004 / `mermaid-display-density`） | §5 正常系 7 / 7a |
| TC-002 | Happy | theme-dark-redux-dark | P0 | `buildMermaidThemeConfig('dark')` | `theme: 'redux-dark'`（`'dark'` classic / `'default'` 強制ではない）。strict。`themeVariables.fontSize === '8px'`。`var(--vscode-...)` なし | dark→redux-dark＋密度 | §5 正常系 7 / 7a |
| TC-003 | Happy | theme-hc-redux-dark | P0 | `buildMermaidThemeConfig('highContrast')` | `theme: 'redux-dark'`。専用 HC パレット不要。strict。`themeVariables.fontSize === '8px'`。`var(--vscode-...)` なし | HC 同マップ＋密度（AD-004） | §5 正常系 7 / 7a |
| TC-004 | Happy | nonce-presentation-reinject | P0 | Mermaid `render` 結果に presentation `<style>` を含む fixture／経路を検査（または再注入ヘルパの契約） | Host 発行と**同一 nonce** 付き `<style>` が Webview に再注入される（セレクタは `.mermaid-preview` / 当該図スコープ）。ユーザー／Mermaid ソース由来の任意 CSS 素通し経路なし。同等の CSP 安全手段でも可（`'unsafe-inline'` は不可） | CSP 下で本物 presentation を効かせる（AD-002） | §5 正常系 11 |
| TC-005 | Structural | csp-no-unsafe-inline | P0 | Custom Editor Webview CSP 生成 | `style-src` に `'unsafe-inline'` **なし**。`nonce-` 付き許可あり。Marp パネル CSP は本 TC 対象外 | セキュリティ不変（AD-001） | §9 |
| TC-006 | Happy | flowchart-edge-visible-after-reinject | P0 | CSP＋HIP sanitize＋nonce 再注入後の flowchart エッジ契約（静的 CSS／再注入 style の共起、またはヘルパ出力） | エッジ／パスが黒塗りブロブにならない契約（`fill: none` 相当が presentation 再注入側、または欠落時のみ最小安全網）。永続必須の全面 `stroke: var(--vscode-foreground)` 上書きを**唯一の正**としない | 受け入れ (b) | §5 正常系 11、受け入れ |
| TC-007 | Happy | layout-elk-after-register | P0 | frontmatter または `%%{init}%%` で `layout: elk`（互換 flowchart ELK 指定可）のフェンス全文を render 経路に渡す。事前に `registerLayoutLoaders`（または遅延登録完了） | ELK ローダ登録後に図が描画成功（SVG／`.mermaid-preview` 成功経路）。フェンス全文・非 strip | ELK オプトイン成功（AD-005） | §5 正常系 6/12 |
| TC-008 | Structural | no-global-forced-elk | P0 | グローバル `mermaid.initialize`／`buildMermaidThemeConfig`（または同等）を検査 | `layout: 'elk'`（または同等の全図 ELK 強制）が**含まれない**。`layout` 未指定ソースは dagre 系既定のまま | オプトインのみ（AD-006） | §5 正常系 12、Non-Goals |
| TC-009 | Structural | host-css-edge-fallback-shrunk | P0 | `media/editor.css`（または Host nonce 静的エッジ CSS）を検査 | 永続必須の `stroke: var(--vscode-foreground)` 等による redux 配色上書きを**要求しない**。残存する場合はコメント／範囲が「本物 CSS 欠落時の安全網」に限定され、島ライト強制は不在 | Host CSS 縮小（AD-003） | §5 正常系 11 |
| TC-010 | Corner | hip-regression | P0 | sanitize options（または contrast-readable TC-001/002 相当） | `HTML_INTEGRATION_POINTS: { foreignobject: true }`（または同等）。ラベル HTML 残存契約は contrast-readable と整合 | HIP 不変（AD-008） | §5 正常系 10 |
| TC-011 | Structural | security-level-strict | P0 | `buildMermaidThemeConfig` 全 kind および initialize 経路 | いずれも `securityLevel: 'strict'`。全 kind で `themeVariables.fontSize === '8px'`（`var(--vscode-...)` なし） | strict 不変＋グローバル密度 | §5 正常系 7 / 7a、AD-008、`mermaid-display-density` |
| TC-012 | Structural | source-below-diagram | P0 | Mermaid NodeView DOM 構築順 | `.mermaid-preview` が `.mermaid-source` より先（図の下にソース） | ソース併記回帰 | §5 正常系 4 |
| TC-013 | Corner | preview-source-readonly | P0 | Preview 表示中のソース領域 | 編集イベントを Document へ送らない（`contenteditable=false` またはイベント非送出） | Preview 厳密 RO | §1、§5 正常系 5 |
| TC-014 | Structural | elk-lazy-register | P1 | `@mermaid-js/layout-elk` の import／`registerLayoutLoaders` 呼び出し箇所 | 動的 import／コード分割、または初回 ELK 要求時登録のいずれか。初期バンドルへの不用意な静的肥大化を避ける契約 | 遅延ロード（AD-007） | §5 正常系 12 |
| TC-015 | Corner | elk-register-failure-isolated | P1 | ELK ローダ登録／import が失敗する mock | 当該図のみエラー表示。Webview 全体のメッセージングは停止しない（try-catch 隔離） | 失敗隔離（AD-007/012） | §5 Outputs |
| TC-016 | Happy | theme-updated-uses-redux-map | P1 | `themeUpdated` で kind 切替後の `buildMermaidThemeConfig` 利用 | 再初期化は redux マップに従う（dark→`redux-dark` 等）。Document 不変 | §5 正常系 9 | §5 正常系 9、AD-012 |
| TC-017 | Structural | document-untouched | P1 | 変更対象パス（theme／nonce 再注入／ELK／NodeView 周辺） | `docJson` / `markdownText` / serialize / dirty / Marp / 画像 rewrite に触れない | 表示層限定（AD-009） | §1、AD-009 |
| TC-018 | Corner | related-suites-expected-aligned | P1 | edge-styles / contrast / snap / wysiwyg TC-149 の Expected を照合 | classic `default`/`dark` 必須期待・永続必須 `vscode-foreground` stroke 正本が残っていない。TC-149 は light→`redux` / dark|HC→`redux-dark` | RK-007 防止 | AD-011 |
| TC-019 | Corner | xss-script-on-still-removed | P1 | ラベル付き SVG + `<script>` / `on*` を sanitize | script/on* 除去。安全ラベル残存（HIP 前提） | XSS 不変 | §5 例外系 1、§9 |
| TC-020 | Structural | no-island-light-forced | P1 | `.mermaid-preview` / `.mermaid-block` の CSS | 明るい固定サーフェス強制（例: `background-color: white`）が**存在しない** | 島ライト撤回維持 | §5 正常系 11 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-001–004, TC-006–007, TC-016 | — |
| Boundary | — | 空ソースは既存 Mermaid TC。本差分は契約検査が主 |
| Structural | TC-005, TC-008–009, TC-011–012, TC-014, TC-017, TC-020 | — |
| Corner | TC-010, TC-013, TC-015, TC-018–019 | — |
| Stress | — | 多数図再描画・バンドル肥大は RK。専用 Stress なし |

### Complexity Notes

- ドメイン: VS Code Extension Webview（CSP / nonce / theme map / ELK loader / DOMPurify）
- 競技系ドメインパターン: N/A
- API / Worker: N/A（ローカル拡張）

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR） | `test_single`: `npm run test:unit -- --grep 'mermaid-redux-elk\|TC-00[1-9]\|TC-0[12][0-9]'` |
| P2 | — | 本 testspec に P2 なし |
| 回帰 | contrast-readable / snap-style / edge-styles / TC-149 / TC-152 / TC-130–132 | Expected 更新後に Red→Green |

想定配置: `src/test/suite/unit/mermaid-redux-elk-fidelity.test.ts`（`doc/stack.md` `test_file_glob`）

**実装メモ（testspec-implementation）:**

1. 本 suite で TC-001–020 を追加（本番コードは触らない → 意図的 Red）
2. `fix-mermaid-edge-styles` / `mermaid-contrast-readable` / `mermaid-snap-style-with-source` / wysiwyg TC-149（＋ TC-145 initialize 前提）を新 Expected に合わせて更新
3. nonce 再注入は「同一 nonce 属性＋ presentation セレクタ／`fill: none` 相当の共起」を最小 assert とする
4. ELK は `registerLayoutLoaders` 呼び出しと `layout: elk` ソース経路の契約検査で足りる（実 ELK エンジン結合は任意）

---

## Trace Results

実行: `npm run test:unit -- --grep 'mermaid-redux-elk|fix-mermaid-edge|mermaid-contrast-readable|mermaid-snap-style|TC-149'`（2026-09-06）。本番未修正のため意図的 Red。

### TC-001–003 (P0): redux kind マップ

| Step | State / Action | Value |
|------|----------------|-------|
| Input | light / dark / highContrast | `buildMermaidThemeConfig` |
| Output | redux / redux-dark / redux-dark + strict | AD-004 |

**Result:** ❌ Fail（Red）— 現行実装は classic `default`/`dark`。テストコード実装済

---

### TC-004–006 (P0): nonce 再注入＋エッジ可視＋CSP

| Step | State / Action | Value |
|------|----------------|-------|
| Input | render presentation style + Host nonce + CSP | — |
| Output | 同一 nonce 再注入、`unsafe-inline` なし、黒ブロブ回避 | AD-001/002 |

**Result:** ❌ Fail（Red）— nonce 再注入未実装。TC-005 CSP は Pass 想定

---

### TC-007–009 (P0): ELK オプトイン／非強制／Host CSS 縮小

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `layout: elk` 図 / 未指定図 / Host CSS | — |
| Output | 登録後成功・グローバル ELK なし・永続 vscode-foreground 必須なし | AD-003/005/006 |

**Result:** ❌ Fail（Red）— layout-elk 未導入。TC-008 非強制は Pass 想定。TC-009 Host CSS 縮小 Red

---

### TC-010–013 (P0): HIP / strict / ソース順 / Preview RO

**Result:** ✅ Pass 想定 — 既存契約継承の回帰 assert

---

### TC-014–020 (P1)

| ID | Result | Notes |
|----|--------|-------|
| TC-014 | ❌ | 遅延ロード未実装 Red |
| TC-015 | ❌ | ELK 失敗隔離経路未実装 Red |
| TC-016 | ❌ | themeUpdated→redux マップ Red（実装が classic） |
| TC-017 | ✅ | Document 非接触（静的検査） |
| TC-018 | ✅ | 関連 suite Expected／テストを redux へ整合済 |
| TC-019 | ✅ | XSS 除去 |
| TC-020 | ✅ | 島ライト不在 |

### Trace Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-001–004, TC-006–007, TC-009 | P0 | ❌ Red | 本番未実装 |
| TC-005, TC-008, TC-010–013 | P0 | ✅ / 部分 | 回帰・非強制・CSP |
| TC-014–016 | P1 | ❌ Red | ELK／redux マップ |
| TC-017–020 | P1 | ✅ | 整合・XSS・島 |

---

## Self-Check Report

### A. Input & Constraints
- [x] ✅ kind 三値: TC-001–003
- [x] ✅ CSP / nonce / ELK ソース入力: TC-004–008
- [x] N/A 整数オーバーフロー — UI/CSP 契約

### B. Structural Patterns
- [x] ✅ グローバル ELK 非強制・Host CSS 縮小・CSP: TC-005 / TC-008–009
- [x] ✅ DOM 順・Document 非接触: TC-012 / TC-017
- [x] ✅ 遅延ロード構造: TC-014
- [x] N/A グラフ非連結 — 該当なし（ELK は登録契約）

### C. Corner & Failure
- [x] ✅ HIP / XSS / Preview RO / ELK 失敗隔離: TC-010 / TC-013 / TC-015 / TC-019
- [x] ✅ 関連 suite 整合: TC-018
- [x] N/A API 404 — 該当なし

### D. Complexity & Resources
- [x] ✅ 遅延ロードで初期肥大回避: TC-014（P1）
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
| 2026-09-06 | `mermaid-readable-viewport`: TC-001–003 / TC-011 および Spec Digest Outputs のグローバル `fontSize` を `'13px'` → `'8px'` に更新 |
| 2026-09-06 | `mermaid-display-density`: TC-001–003 / TC-011 Expected にグローバル `themeVariables.fontSize === '13px'`（`var(--vscode-...)` なし）を追加。Spec Digest Outputs 追随 |
| 2026-09-06 | testspec-implementation: `mermaid-redux-elk-fidelity.test.ts` TC-001–020 追加。関連 suite Expected を redux へ追随。Trace を意図的 Red で更新 |
| 2026-09-06 | 初版 — redux kind マップ・nonce presentation 再注入・ELK オプトイン／非強制・Host CSS 縮小・HIP/strict/ソース併記/Preview RO/`unsafe-inline` なし回帰（設計のみ） |
