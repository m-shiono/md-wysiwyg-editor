# Test Specification: native-preview-side-and-default-raw

## 概要

- **対象:** 初期 `editorMode` を Raw に変更、mode-toolbar の非モード **Default Preview**（標準 Markdown Preview を **同一 editor group** に開く）、dirty Save/Cancel ゲート、三点モード往復回帰、Pattern A / Marp 非干渉、表示ラベル（Default Preview \| Editor Preview \| Edit Rich Editor \| Edit Raw Text）、Host 同一グループ補償（preferred `activeIndex+1` best-effort）
- **対応仕様:** [doc/requirements/systemspec.md](../requirements/systemspec.md) §1（初期 Raw・Default Preview・三点往復・表示ラベル）、§8（dirty Save/Cancel ゲート）、§10（`showNativeMarkdownPreview`・同一グループ補償・Pattern A / Marp 非干渉）、アーキテクチャ AD-016
- **Requirements Brief:** `temporary/requirements-brief-native-preview-side-and-default-raw.md`（AD-001–014）; `temporary/requirements-brief-default-preview-same-tab-group.md`（AD-001–010 — オープン API / 同一グループ / コマンド ID / ラベル）
- **テストコード:** `src/test/suite/unit/native-preview-side-and-default-raw.test.ts`（mocha + vscode mock）。関連回帰は既存三点モード suite と併用可。`default-preview-same-tab-group` の Expected 更新分は **TDD Red 実装済み**（2026-09-06）
- **作成日:** 2026-09-05
- **関連:** [doc/test/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) TC-070–084（三点・Pattern A）。本機能の検証正本は本ファイル。TC-070 の初期モード期待は `raw` へ整合済み

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| `DEFAULT_EDITOR_MODE` | `'raw'`（定数） | — | — | オープン時の初期 mode id（AD-001 / AD-016） |
| `editorMode` | `"preview" \| "markdown" \| "raw"` | — | — | 第 4 mode id なし |
| `modeSwitchCommand` / mode-toolbar 三点 | UI / postMessage | — | — | `data-mode` のみ。ディスク I/O なし |
| Default Preview ボタン | DOM | — | — | `data-action="native-preview"`（または同等）。**`data-mode` なし**。表示ラベル `Default Preview` |
| `openNativePreview` | Webview → Host postMessage | — | — | 旧名 `openNativePreviewToSide` は廃止。dirty/save/コマンドは Host のみ |
| Document `dirty` | `boolean` | — | — | dirty 時のみ Save/Cancel ダイアログ |
| Save / Cancel 選択 | ダイアログ | — | — | Don't Save 選択肢なし |
| 対象 URI | `vscode.Uri` | — | — | アクティブ WYSIWYG `TabInputCustom.uri` |
| コマンド ID（正本） | `md-wysiwyg-editor.showNativeMarkdownPreview` | — | — | Palette + Webview。製品内別名 `md-wysiwyg-editor.showNativeMarkdownPreviewToSide` は同一ハンドラ（AD-004）。旧プレフィックス `vsc-md-editor.*` 互換ではない |
| 同一グループ補償入力 | `viewColumn` + `activeIndex` | — | — | open 前に `tabGroups.activeTabGroup` から記録。open 後 `moveActiveEditor`（または同等の安定 API; preferred index `activeIndex+1`） |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 仕様根拠 |
|------|-------------------|---------|
| オープン成功 | 初期 `editorMode === "raw"`、`body[data-mode="raw"]`、Raw 三点ボタン `active`、表示ラベル Edit Raw Text | §1 Outputs |
| 三点往復成功 | `preview` ↔ `markdown` ↔ `raw` が mode-toolbar で切替可。Document / ディスク不変（内容未変更時） | §1 受け入れ P0 |
| Default Preview・clean | 現在面不変のまま `markdown.showPreview` 実行。Preview はアクティブ WYSIWYG と **同一 editor group**。Beside 新規グループなし。ダイアログなし | §1 Outputs, §10 |
| Default Preview・dirty→Save 成功 | save 成功後のみ `markdown.showPreview` + 同一グループ補償。dirty 解除 | §8 正常系 8 |
| Default Preview・dirty→Cancel / 閉じる | プレビュー非オープン。Document / dirty 不変 | §8 |
| Default Preview・save 失敗 / Raw パース失敗中 | ErrorMessage + Output、プレビュー非オープン | §1 Outputs, §8 |
| URI 解決不能 | Warning（`Open a Markdown file first` 相当）、プレビュー非オープン | §1 Outputs |
| `showPreview` 失敗 / 欠如 | ErrorMessage + Output、プレビュー非オープン。**`showPreviewToSide` へフォールバックしない** | §10, Non-Goals |
| 同一グループ補償 | open 後 `moveActiveEditor`（または同等の安定 API）で同 group へ移す。preferred `activeIndex+1` は best-effort。exact index 不可でも同 group 成功。Beside 復帰なし | §10, RK-018/019 |
| Pattern A | Default Preview オープンで `isBuiltinSwitchToSameMdFile` 相当の誤検知なし。Custom Editor dispose しない | §10 |
| Marp | Default Preview で §6 パネルを閉じない・自動オープンしない | §10 |

