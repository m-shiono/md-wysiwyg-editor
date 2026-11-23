# Test Specification: auto-sync-dirty-fix（誤 dirty 防止・外部ファイル変更自動同期）

## 概要

- **対象:** Custom Editor オープン直後および描画副作用による誤 dirty 化の防止（Host `MarkdownDocument.updateDoc` 実質差分判定・Webview NodeView/`Link`/送信ガード）、および未編集（`!isDirty`）時の外部ファイル変更自動同期（`FileSystemWatcher`・250ms デバウンス・自己保存抑止・`reloadFromDisk()` 全モード同期）
- **対応仕様:** [doc/requirements/systemspec.md](../requirements/systemspec.md) §1（誤 dirty 防止と外部ファイル変更の自動同期 / AD-021）、§8（シリアライズ・保存）、§12（PlantUML NodeView ガード）、§14（数式 NodeView ガード）
- **設計:** [doc/design/architecture.md](../design/architecture.md) AD-021
- **要件:** `temporary/requirements-brief-auto-sync-dirty-fix.md`（AD-001〜AD-007, RK-001〜RK-003）
- **テストコード（後続 `testspec-implementation`）:** `src/test/suite/unit/auto-sync-dirty-fix.test.ts`
- **作成日:** 2026-11-24

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| `MarkdownDocument.updateDoc(doc, label, options)` | `TipTapDoc`, `string`, `UpdateOptions` | — | — | `previous` を同一 `SerializeOptions` でシリアライズした文字列と `serialized` を比較 |
| `MarkdownDocument.uri` | `vscode.Uri` | — | — | 監視対象は `file` / `vscode-remote` のみ（`untitled` は対象外） |
| `FileSystemWatcher.onDidChange` | `vscode.Uri` イベント | 0 回 | 連続発火 | URI 単位 `250ms` デバウンス、`ignoreCreateEvents: true`, `ignoreDeleteEvents: true` |
| `selfSaveSuppression` | 保存状態 + `500ms` ウィンドウ | 0 ms | 500 ms | `save()` / `saveAs()` 実行中および完了後 500ms は外部変更イベントを抑止 |
| `diskContent` | `string` (UTF-8) | `""` (0 B) | — | `readFile` 読込後、`document.markdownText` と完全一致なら no-op |
| `document.isDirty` | `boolean` | `false` | `true` | `false` のときのみ `reloadFromDisk()` 実行（`readFile` 完了直前にも再確認） |

### Outputs & Failure Returns

| 条件 | 戻り値 / 状態 | 仕様根拠 |
|------|--------------|---------|
| `updateDoc`: `serializeMarkdown(previous, opts) === serialized` | `_doc` のみ更新。`_markdownText` / `_isDirty` / `_editStack` 不変、`onDidChange` 非発火 | §1, §8, AD-001 |
| `updateDoc`: `serializeMarkdown(previous, opts) !== serialized` | `_doc` / `_markdownText` 更新、`_isDirty = true`、`_editStack` 追加、`onDidChange` 発火 | §1, §8, AD-001 |
| Webview `math` / `plantuml` NodeView 内の非 `code` 変更・イベント | `ignoreMutation` = `true`（無視）、`stopEvent` = `true`（抑止） | §12, §14, AD-002 |
| Webview `onUpdate`: 直近同期済み `docJson` と一致 | `postMessage({ type: 'update', ... })` を送信しない | §1, AD-002 |
| 外部変更（`!isDirty`、非自己保存、内容差分あり） | `reloadFromDisk()` で UTF-8 読込・再パース・`_isRawParseFailed = false`・`_isDirty = false`・`_editStack` リセット・`_onDidContentChange.fire()`（`_onDidChange` 非発火）→ 全表示面同期 | §1, AD-003〜AD-007 |
| 外部変更（`isDirty === true`、または `readFile` 中に `isDirty` 化） | 外部変更を無視、ユーザー編集・`isDirty === true` を保持 | §1, AD-006, RK-002 |
| 外部変更（自己保存ウィンドウ内、または内容が `markdownText` と一致） | no-op スキップ（再読込・Undo リセットなし） | §1, AD-005 |
| `reloadFromDisk()` 中の `readFile` / `parseMarkdown` 失敗 | 既存 `MarkdownDocument` 正本・`isDirty` を破壊せず `logError` のみ（モーダル非表示） | §1 例外系 3, RK-001 |
| `webviewPanel.onDidDispose` | `FileSystemWatcher.dispose()` およびデバウンスタイマー `clearTimeout` | §1, AD-003, AD-004 |

