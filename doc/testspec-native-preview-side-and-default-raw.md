# Test Specification: native-preview-side-and-default-raw

## 概要

- **対象:** 初期 `editorMode` を Raw に変更、mode-toolbar の非モード **Side Preview**（標準 Markdown Preview を横に開く）、dirty Save/Cancel ゲート、三点モード往復回帰、Pattern A / Marp 非干渉
- **対応仕様:** [doc/systemspec.md](systemspec.md) §1（初期 Raw・Side Preview・三点往復）、§8（dirty Save/Cancel ゲート）、§10（`showNativeMarkdownPreviewToSide`・Pattern A 非干渉・Marp 非干渉）、アーキテクチャ AD-016
- **Requirements Brief:** `temporary/requirements-brief-native-preview-side-and-default-raw.md`（AD-001–014）
- **テストコード:** `src/test/suite/unit/native-preview-side-and-default-raw.test.ts`（mocha + vscode mock）。関連回帰は既存三点モード suite と併用可
- **作成日:** 2026-09-05
- **関連:** [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) TC-070–084（三点・Pattern A）。本機能の検証正本は本ファイル。TC-070 の初期モード期待は本タスクで `raw` へ整合

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| `DEFAULT_EDITOR_MODE` | `'raw'`（定数） | — | — | オープン時の初期 mode id（AD-001 / AD-016） |
| `editorMode` | `"preview" \| "markdown" \| "raw"` | — | — | 第 4 mode id なし（AD-002） |
| `modeSwitchCommand` / mode-toolbar 三点 | UI / postMessage | — | — | `data-mode` のみ。ディスク I/O なし |
| Side Preview ボタン | DOM | — | — | `data-action="native-preview-to-side"`（または同等）。**`data-mode` なし**（AD-004） |
| `openNativePreviewToSide` | Webview → Host postMessage | — | — | dirty/save/コマンドは Host のみ（AD-009） |
| Document `dirty` | `boolean` | — | — | dirty 時のみ Save/Cancel ダイアログ（AD-006） |
| Save / Cancel 選択 | ダイアログ | — | — | Don't Save 選択肢なし（AD-006） |
| 対象 URI | `vscode.Uri` | — | — | アクティブ WYSIWYG `TabInputCustom.uri`（AD-008） |
| コマンド ID | `vsc-md-editor.showNativeMarkdownPreviewToSide` | — | — | Palette + Webview（AD-003） |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 仕様根拠 |
|------|-------------------|---------|
| オープン成功 | 初期 `editorMode === "raw"`、`body[data-mode="raw"]`、Raw 三点ボタン `active`、表示ラベル Edit Raw Text | §1 Outputs, AD-001 |
| 三点往復成功 | `preview` ↔ `markdown` ↔ `raw` が mode-toolbar で切替可。Document / ディスク不変（内容未変更時） | §1 受け入れ P0, AD-012 |
| Side Preview・clean | 現在面不変のまま `markdown.showPreviewToSide` 実行。ダイアログなし | §1 Outputs, §10 |
| Side Preview・dirty→Save 成功 | save 成功後のみ `markdown.showPreviewToSide`。dirty 解除 | §8 正常系 8, AD-007 |
| Side Preview・dirty→Cancel / 閉じる | プレビュー非オープン。Document / dirty 不変 | §8, AD-006 |
| Side Preview・save 失敗 / Raw パース失敗中 | ErrorMessage + Output、プレビュー非オープン | §1 Outputs, §8 |
| URI 解決不能 | Warning（`Open a Markdown file first` 相当）、プレビュー非オープン | §1 Outputs, AD-008 |
| `showPreviewToSide` 失敗 | ErrorMessage + Output、プレビュー非オープン | §10 |
| Pattern A | Side Preview オープンで `isBuiltinSwitchToSameMdFile` 相当の誤検知なし。Custom Editor dispose しない | §10, AD-010 |
| Marp | Side Preview で §6 パネルを閉じない・自動オープンしない | §10, AD-011 |

### Preconditions & Assumptions

- Custom Editor viewType `vsc-md-editor.wysiwyg` で `.md` を開いていること
- ビルトイン Markdown 拡張が `markdown.showPreviewToSide` を提供する環境（欠如時は失敗パス）
- セッション永続モードは新設しない（ハードコード既定のみ）
- 統合テストは Extension Development Host（AD-012 既存方針）