### Preconditions & Assumptions

- Custom Editor viewType `md-wysiwyg-editor.wysiwyg` で `.md` を開いていること
- ビルトイン Markdown 拡張が `markdown.showPreview` を提供する環境（欠如時は失敗パス。Beside フォールバックなし）
- セッション永続モードは新設しない（ハードコード既定のみ）
- 統合テストは Extension Development Host（既存方針）
- Custom Editor フォーカス時 `activeTextEditor === undefined` でも Host 補償で同 group に載ること（`showTextDocument` 捏造は禁止）

### Complexity Budget

- UI / Host コマンド契約が主。アルゴリズム計算量 N/A
- P2 Stress: 本機能では不要（大ファイルは既存 TC-008 / TC-066）

### Spec Gaps

- なし（`default-preview-same-tab-group` AD-001–010 / systemspec §1・§8・§10 反映済み）
- 隣接 index（`activeIndex+1`）の厳密保証は Non-Goal — TC-021 は同 group 必須 + preferred move 観測。exact index 失敗は同 group 成功として Pass
- AD-013（未保存バッファの標準 Preview ライブ同期）は Non-Goal — dirty ゲート（TC-005–009）で整合を担保

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-001 | Happy | default-raw-open | P0 | Custom Editor で保存済み `.md` を開く（セッション永続モードなし） | `DEFAULT_EDITOR_MODE === 'raw'`。初期 `editorMode` / `body[data-mode]` / 三点 toolbar `active` が `raw`。表示ラベル Edit Raw Text | 初期面が Raw であること | §1 正常系 1, AD-016 |
| TC-002 | Happy | mode-round-trip | P0 | mode-toolbar 三点で `preview` → `markdown` → `raw` → `preview` を往復（内容未変更） | 各 mode id へ切替成功。`body[data-mode]` / toolbar `active` が一致。ディスク書込なし・dirty 不変 | モード切替バグ回帰（P0） | §1 受け入れ |
| TC-003 | Happy | default-preview-non-mode | P0 | `#mode-toolbar` 内 Default Preview ボタンを検査し、任意の三点面で押下 | 左から `Default Preview` \| `Editor Preview` \| `Edit Rich Editor` \| `Edit Raw Text`。文言 `Default Preview`。`data-action="native-preview"`・**`data-mode` なし**。セパレータ必須ではない。押下後 `editorMode` / `body[data-mode]` / 三点 `active` 不変 | 第4モード化防止・面不変・表示ラベル | §1 mode-toolbar Default Preview |
| TC-004 | Happy | default-preview-clean | P0 | Document clean で Default Preview 押下（または同等 Host コマンド） | ダイアログなし。`markdown.showPreview` が対象 URI で 1 回実行。**`showPreviewToSide` 非実行**。現在面不変。Preview は同一 editor group（Beside 新規グループなし） | clean 即オープン + 同 group | §1 Outputs, §10 |
| TC-005 | Happy | default-preview-dirty-save | P0 | Document dirty で Default Preview → ダイアログで **Save**（save 成功） | Save/Cancel 二択のみ（Don't Save なし）。警告文言に `to the side` を含めない。save 成功後のみ `showPreview`（+ 同一グループ補償）。dirty 解除 | 保存成功ゲート | §8 正常系 8 |
| TC-006 | Corner | default-preview-dirty-cancel | P0 | Document dirty で Default Preview → **Cancel** | `showPreview` 非実行。`showPreviewToSide` も非実行。Document / dirty 不変。現在面不変 | Cancel で開かない | §8 |
| TC-007 | Happy | command-registration | P0 | `activate` 後 `getCommands` と `package.json` contributes | 正本 `md-wysiwyg-editor.showNativeMarkdownPreview` 登録。製品内別名 `md-wysiwyg-editor.showNativeMarkdownPreviewToSide` は同一ハンドラとして登録（AD-004）。旧プレフィックス `vsc-md-editor.showNativeMarkdownPreview*` は **未登録**。Command Palette 実行可（正本 ID）。command title に Side 表現なし。Default Preview 用 editor/title アイコンは **無い** | コマンド契約 + 製品内別名 + 旧プレフィックス非互換 + Non-Goal アイコン | §10 正常系 7 / `rename-md-wysiwyg` |
| TC-008 | Corner | default-preview-dialog-dismiss | P1 | Document dirty で Default Preview → ダイアログを閉じる（Esc / 閉じる） | Cancel と同様プレビュー非オープン。`showPreview` / `showPreviewToSide` 非実行。dirty 不変 | 閉じる＝開かない | §8 |
| TC-009 | Corner | default-preview-save-fail | P1 | Document dirty → Save 選択だが save 失敗（stringify 失敗 mock） | ErrorMessage + Output（`MD WYSIWYG Editor`）。`showPreview` 非実行。dirty 維持可 | save 失敗で開かない | §1 Outputs, §8 |
| TC-010 | Corner | default-preview-raw-parse-block | P1 | `isRawParseFailed=true` の dirty Document で Default Preview → Save | save ブロック契約を尊重しプレビュー非オープン。ErrorMessage / Output | Raw 失敗中ゲート | §1 Outputs, §8 例外系 2 |
| TC-011 | Corner | default-preview-uri-unresolved | P1 | アクティブ WYSIWYG URI が解決不能な状態でコマンド実行 | Warning（`Open a Markdown file first` 相当）。`showPreview` 非実行 | URI 解決失敗 | §1 Outputs |
| TC-012 | Structural | pattern-a-non-interference | P0 | WYSIWYG Custom Editor 表示中に Default Preview で標準 Preview を同一グループに開く | Custom Editor は dispose されない。Pattern A（ビルトイン Text 切替）誤検知なし。`openWith` / Reopen の代替にならない。Preview タブ種別（`TabInputWebview` 等）を Pattern A から除外 | Pattern A 非干渉 | §10 正常系 4 Default Preview |
| TC-013 | Structural | marp-non-interference | P1 | Marp 文書で §6 Marp パネル表示中に Default Preview 実行 | Marp パネルは閉じない・自動オープンしない。三点 Preview 内 Marp 分岐は不変。標準 Preview はスライド UI にならない | Marp 共存 | §10 |
| TC-014 | Happy | webview-postmessage-only | P1 | Default Preview クリック時の Webview 送信を観測 | `openNativePreview` 系 postMessage のみ（旧 `openNativePreviewToSide` 名は使わない）。Webview から VS Code API / `markdown.showPreview*` を直接呼ばない | Host 単一ゲート | §1 Inputs |
| TC-015 | Corner | no-fourth-mode-id | P1 | `EditorMode` 型・`applyMode` / `setMode` 対象・`body[data-mode]` 許容値を検査 | 許容は `preview` \| `markdown` \| `raw` のみ。`native-preview` 等の第4 id なし。Default Preview は `applyMode` 非経由 | Explicit Out | §1 Non-Goals |
| TC-016 | Boundary | default-preview-empty-clean | P1 | 空（0 B 相当）の clean `.md` で Default Preview | ダイアログなしで `showPreview` 成功（内容空でも clean 契約）。同 group 配置 | 空ファイル境界 | §1 Inputs fileContent min |
| TC-017 | Corner | show-preview-command-missing | P1 | `markdown.showPreview` 失敗 / 欠如を mock | ErrorMessage + Output。プレビュー非オープン。現在面不変。**`markdown.showPreviewToSide` は呼ばれない**（フォールバック禁止） | ホスト差・欠如・Beside 非フォールバック | §10, Non-Goals |
| TC-018 | Happy | default-preview-a11y-labels | P1 | Default Preview ボタンの文言 / `title` / `aria-label`。三点モードの表示ラベル | 文言 `Default Preview`。`title`/`aria-label` は `Open Default Markdown Preview`（**`to the Side` を含めない**）。mode id `preview` の表示は `Editor Preview` | ラベル契約 | §1 mode-toolbar |
| TC-019 | Corner | no-dont-save-option | P1 | dirty 時 Default Preview の `showWarningMessage` 選択肢と文言を列挙 | **Save** と **Cancel** のみ。Don't Save なし。文言は `Document has unsaved changes. Save before opening the Markdown Preview?`（`to the side` なし） | Don't Save Out + Side 文言除去 | §8 Non-Goals |
| TC-020 | Happy | mode-switch-still-no-io | P1 | TC-002 往復中に FS write / dirty を監視（内容未変更） | モード切替 alone でディスク書込なし（既存 TC-073 と同契約の回帰） | 切替≠保存 | §1 正常系 4, §8 正常系 7 |
| TC-021 | Happy | same-group-move-compensation | P0 | Custom Editor フォーカス（`activeTextEditor === undefined` 想定）で clean Default Preview。open 前 group / activeIndex を記録し、open 後の `moveActiveEditor`（または同等の安定 API）を観測 | `markdown.showPreview` 1 回。**必須:** Preview が記録した同一 `viewColumn` / editor group に存在する（Beside 新規グループなし）。**推奨観測:** `moveActiveEditor` が group `position`=viewColumn と tab preferred（1-based `activeIndex+2`）で呼ばれる（exact index 不可時は同 group 内配置で Pass）。`showTextDocument` による `activeTextEditor` 捏造なし。`showPreviewToSide` 非実行 | 同一グループ補償の可観測契約（RK-018/019） | §10 正常系 7 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-001–005, TC-007, TC-014, TC-018, TC-020, TC-021 | — |
| Boundary | TC-016 | — |
| Structural | TC-012, TC-013, TC-015 | — |
| Corner | TC-006, TC-008–011, TC-017, TC-019 | — |
| Stress | — | UI/コマンド契約。大ファイル Stress は既存 TC-065/066 |