### Preconditions & Assumptions

- Extension Host の `MarkdownDocument` がドキュメント状態・`isDirty`・Undo 履歴の正本である。
- Webview の `media/editor.ts` は DOM / TipTap 依存のため、単体テストでは `media/editor.ts` の静的構造・設定検証および純粋ロジック境界で検証し、Host 側は `vscode` テストシムを用いて `MarkdownDocument` / `MarkdownEditorProvider` を検証する。
- `untitled` スキームには実ディスクファイルが存在しないため、`FileSystemWatcher` を作成しない。

### Complexity Budget

- デバウンス（`250ms`）および単一ファイル `RelativePattern` 監視により、I/O・再パースはバーストあたり O(1) 回に集約される。
- `updateDoc` の比較は変更前後のシリアライズ文字列比較 O(N)（N = ドキュメント長）であり、既存のシリアライズ経路と同等。

### Spec Gaps

- なし（`systemspec.md` §1, §8, §12, §14 および `requirements-brief-auto-sync-dirty-fix.md` AD-001〜AD-007 で確定済み）。

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-ASDF-001 | Happy | updateDoc-noop-roundtrip-crlf | P0 | CRLF（`# Title\r\n\r\nBody`）かつ末尾改行なしで `MarkdownDocument` を開き、同一意味モデルの `updateDoc(doc, 'Edit')` を実行 | `doc.isDirty === false`、`doc.markdownText === '# Title\r\n\r\nBody'`（CRLF・末尾改行なしを保持）、`_editStack` 空、`onDidChange` 非発火 | オープン直後の TipTap ラウンドトリップで CRLF/末尾改行差異により誤 dirty・無断整形しないこと | §1, §8, AD-001 |
| TC-ASDF-002 | Structural | updateDoc-noop-format-variants | P0 | `* item1\n* item2\n\n_italic_\n`（`*` 箇条書き・`_` 斜体）で開き、TipTap 相当の `updateDoc` を実行 | `serializeMarkdown(previous, opts) === serializeMarkdown(next, opts)` となり、`doc.isDirty === false`、`doc.markdownText` が元の `*` / `_` 記法を維持 | 記法正規化差異による誤 dirty 化および勝手な書式書き換えを防ぐ | §1, §8, AD-001 |
| TC-ASDF-003 | Happy | updateDoc-substantive-edit | P0 | `# Title\n\nHello\n` で開き、`# Title\n\nHello world\n` のモデルで `updateDoc(next, 'Edit')` を実行 | `serializeMarkdown(previous, opts) !== serialized` のため `doc.isDirty === true`、`doc.markdownText` が更新され、Undo 履歴に 1 件積まれ、`onDidChange` が発火 | 実質的な本文編集は従来どおり dirty 化・Undo 登録されること | §1, §8, AD-001 |
| TC-ASDF-004 | Boundary | updateDoc-empty-doc-noop | P1 | 空ファイル `""` で開き、空モデルの `updateDoc` を実行 | `doc.isDirty === false`、`doc.markdownText === ""`、Undo 履歴追加なし | 最小入力（空ドキュメント）での境界値検証 | §1, §8, AD-001 |
| TC-ASDF-005 | Structural | webview-math-nodeview-guards | P0 | `media/editor.ts` の `math` NodeView 定義（`ignoreMutation` / `stopEvent`） | `mermaid` NodeView と同等に `code` 要素外の DOM 変更を `ignoreMutation` で無視（`true`）し、`code` 外イベントを `stopEvent` で抑止（`true`）するガードが定義されている | KaTeX 非同期描画・クリックによる誤トランザクション / 誤 dirty 化を防ぐ | §1, §14, AD-002 |
| TC-ASDF-006 | Structural | webview-plantuml-nodeview-guards | P0 | `media/editor.ts` の `plantuml` NodeView 定義（`ignoreMutation` / `stopEvent`） | `mermaid` NodeView と同等に `code` 要素外の DOM 変更を `ignoreMutation` で無視（`true`）し、`code` 外イベントを `stopEvent` で抑止（`true`）するガードが定義されている | PlantUML 非同期 SVG 挿入による誤トランザクション / 誤 dirty 化を防ぐ | §1, §12, AD-002 |
| TC-ASDF-007 | Structural | webview-link-dedup | P0 | `media/editor.ts` の `StarterKit.configure(...)` と `Link.configure(...)` | `StarterKit.configure` に `link: false` が明示され、`Link.configure({ openOnClick: false })` との拡張重複登録が排除されている | TipTap 拡張重複警告および初期化時不要トランザクションを解消する | §1, AD-002 |
| TC-ASDF-008 | Corner | webview-noop-update-suppression | P0 | `media/editor.ts` の `onUpdate` デバウンス送信処理 | 直近同期済み `docJson` 文字列と現在 `docJson` 文字列を比較し、一致する場合は `postMessage({ type: 'update', ... })` を送信しないガードが存在する | 無変更時の不要な `update` postMessage 送信を Webview 側でも抑止する | §1, AD-002 |
| TC-ASDF-009 | Happy | watcher-scope-schemes | P0 | `MarkdownEditorProvider` で `file:///w/a.md`、`vscode-remote://ssh+h/w/b.md`、`untitled:Untitled-1.md` をそれぞれ開く | `file` / `vscode-remote` では親ディレクトリ＋ファイル名の `RelativePattern` で `createFileSystemWatcher(..., true, false, true)` が生成され、`untitled` では生成されない | 監視スコープの最小化および非ファイルスキーム除外を保証する | §1, AD-003 |
| TC-ASDF-010 | Happy | external-change-debounce-250ms | P0 | `!isDirty` の `file` ドキュメントに対し `onDidChange` を 0ms・50ms・100ms で 3 回連続発火（ディスク内容は更新済み） | 250ms 経過前は `reloadFromDisk()` 未実行、最後のイベントから 250ms 経過後に 1 回だけ `reloadFromDisk()` が実行される | AI ツール等の連続書き込みを 250ms デバウンスで 1 回に集約すること | §1, AD-004 |
| TC-ASDF-011 | Corner | self-save-suppression-window | P0 | `document.save()` / `saveAs()` 実行中および完了後 500ms 以内に `FileSystemWatcher.onDidChange` を発火 | 自己保存抑止ウィンドウにより `reloadFromDisk()` がスキップされ、再読込ループ・Undo スタック消去が起きない | 自己保存イベントによる無用な再読込と Undo 履歴消失を防ぐ | §1, AD-005 |
| TC-ASDF-012 | Corner | self-save-identical-content-skip | P0 | 自己保存ウィンドウ外で `onDidChange` が発火したが、ディスク文字列が現在の `document.markdownText` と完全一致 | 内容一致チェックにより no-op としてスキップされ、`onDidContentChange` 非発火・Undo スタック維持 | OS/FS 遅延イベントや無変更タッチで不要な全画面再投影を起こさない | §1, AD-005 |
| TC-ASDF-013 | Corner | dirty-guard-blocks-reload | P0 | ユーザー編集により `document.isDirty === true` にした後、ディスク上の `.md` を別内容へ変更し `onDidChange` 発火（250ms 経過） | `reloadFromDisk()` は実行されず、ユーザーの未保存 `markdownText` と `isDirty === true` が保持される | 未保存編集の外部上書き（データ損失）を確実に防止する | §1, AD-006 |
| TC-ASDF-014 | Corner | dirty-guard-race-during-async-read | P1 | `isDirty === false` 時点で `reloadFromDisk()` を開始し、`readFile` 解決前にユーザー編集で `isDirty = true` へ変化させる | `readFile` 完了後の `this._isDirty` 再チェックにより反映を中断し、ユーザー編集と `isDirty === true` を保持 | 非同期 `readFile` 中のミリ秒単位の編集競合によるデータ損失を防ぐ（RK-002） | §1, AD-006, RK-002 |
| TC-ASDF-015 | Happy | reloadFromDisk-resets-undo-and-keeps-clean | P0 | 編集履歴（`_editStack`）および `_isRawParseFailed = true` を持つ clean ドキュメントに対し、新内容 `# Updated\n` で `reloadFromDisk()` を実行 | `doc` / `markdownText` が `# Updated\n` へ更新、`_isDirty === false`、`_isRawParseFailed === false`、`_editStack` リセット（undo/redo 不可）、`onDidContentChange` 発火、`onDidChange` 非発火 | 外部更新後の整合性確保・Undo 不整合防止・タブ clean 維持 | §1, AD-007 |
| TC-ASDF-016 | Happy | reloadFromDisk-syncs-all-modes | P0 | `markdown`（Visual）・`raw`（Source）・`preview`（非 Marp / Marp）・サイド `MarpPreviewManager` 接続状態で `!isDirty` 外部変更を検知 | `onDidContentChange` 経由で Webview へ `docUpdated`（`applyExternalDoc(..., { force: true })` / `syncRawTextFromHost` / `previewMarpHtml`）および `MarpPreviewManager` 更新が送られ、`isDirty === false` を維持 | 全表示面（Visual/Source/Preview/Marp）への一括同期を保証する | §1, AD-007 |
| TC-ASDF-017 | Corner | reloadFromDisk-read-error-non-destructive | P0 | `reloadFromDisk()` 実行時に `vscode.workspace.fs.readFile` がエラーを reject（truncate 中の一時エラー想定） | 既存 `document.markdownText` / `doc` / `isDirty === false` が破壊されず、`logError` のみ出力（モーダル通知なし）。次回の正常 `reloadFromDisk()` で回復 | 外部書き込み途中の読込失敗で正本を壊さず自然回復できること（RK-001） | §1 例外系 3, RK-001 |
| TC-ASDF-018 | Corner | reloadFromDisk-parse-error-non-destructive | P1 | `reloadFromDisk()` 実行時に `parseMarkdown` が例外を throw する不正状態を注入 | 既存 `MarkdownDocument` 正本が破壊されず `logError` のみ記録。次回の正常変更で回復可能 | パース失敗時も既存正本を保護すること（RK-001） | §1 例外系 3, RK-001 |
| TC-ASDF-019 | Happy | watcher-and-timer-disposal | P0 | 250ms デバウンスタイマー待機中に `webviewPanel.onDidDispose` を発火 | `FileSystemWatcher.dispose()` が呼ばれ、待機中タイマーが `clearTimeout` され、250ms 経過後も `reloadFromDisk()` が呼ばれない | パネル破棄後のメモリリークおよび破棄後イベント発火を防ぐ | §1, AD-003, AD-004 |
| TC-ASDF-020 | Boundary | external-delete-ignored | P1 | `createFileSystemWatcher` のオプション引数を検証 | `ignoreCreateEvents === true` かつ `ignoreDeleteEvents === true` で生成され、外部ファイル削除時にタブクローズやドキュメント破壊を行わない | Non-Goals（削除時タブ維持）の契約遵守 | §1 例外系 3 / Non-Goals, AD-003 |
| TC-ASDF-021 | Boundary | remote-scheme-watcher | P1 | `vscode-remote://wsl+Ubuntu/home/user/doc.md` でエディタを開く | `FileSystemWatcher` が生成され、`reloadFromDisk()` がスキーム/authority を保持した URI で `readFile` を呼ぶ | `vscode-remote` 環境での外部同期動作保証（RK-003） | §1, AD-003, RK-003 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-ASDF-001, TC-ASDF-003, TC-ASDF-009, TC-ASDF-010, TC-ASDF-015, TC-ASDF-016, TC-ASDF-019 | — |
| Boundary | TC-ASDF-004, TC-ASDF-020, TC-ASDF-021 | — |
| Structural | TC-ASDF-002, TC-ASDF-005, TC-ASDF-006, TC-ASDF-007 | — |
| Corner | TC-ASDF-008, TC-ASDF-011, TC-ASDF-012, TC-ASDF-013, TC-ASDF-014, TC-ASDF-017, TC-ASDF-018 | — |
| Stress | — | 250ms デバウンスによりバーストを O(1) に集約する設計（TC-ASDF-010 で複数連続発火の集約を検証済み）。大規模入力計算量テストは既存の `markdown-serializer.test.ts` スコープのため N/A |