### Complexity Budget

- UI / Host コマンド契約が主。アルゴリズム計算量 N/A
- P2 Stress: 本機能では不要（大ファイルは既存 TC-008 / TC-066）

### Spec Gaps

- なし（UD-002/003・AD-001–014 は Requirements Brief / systemspec に反映済み）
- **既存 TC 整合:** [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) TC-070 および Spec Digest の初期 `"markdown"` は本タスクで `raw` へ更新する（RK-006）
- AD-013（未保存バッファの標準 Preview ライブ同期）は Non-Goal — 専用「同期しない」観測 TC は設けず、dirty ゲート（TC-005–009）で整合を担保
- AD-014 は仕様波及作業でありテスト対象外

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-001 | Happy | default-raw-open | P0 | Custom Editor で保存済み `.md` を開く（セッション永続モードなし） | `DEFAULT_EDITOR_MODE === 'raw'`。初期 `editorMode` / `body[data-mode]` / 三点 toolbar `active` が `raw`。表示ラベル Edit Raw Text | 初期面が Raw であること | §1 正常系 1, AD-001, AD-016 |
| TC-002 | Happy | mode-round-trip | P0 | mode-toolbar 三点で `preview` → `markdown` → `raw` → `preview` を往復（内容未変更） | 各 mode id へ切替成功。`body[data-mode]` / toolbar `active` が一致。ディスク書込なし・dirty 不変 | モード切替バグ回帰（P0） | §1 受け入れ, AD-012 |
| TC-003 | Happy | side-preview-non-mode | P0 | `#mode-toolbar` 内 Side Preview ボタンを検査し、任意の三点面で押下 | 三点の右にセパレータ + ボタン。文言 `Side Preview`。`data-action` あり・**`data-mode` なし**。押下後 `editorMode` / `body[data-mode]` / 三点 `active` 不変 | 第4モード化防止・面不変 | §1 mode-toolbar Side Preview, AD-002, AD-004, AD-005 |
| TC-004 | Happy | side-preview-clean | P0 | Document clean で Side Preview 押下（または同等 Host コマンド） | ダイアログなし。`markdown.showPreviewToSide` が対象 URI で 1 回実行。現在面不変 | clean 即オープン | §1 Outputs, §10, AD-006 |
| TC-005 | Happy | side-preview-dirty-save | P0 | Document dirty で Side Preview → ダイアログで **Save**（save 成功） | Save/Cancel 二択のみ（Don't Save なし）。save 成功後のみ `showPreviewToSide`。dirty 解除 | 保存成功ゲート | §8 正常系 8, AD-006, AD-007 |
| TC-006 | Corner | side-preview-dirty-cancel | P0 | Document dirty で Side Preview → **Cancel** | `showPreviewToSide` 非実行。Document / dirty 不変。現在面不変 | Cancel で開かない | §8, AD-006 |
| TC-007 | Happy | command-registration | P0 | `activate` 後 `getCommands` と `package.json` contributes | `vsc-md-editor.showNativeMarkdownPreviewToSide` 登録。Command Palette 実行可。Side Preview 用 editor/title アイコンは **無い** | コマンド契約 + Non-Goal アイコン | §10 正常系 7, AD-003 |
| TC-008 | Corner | side-preview-dialog-dismiss | P1 | Document dirty で Side Preview → ダイアログを閉じる（Esc / 閉じる） | Cancel と同様プレビュー非オープン。dirty 不変 | 閉じる＝開かない | §8, AD-006 |
| TC-009 | Corner | side-preview-save-fail | P1 | Document dirty → Save 選択だが save 失敗（stringify 失敗 mock） | ErrorMessage + Output（`MD WYSIWYG Editor`）。`showPreviewToSide` 非実行。dirty 維持可 | save 失敗で開かない | §1 Outputs, §8, AD-007 |
| TC-010 | Corner | side-preview-raw-parse-block | P1 | `isRawParseFailed=true` の dirty Document で Side Preview → Save | save ブロック契約を尊重しプレビュー非オープン。ErrorMessage / Output | Raw 失敗中ゲート | §1 Outputs, §8 例外系 2 |
| TC-011 | Corner | side-preview-uri-unresolved | P1 | アクティブ WYSIWYG URI が解決不能な状態でコマンド実行 | Warning（`Open a Markdown file first` 相当）。`showPreviewToSide` 非実行 | URI 解決失敗 | §1 Outputs, AD-008 |
| TC-012 | Structural | pattern-a-non-interference | P0 | WYSIWYG Custom Editor 表示中に Side Preview で標準 Preview を横に開く | Custom Editor は dispose されない。Pattern A（ビルトイン Text 切替）誤検知なし。`openWith` / Reopen の代替にならない | Pattern A 非干渉 | §10 正常系 4 Side Preview, AD-010 |
| TC-013 | Structural | marp-non-interference | P1 | Marp 文書で §6 Marp パネル表示中に Side Preview 実行 | Marp パネルは閉じない・自動オープンしない。三点 Preview 内 Marp 分岐は不変。標準 Preview はスライド UI にならない | Marp 共存 | §10, AD-011 |
| TC-014 | Happy | webview-postmessage-only | P1 | Side Preview クリック時の Webview 送信を観測 | `openNativePreviewToSide` 系 postMessage のみ。Webview から VS Code API / `showPreviewToSide` を直接呼ばない | Host 単一ゲート | §1 Inputs, AD-009 |
| TC-015 | Corner | no-fourth-mode-id | P1 | `EditorMode` 型・`applyMode` / `setMode` 対象・`body[data-mode]` 許容値を検査 | 許容は `preview` \| `markdown` \| `raw` のみ。`native-preview` 等の第4 id なし。Side Preview は `applyMode` 非経由 | Explicit Out | §1 Non-Goals, AD-002, UD-003 |
| TC-016 | Boundary | side-preview-empty-clean | P1 | 空（0 B 相当）の clean `.md` で Side Preview | ダイアログなしで `showPreviewToSide` 成功（内容空でも clean 契約） | 空ファイル境界 | §1 Inputs fileContent min |
| TC-017 | Corner | show-preview-command-missing | P1 | `markdown.showPreviewToSide` 失敗 / 欠如を mock | ErrorMessage + Output。プレビュー非オープン。現在面不変 | ホスト差・欠如（RK-003） | §10 |
| TC-018 | Happy | side-preview-a11y-labels | P1 | Side Preview ボタンの `title` / `aria-label` | ともに `Open VS Code Markdown Preview to the Side` | ラベル契約 | §1 mode-toolbar, AD-005 |
| TC-019 | Corner | no-dont-save-option | P1 | dirty 時 Side Preview の `showWarningMessage` 選択肢を列挙 | **Save** と **Cancel** のみ。Don't Save / 未保存のまま開く選択肢なし | UD-002 B | §8 Non-Goals, AD-006 |
| TC-020 | Happy | mode-switch-still-no-io | P1 | TC-002 往復中に FS write / dirty を監視（内容未変更） | モード切替 alone でディスク書込なし（既存 TC-073 と同契約の回帰） | 切替≠保存 | §1 正常系 4, §8 正常系 7 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-001–005, TC-007, TC-014, TC-018, TC-020 | — |
| Boundary | TC-016 | — |
| Structural | TC-012, TC-013, TC-015 | — |
| Corner | TC-006, TC-008–011, TC-017, TC-019 | — |
| Stress | — | UI/コマンド契約。大ファイル Stress は既存 TC-065/066 |