### Complexity Notes

- 制約: VS Code Extension Host + Webview postMessage + `moveActiveEditor`（安定 API）
- 想定: O(1) ハンドラ。P2 なし
- HTTP API / Worker ドメイン: N/A（ローカル拡張）

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR） | `test_single`: `npm run test:unit -- --grep 'native-preview\|TC-00[1-9]\|TC-0[12][0-9]'` 等 |
| P2 | — | 本 testspec に P2 なし |
| 統合 | `npm run test:integration` | Pattern A / 実 Preview タブ / 同一 group 配置は可能な範囲で integration。ユニットは mock（`executeCommand` / `moveActiveEditor`）可 |

想定配置: `src/test/suite/unit/native-preview-side-and-default-raw.test.ts`（`.cursor/stack.md` `test_file_glob`）

---

## Trace Results

### TC-001 (P0): 初期 Raw オープン

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 保存済み `sample.md` を Custom Editor で開く | viewType `md-wysiwyg-editor.wysiwyg` |
| 1 | 定数 / Host 初期 mode | `DEFAULT_EDITOR_MODE === 'raw'` |
| 2 | Webview 初期 HTML | `body[data-mode="raw"]`、Raw ボタン `active` |
| Output | 初期面 | Edit Raw Text / mode id `raw` |