### Complexity Notes

- デバウンス集約: 連続 `onDidChange` をタイマーリセットにより 1 回の `readFile` + `parseMarkdown` に集約（O(1) I/O per burst）。
- `updateDoc`: `serializeMarkdown(previous, opts)` の文字列比較 O(N)。

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | 通常 PR で実行（`npm run test:unit`） | `src/test/suite/unit/auto-sync-dirty-fix.test.ts`（`unit-entry.ts` に登録） |
| P2 | 該当なし | — |

---

## Trace Results

> 以下は設計段階の机上トレース（P0 + P1）。実行結果は `testspec-implementation` 以降に記録する。

### TC-ASDF-001 (P0): `updateDoc` CRLF・末尾改行なしラウンドトリップで誤 dirty 化しない

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `MarkdownDocument.create` | `markdownText = "# Title\r\n\r\nBody"`, `isDirty = false` |
| 1 | `updateDoc(equivalentDoc, 'Edit')` | `prevSerialized = serializeMarkdown(previous, opts)` = `"# Title\n\nBody\n"` |
| 2 | 比較 | `serialized === prevSerialized`（一致） |
| Output | 更新後状態 | `_doc` 更新、`isDirty === false`、`_markdownText === "# Title\r\n\r\nBody"`、`_editStack.length === 0` |