### Complexity Notes

- 制約: VS Code Extension Host + Webview postMessage
- 想定: O(1) ハンドラ。P2 なし
- HTTP API / Worker ドメイン: N/A（ローカル拡張）

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | `npm run test:unit`（通常 PR） | `test_single`: `npm run test:unit -- --grep 'native-preview\|TC-00[1-9]\|TC-0[12][0-9]'` 等 |
| P2 | — | 本 testspec に P2 なし |
| 統合 | `npm run test:integration` | Pattern A / 実 Preview タブは可能な範囲で integration。ユニットは mock 可 |

想定配置: `src/test/suite/unit/native-preview-side-and-default-raw.test.ts`（`doc/stack.md` `test_file_glob`）

---

## Trace Results

### TC-001 (P0): 初期 Raw オープン

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 保存済み `sample.md` を Custom Editor で開く | viewType `vsc-md-editor.wysiwyg` |
| 1 | 定数 / Host 初期 mode | `DEFAULT_EDITOR_MODE === 'raw'` |
| 2 | Webview 初期 HTML | `body[data-mode="raw"]`、Raw ボタン `active` |
| Output | 初期面 | Edit Raw Text / mode id `raw` |

**Result:** ❌ Fail（2026-09-05）— `DEFAULT_EDITOR_MODE` がまだ `'markdown'`。ユニット実装済・TDD Red

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