**Result:** ✅ Pass（2026-09-06 unit — 契約不変）

---

### TC-002 (P0): 三点往復

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 初期 `raw` | — |
| 1 | Preview ボタン | `editorMode === 'preview'` |
| 2 | Edit Rich Editor | `editorMode === 'markdown'` |
| 3 | Edit Raw Text | `editorMode === 'raw'` |
| 4 | 再度 Preview | `editorMode === 'preview'` |
| Output | 往復成功・ディスク未書込 | dirty 不変 |

**Result:** ✅ Pass（2026-09-06 unit — 契約不変）

---

### TC-003 (P0): Default Preview 非モード

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `#mode-toolbar` DOM + 押下前 `editorMode` | 例: `markdown` |
| 1 | 属性 | `data-action="native-preview"`、`data-mode` なし |
| 2 | 文言 | `Default Preview`（先頭ボタン） |
| 3 | 押下 | `openNativePreview` postMessage のみ |
| Output | 面 | `editorMode` / `active` 不変 |

**Result:** ✅ Pass（2026-09-06 unit — `data-action=native-preview` / 非モード契約）

---

### TC-004 (P0): clean 即オープン

| Step | State / Action | Value |
|------|----------------|-------|
| Input | dirty=false | URI 解決済 |
| 1 | Default Preview | ダイアログなし |
| Output | `markdown.showPreview(uri)` 1 回。同 group。`showPreviewToSide` なし | — |