**Result:** ✅ 机上 Pass

---

### TC-ASDF-002 (P0): `updateDoc` `*` 箇条書き・`_` 斜体の無変更ラウンドトリップ

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `MarkdownDocument.create` | `"* item1\n* item2\n\n_italic_\n"` |
| 1 | `updateDoc(equivalentDoc, 'Edit')` | `prevSerialized` = `"- item1\n- item2\n\n*italic*\n"`, `serialized` = 同左 |
| Output | 更新後状態 | `isDirty === false`、`markdownText` は元の `*` / `_` を維持 |

**Result:** ✅ 机上 Pass

---

### TC-ASDF-003 (P0): `updateDoc` 実質編集時は dirty 化・Undo 登録

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `MarkdownDocument.create` | `"# Title\n\nHello\n"` |
| 1 | `updateDoc(modifiedDoc, 'Edit')` | `prevSerialized !== serialized`（`Hello world` へ変化） |
| Output | 更新後状態 | `isDirty === true`、`_editStack.length === 1`、`onDidChange` 発火 |

**Result:** ✅ 机上 Pass

---

### TC-ASDF-004 (P1): 空ドキュメント `""` での `updateDoc` no-op

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `MarkdownDocument.create` | `""`, `isDirty = false` |
| 1 | `updateDoc(emptyDoc, 'Edit')` | `prevSerialized === serialized`（ともに `""` / 空表現） |
| Output | 更新後状態 | `isDirty === false`、`markdownText === ""` |