**Result:** ✅ Pass（既存 `EditorModeState` 往復。初期 raw は TC-001）

---

### TC-003 (P0): Side Preview 非モード

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `#mode-toolbar` DOM + 押下前 `editorMode` | 例: `markdown` |
| 1 | 属性 | `data-action` あり、`data-mode` なし |
| 2 | 押下 | postMessage のみ |
| Output | 面 | `editorMode` / `active` 不変 |

**Result:** ❌ Fail（2026-09-05）— Side Preview ボタン未追加

---

### TC-004 (P0): clean 即オープン

| Step | State / Action | Value |
|------|----------------|-------|
| Input | dirty=false | URI 解決済 |
| 1 | Side Preview | ダイアログなし |
| Output | `markdown.showPreviewToSide(uri)` | 1 回 |

**Result:** ❌ Fail（2026-09-05）— `src/commands/native-markdown-preview.ts` 未実装

---

### TC-005 (P0): dirty→Save→オープン

| Step | State / Action | Value |
|------|----------------|-------|
| Input | dirty=true | — |
| 1 | ダイアログ | Save / Cancel のみ |
| 2 | Save | Custom Editor save 成功 |
| Output | `showPreviewToSide` | save 成功後のみ |

**Result:** ❌ Fail（2026-09-05）— Host コマンド未実装

---

### TC-006 (P0): dirty→Cancel

| Step | State / Action | Value |
|------|----------------|-------|
| Input | dirty=true | Cancel |
| Output | プレビュー非オープン | dirty 維持 |

**Result:** ❌ Fail（2026-09-05）— Host コマンド未実装

---

### TC-007 (P0): コマンド登録

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `activate` | — |
| Output | `vsc-md-editor.showNativeMarkdownPreviewToSide` 存在 | editor/title Side Preview アイコンなし |

**Result:** ❌ Fail（2026-09-05）— package.json / extension 未登録

---

### TC-008 (P1): ダイアログ閉じる

| Step | State / Action | Value |
|------|----------------|-------|
| Input | dirty=true → ダイアログ閉じる | — |
| Output | `showPreviewToSide` なし | dirty 不変 |

**Result:** ❌ Fail（2026-09-05）— Host コマンド未実装

---

### TC-009 (P1): save 失敗

| Step | State / Action | Value |
|------|----------------|-------|
| Input | dirty → Save → stringify 失敗 | — |
| Output | Error + Output | プレビュー非オープン |

**Result:** ❌ Fail（2026-09-05）— Host コマンド未実装

---

### TC-010 (P1): Raw パース失敗中

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `isRawParseFailed=true` → Side Preview → Save | — |
| Output | save 拒否・プレビュー非オープン | §8 契約 |

**Result:** ❌ Fail（2026-09-05）— Host コマンド未実装

---

### TC-011 (P1): URI 未解決

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 解決不能 | — |
| Output | Warning | プレビュー非オープン |

**Result:** ❌ Fail（2026-09-05）— Host コマンド未実装

---

### TC-012 (P0): Pattern A 非干渉

| Step | State / Action | Value |
|------|----------------|-------|
| Input | WYSIWYG 表示中 Side Preview | 標準 Preview タブ追加 |
| Output | Custom Editor 存続 | Pattern A 誤検知なし |

**Result:** ❌ Fail（2026-09-05）— Side Preview コマンド未実装 / Pattern A Preview 除外未整備

---

### TC-013–020 (P1): 机上要約

| ID | Priority | Expected summary |
|----|----------|------------------|
| TC-013 | P1 | Marp パネル非干渉 |
| TC-014 | P1 | Webview は postMessage のみ |
| TC-015 | P1 | 第4 mode id なし |
| TC-016 | P1 | 空 clean でも即オープン |
| TC-017 | P1 | `showPreviewToSide` 失敗明示 |
| TC-018 | P1 | title / aria-label 一致 |
| TC-019 | P1 | Don't Save なし |
| TC-020 | P1 | モード切替 alone は I/O なし |