**Result:** ✅ Pass（2026-09-06 unit — `showPreview` + 同一グループ補償）

---

### TC-005 (P0): dirty→Save→オープン

| Step | State / Action | Value |
|------|----------------|-------|
| Input | dirty=true | — |
| 1 | ダイアログ | Save / Cancel のみ。Side 文言なし |
| 2 | Save | Custom Editor save 成功 |
| Output | `showPreview` + 同一グループ補償 | save 成功後のみ |

**Result:** ✅ Pass（2026-09-06 unit — dirty ゲート + same-group）

---

### TC-006 (P0): dirty→Cancel

| Step | State / Action | Value |
|------|----------------|-------|
| Input | dirty=true | Cancel |
| Output | `showPreview` / `showPreviewToSide` 非実行 | dirty 維持 |

**Result:** ✅ Pass（2026-09-06 unit）

---

### TC-007 (P0): コマンド登録

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `activate` | — |
| Output | 正本 `md-wysiwyg-editor.showNativeMarkdownPreview` + 製品内別名 `…ToSide`（新プレフィックス）。旧 `vsc-md-editor.*` 未登録 | editor/title Default Preview アイコンなし |

**Result:** ✅ Pass（2026-09-29 unit）— `md-wysiwyg-editor.showNativeMarkdownPreview*` 登録・旧プレフィックス未登録。`native-preview-side-and-default-raw.test.ts` TC-007

---

### TC-008 (P1): ダイアログ閉じる

| Step | State / Action | Value |
|------|----------------|-------|
| Input | dirty=true → ダイアログ閉じる | — |
| Output | `showPreview` なし | dirty 不変 |

**Result:** ✅ Pass（2026-09-06 unit）

---

### TC-009 (P1): save 失敗

| Step | State / Action | Value |
|------|----------------|-------|
| Input | dirty → Save → stringify 失敗 | — |
| Output | Error + Output | プレビュー非オープン |

**Result:** ✅ Pass（2026-09-06 unit）

---

### TC-010 (P1): Raw パース失敗中

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `isRawParseFailed=true` → Default Preview → Save | — |
| Output | save 拒否・プレビュー非オープン | §8 契約 |

**Result:** ✅ Pass（2026-09-06 unit）

---

### TC-011 (P1): URI 未解決

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 解決不能 | — |
| Output | Warning | プレビュー非オープン |

**Result:** ✅ Pass（2026-09-06 unit）

---

### TC-012 (P0): Pattern A 非干渉