**Result:** ✅ 机上 Pass

---

### TC-ASDF-005〜008 (P0): Webview NodeView ガード・Link 重複排除・no-op `update` 送信抑止

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `media/editor.ts` | `math` / `plantuml` NodeView、`StarterKit.configure`、`onUpdate` |
| 1 | NodeView 検証 | `math` と `plantuml` 双方に `ignoreMutation`（`code` 外無視）と `stopEvent`（`code` 外抑止）あり |
| 2 | Link 検証 | `StarterKit.configure({ link: false, ... })` + `Link.configure({ openOnClick: false })` |
| 3 | `onUpdate` 検証 | `docJsonStr === lastSyncedDocJsonStr` のとき `postMessage` をスキップ |
| Output | 静的・構造検証 | すべて仕様契約と一致 |

**Result:** ✅ 机上 Pass

---

### TC-ASDF-009〜014, TC-ASDF-019〜021 (P0/P1): Watcher・デバウンス・自己保存抑止・Dirty ガード・破棄

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `MarkdownEditorProvider` | `file` / `vscode-remote` で watcher 作成（`untitled` は非作成） |
| 1 | `onDidChange` 連続 3 回（0/50/100ms） | 250ms 後の 350ms 時点で `reloadFromDisk()` 1 回のみ実行（TC-ASDF-010） |
| 2 | `save()` 後 500ms 以内の `onDidChange` | 抑止ウィンドウによりスキップ（TC-ASDF-011） |
| 3 | 内容同一の `onDidChange` | `diskText === document.markdownText` でスキップ（TC-ASDF-012） |
| 4 | `isDirty === true` 時の `onDidChange` | 無視してユーザー編集保持（TC-ASDF-013） |
| 5 | `readFile` 中に `isDirty = true` | 反映直前チェックで中断（TC-ASDF-014） |
| 6 | `webviewPanel.onDidDispose` | `watcher.dispose()` + `clearTimeout`（TC-ASDF-019） |
| Output | 状態・呼び出し回数 | すべて期待値どおり |