**Result:** ❌/✅ 混在（2026-09-05）— TC-015 / TC-020 は既存契約で Pass 見込み。TC-013–014, 016–019 は Red

### Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-001–007, TC-012 | P0 | ❌ Red | `src/test/suite/unit/native-preview-side-and-default-raw.test.ts` |
| TC-002, TC-015, TC-020 | P0/P1 | ✅ 一部 Pass | 既存三点モード util |
| TC-008–011, TC-013–014, TC-016–019 | P1 | ❌ Red | Host / Webview 未実装 |
| TC-070（wysiwyg） | P0 | ❌ Red | 初期 raw 期待へ更新 |

---

## Self-Check Report

### A. Input & Constraints

- [x] **最小値 / 空の入力:** TC-016（空 clean `.md`）
- [x] **最大値 / オーバーフロー:** N/A — 本機能はサイズ上限を新設しない（既存 TC-008）
- [x] **符号・型:** mode id 列挙・dirty boolean・URI。第4 id 禁止は TC-015

### B. Structural Patterns

- [x] **全要素同一 / 偏り:** N/A — 配列/木構造非該当
- [x] **順序・ソート:** N/A
- [x] **非連結・サイクル:** N/A。構造は mode-toolbar 配置（TC-003）・Pattern A / Marp 共存（TC-012/013）

### C. Corner & Failure

- [x] **解が存在しない場合:** URI 不能（TC-011）、save 失敗（TC-009）、コマンド欠如（TC-017）、Cancel/閉じる（TC-006/008）
- [x] **先頭・末尾のアクセス:** N/A — 索引探索非該当。三点往復の端点は TC-002

### D. Complexity & Resources

- [x] **時間計算量:** N/A（O(1) ハンドラ）
- [x] **スタック深度:** N/A

### E. API / Worker（該当時）

- [x] **HTTP ステータス:** N/A — VS Code 拡張（ローカル）
- [x] **認証・認可:** N/A
- [x] **外部依存失敗:** `markdown.showPreviewToSide` 失敗（TC-017）
- [x] **空 body / 不正 JSON:** N/A — postMessage 型は実装時ガード（Security Brief）。不正 payload は Host 無視想定で専用 TC は非必須

### Uncovered / Spec Gaps

- AD-013 ライブ非同期は Non-Goal（dirty ゲートで代替）
- AD-014 仕様波及はテスト対象外
- 実 Cursor ホスト差は TC-017 で失敗明示のみ
- テストコード実装済（TDD Red）: `src/test/suite/unit/native-preview-side-and-default-raw.test.ts` — Green は build-agent

### AD-* Traceability

| AD | TC |
|----|-----|
| AD-001 初期 raw | TC-001（+ wysiwyg TC-070 期待更新） |
| AD-002 三点維持・第4禁止 | TC-002, TC-003, TC-015 |
| AD-003 コマンド ID | TC-007 |
| AD-004 非モード配置 | TC-003 |
| AD-005 ラベル | TC-003, TC-018 |
| AD-006 dirty UX | TC-004–006, TC-008, TC-019 |
| AD-007 保存成功ゲート | TC-005, TC-009, TC-010 |
| AD-008 URI 解決 | TC-011 |
| AD-009 Host ゲート | TC-014 |
| AD-010 Pattern A | TC-012 |
| AD-011 Marp | TC-013 |
| AD-012 往復 P0 | TC-002, TC-020 |
| AD-013 ライブ非目標 | Non-Goal（ゲートで担保） |
| AD-014 仕様波及 | N/A（spec） |

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-05 | 初版。AD-001–014 / §1・§8・§10 に対応する TC-001–020。初期 Raw・Side Preview 非モード・dirty Save/Cancel・三点往復・Pattern A / Marp 非干渉 | `native-preview-side-and-default-raw` |
| 2026-09-05 | Trace: ユニット実装（TDD Red）。`native-preview-side-and-default-raw.test.ts` + TC-070 初期 raw 期待更新 | `native-preview-side-and-default-raw` |