| Step | State / Action | Value |
|------|----------------|-------|
| Input | WYSIWYG 表示中 Default Preview | 標準 Preview を同 group に追加 |
| Output | Custom Editor 存続 | Pattern A 誤検知なし |

**Result:** ✅ Pass（2026-09-06 unit — guard / 非 dispose 契約）

---

### TC-021 (P0): 同一グループ補償

| Step | State / Action | Value |
|------|----------------|-------|
| Input | Custom Editor フォーカス・clean | `activeTextEditor === undefined` |
| 1 | open 前 | `viewColumn` / `activeIndex` 記録 |
| 2 | `markdown.showPreview(uri)` | 1 回 |
| 3 | open 後 | `moveActiveEditor`（group + preferred tab; `activeIndex+1` best-effort） |
| Output | Preview が同一 editor group | Beside なし・ToSide なし・`showTextDocument` 捏造なし |

**Result:** ✅ Pass（2026-09-06 unit — `moveActiveEditor` 安定 API）

---

### TC-013–020 (P1): 机上要約

| ID | Priority | Expected summary |
|----|----------|------------------|
| TC-013 | P1 | Marp パネル非干渉（契約維持） |
| TC-014 | P1 | Webview は `openNativePreview` のみ |
| TC-015 | P1 | 第4 mode id なし |
| TC-016 | P1 | 空 clean でも `showPreview` 即オープン |
| TC-017 | P1 | `showPreview` 失敗明示・**ToSide フォールバックなし** |
| TC-018 | P1 | title / aria に Side 表現なし |
| TC-019 | P1 | Don't Save なし・警告から Side 除去 |
| TC-020 | P1 | モード切替 alone は I/O なし |

**Result:** TC-013–020 ✅ Pass（2026-09-06 unit）

### Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-001–021 | P0/P1 | ✅ Pass | unit suite green（`moveActiveEditor` 同一グループ補償含む） |
| TC-070（wysiwyg） | P0 | 初期 raw 期待は既存 | 本タスク対象外 |

---

## Self-Check Report

### A. Input & Constraints

- [x] **最小値 / 空の入力:** TC-016（空 clean `.md`）
- [x] **最大値 / オーバーフロー:** N/A — 本機能はサイズ上限を新設しない（既存 TC-008）
- [x] **符号・型:** mode id 列挙・dirty boolean・URI・viewColumn/index。第4 id 禁止は TC-015

### B. Structural Patterns

- [x] **全要素同一 / 偏り:** N/A — 配列/木構造非該当
- [x] **順序・ソート:** N/A（タブ index preferred は TC-021 best-effort）
- [x] **非連結・サイクル:** N/A。構造は mode-toolbar 配置（TC-003）・Pattern A / Marp 共存（TC-012/013）・同 group 配置（TC-021）

### C. Corner & Failure

- [x] **解が存在しない場合:** URI 不能（TC-011）、save 失敗（TC-009）、コマンド欠如（TC-017 + ToSide 非フォールバック）、Cancel/閉じる（TC-006/008）
- [x] **先頭・末尾のアクセス:** N/A — 索引探索非該当。三点往復の端点は TC-002。タブ隣接は TC-021 best-effort

### D. Complexity & Resources

- [x] **時間計算量:** N/A（O(1) ハンドラ）
- [x] **スタック深度:** N/A

### E. API / Worker（該当時）

- [x] **HTTP ステータス:** N/A — VS Code 拡張（ローカル）
- [x] **認証・認可:** N/A
- [x] **外部依存失敗:** `markdown.showPreview` 失敗（TC-017）。Beside フォールバック禁止を明示
- [x] **空 body / 不正 JSON:** N/A — postMessage 型は実装時ガード。不正 payload は Host 無視想定で専用 TC は非必須

### Uncovered / Spec Gaps

- 隣接 index 厳密保証は Non-Goal（TC-021 は同 group 必須 + preferred move 観測）
- Preview シングルトン再利用で「毎回新規タブ」にならない場合は同 group 成功で Pass（RK-018）
- 未保存バッファの標準 Preview ライブ同期は Non-Goal（dirty ゲートで担保）
- 同一グループ補償の安定 API は `moveActiveEditor`（public TabGroups に tab move なし）