**Result:** ✅ 机上 Pass

---

### TC-ASDF-015〜018 (P0/P1): `reloadFromDisk()` 同期・Undo リセット・エラー非破壊

| Step | State / Action | Value |
|------|----------------|-------|
| Input | `MarkdownDocument`（`isDirty === false`） | 既存 Undo 履歴あり、`_isRawParseFailed = true` 状態 |
| 1 | `reloadFromDisk()` 成功 | 新内容反映、`_editStack = []`, `_editIndex = -1`, `_isDirty = false`, `_isRawParseFailed = false`, `onDidContentChange` 発火（TC-ASDF-015, 016） |
| 2 | `readFile` / `parseMarkdown` 失敗 | 正本不変、`logError` 記録、次回変更で回復（TC-ASDF-017, 018） |
| Output | 状態 | 全モード同期＋clean 維持＋エラー時非破壊 |

**Result:** ✅ 机上 Pass

---

### Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-ASDF-001〜003, 005〜013, 015〜017, 019 | P0 | ✅ 机上 Pass | 16 件 |
| TC-ASDF-004, 014, 018, 020, 021 | P1 | ✅ 机上 Pass | 5 件 |

---

## Self-Check Report

### A. Input & Constraints
- [x] **最小値 / 空の入力:** 空ドキュメント `""`（TC-ASDF-004）および `untitled` スキーム（TC-ASDF-009）をカバー
- [x] **最大値 / オーバーフロー:** N/A（数値計算・整数オーバーフロー非該当。連続イベントバーストは TC-ASDF-010 でカバー）
- [x] **符号・型:** N/A（数値型入力なし。URI スキーム種別 `file` / `vscode-remote` / `untitled` は TC-ASDF-009, 021 でカバー）

### B. Structural Patterns
- [x] **全要素同一 / 偏り:** 内容完全一致の外部イベント・no-op `updateDoc`（TC-ASDF-001, 002, 008, 012）をカバー
- [x] **順序・ソート:** 連続書き込みイベントの時間順序・デバウンス集約（TC-ASDF-010）および非同期 `readFile` 中の編集競合（TC-ASDF-014）をカバー
- [x] **非連結・サイクル:** 自己保存による再読込ループ抑止（TC-ASDF-011, 012）をカバー

### C. Corner & Failure
- [x] **解が存在しない場合 / 失敗系:** `readFile` 失敗（TC-ASDF-017）、`parseMarkdown` 失敗（TC-ASDF-018）、`isDirty === true` 時のスキップ（TC-ASDF-013）をカバー
- [x] **先頭・末尾のアクセス:** 末尾改行なし（TC-ASDF-001）、パネル破棄時のタイマー境界（TC-ASDF-019）、外部削除（TC-ASDF-020）をカバー

### D. Complexity & Resources
- [x] **時間計算量:** 250ms デバウンスによるバースト集約（TC-ASDF-010）
- [x] **スタック深度 / リソース解放:** パネル破棄時の `FileSystemWatcher.dispose()` と `clearTimeout` によるリーク防止（TC-ASDF-019）

### E. API / Worker（該当時）
- [x] N/A（ローカル VS Code Custom Editor 拡張機能であり HTTP API / Worker 非該当）

### Uncovered / Spec Gaps
- なし（テストコード実装は後続 `testspec-implementation` へ委譲）。

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-11-24 | 初版作成（test-agent / spec-test-design） |