### AD-* Traceability（`native-preview-side-and-default-raw` 継承 + `default-preview-same-tab-group`）

| AD（same-tab-group） | TC |
|----------------------|-----|
| AD-001 一次 API `showPreview` | TC-004, TC-005, TC-016, TC-021 |
| AD-002 Host 同一グループ補償 | TC-004, TC-021 |
| AD-003 同 group 必須 / 隣接 best-effort | TC-021（+ TC-004 同 group） |
| AD-004 ToSide フォールバック禁止 | TC-017（+ 成功パス TC-004/005 で ToSide 非実行） |
| AD-005 コマンド ID + 製品内別名（新プレフィックス） | TC-007（`rename-md-wysiwyg` で ID 同期） |
| AD-006 表示文言・Side 除去 | TC-018, TC-019 |
| AD-007 `data-action` / `openNativePreview` | TC-003, TC-014 |
| AD-008 非機能据え置き | TC-003, TC-005–006, TC-012–013, TC-015, TC-019 |
| AD-009 testspec 波及 | 本ファイル |
| AD-010 実装境界 | N/A（build） |

継承（初期 Raw / 三点 / dirty ゲート等）: TC-001–002, TC-005–011, TC-015, TC-020

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-05 | 初版。AD-001–014 / §1・§8・§10 に対応する TC-001–020。初期 Raw・Side Preview 非モード・dirty Save/Cancel・三点往復・Pattern A / Marp 非干渉 | `native-preview-side-and-default-raw` |
| 2026-09-05 | Trace: ユニット実装（TDD Red）。`native-preview-side-and-default-raw.test.ts` + TC-070 初期 raw 期待更新 | `native-preview-side-and-default-raw` |
| 2026-09-05 | 表示ラベルを Default Preview / Editor Preview に整合。ボタン順・セパレータ任意・a11y title 更新（`toolbar-default-editor-preview-labels`） | `toolbar-default-editor-preview-labels` |
| 2026-09-06 | `default-preview-same-tab-group`: 一次 API を `markdown.showPreview` に置換。同一 editor group + preferred `activeIndex+1` move 補償を TC-021（P0）追加。TC-004/005/017 等で ToSide フォールバック禁止。コマンド正本 `showNativeMarkdownPreview` + 旧 `…ToSide` エイリアス（TC-007）。`data-action=native-preview` / `openNativePreview` / title・aria・dirty 警告から Side 表現除去（TC-003/014/018/019）。dirty Save/Cancel・非モード・Pattern A / Marp は Expected のみ更新。テストコードは未実装（次フェーズ） | `default-preview-same-tab-group` |
| 2026-09-06 | testspec-implementation（Red）: `native-preview-side-and-default-raw.test.ts` を Expected 更新。TC-021 追加。Trace: 7 Pass / 16 Fail | `default-preview-same-tab-group` |
| 2026-09-06 | Critical 修正: 同一グループ補償を `moveActiveEditor` に置換（非公開 `tabGroups.move` 廃止）。TC-021 mock / Trace Results 全 Pass | `default-preview-same-tab-group` |
| 2026-09-19 | パス移設（`doc/test/`）。契約内容不変 |
| 2026-09-29 | **BREAKING** `rename-md-wysiwyg`: 貢献 ID を `md-wysiwyg-editor.*` に同期（viewType / 正本コマンド / 製品内 `…ToSide` 別名）。旧 `vsc-md-editor.*` は未登録を Expected に明記（AD-002/004）。テストコード未変更（design only） | `rename-md-wysiwyg` |
| 2026-09-29 | testspec-implementation（Red）: TC-007 期待を `md-wysiwyg-editor.*` + 旧プレフィックス未登録にコード化。Trace Red | `rename-md-wysiwyg` |
| 2026-09-29 | Trace Results: TC-007 を Pass に同期（Quality Gate green 後。Expected 不変） | `rename-md-wysiwyg` |
