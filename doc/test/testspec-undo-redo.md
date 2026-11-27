# Test Specification: undo-redo（単一正本 Undo / Redo・記録ポイント・IME/Ctrl+Z 対応）

## 概要

- **対象:** Custom Editor（Visual / Source モード共通）における単一正本 `MarkdownDocument` 履歴管理（最大 100 段）、英語単語・文節境界／日本語 IME 変換確定／構造コマンド単位の Undo グルーピング、`Ctrl+Z` / `Cmd+Z` および Redo キーバインド対応、カーソル復元、保存地点復帰時の `isDirty` 連動
- **対応仕様:** [doc/requirements/systemspec.md](../requirements/systemspec.md) §1（単一正本 Undo / Redo / AD-022）、§2（キーボード・IME 保護）、§15（リスト編集支援 IME 変換保護）
- **設計:** [doc/design/architecture.md](../design/architecture.md) AD-002, AD-022
- **テストコード:**
  - `src/test/suite/unit/undo-redo.test.ts`（ユニットテスト & JSDOM Webview テスト）
  - `src/test/suite/integration/issue-31-lifecycle.integration.test.ts`（VS Code Extension Host 統合テスト）
- **作成日:** 2026-11-27

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| `UndoGroupTracker.nextGroupId(input)` | `{ kind: UndoInputKind; insertedText?: string; timestamp?: number; selectionReplaced?: boolean }` | — | — | `insertText` / `deleteBackward` / `deleteForward` / `insertLineBreak` / `compositionConfirm` / `command` |
| `MarkdownDocument` 履歴上限 | `MAX_UNDO_HISTORY = 100` | 0 | 100 | 最低 10 段以上を確実に保持し、100 超過時は最古エントリから破棄 |
| `MarkdownDocument.updateDoc / applyRawSource` | `options?: { syncWebview?: boolean; undoGroupId?: string; selectionBefore?: EditorSelectionSnapshot; selectionAfter?: EditorSelectionSnapshot }` | — | — | 同一 `undoGroupId` かつ保存地点を跨がない末尾更新をインプレース結合 |
| Webview Undo / Redo キー | `KeyboardEvent` | — | — | Undo: `Ctrl+Z` / `Cmd+Z`、Redo: `Ctrl+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z` / `Cmd+Y` |

### Outputs & Failure Returns

| 条件 | 戻り値 / 状態 | 仕様根拠 |
|------|--------------|---------|
| 英語単語・句読点入力 | 単語内連続入力は同一 `undoGroupId`、空白・句読点後の次文字または 800ms 休止・カーソル移動で新規 `undoGroupId` | §1 正常系 6, AD-022 |
| 日本語 IME 変換 | `compositionstart`〜変換中は送信・記録せず、`compositionend` で `'compositionConfirm'` として 1 記録ポイント確定 | §1, §2, §15, AD-022 |
| 10 回以上の連続 Undo / Redo | `MarkdownDocument.undo()` / `redo()` で 1 記録ポイントずつ正確に巻き戻し・再適用。初期状態に戻ると `isDirty === false` | §1 正常系 6 |
| 保存地点（`save` / `saveAs`）への復帰 | Undo / Redo で保存地点へ戻ると `isDirty === false`、さらに戻すと `isDirty === true` | §1 正常系 6 |
| Source モード初回編集前復帰 | 初回編集前の初期テキストが `before` に保持され、1 回目 `Ctrl+Z` から空振りせず初期状態へ戻る | §1 正常系 6 |
| Visual モード `Ctrl+Z`（macOS 想定含む） | `ctrlKey: true, metaKey: false` および `metaKey: true` の双方で `requestUndo` 送信・巻き戻し | §1 正常系 6 |
| Readonly / Preview / `<input>` フォーカス時 | Readonly・Preview 時は Undo/Redo 無効、`#find-input` 等 `<input>` フォーカス時は横取りしない | §1 正常系 6, §11 |

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-UNDO-001 | Happy | grouping-english-words | P0 | `UndoGroupTracker` に `"hello "` `"world!"` `" next"` を 1 文字ずつ（100ms 間隔）投入 | `"hello "` が同一グループ、`"world!"` が次グループ、`" "` 後の `"n"` で次グループとなる | 英語の単語・文節単位で記録ポイントが切れること | §1, AD-022 |
| TC-UNDO-002 | Happy | grouping-punctuation-and-idle | P0 | `"abc,"` の直後に `"d"`、さらに `900ms` 後に `"e"`、改行 `insertLineBreak`、削除 `deleteBackward` を投入 | 句読点後文字・800ms アイドル・改行・挿入↔削除切替でそれぞれ新グループ ID が発行される | 一般的なエディタの区切り規則と一致すること | §1, AD-022 |
| TC-UNDO-003 | Happy | grouping-cursor-move-and-ime | P0 | `"abc"` 入力 → `notifyCursorMove()` → `"def"` 入力 → `compositionConfirm` → `command` | カーソル移動後・IME 変換確定・構造コマンドがそれぞれ独立した新規グループになる | 離れた位置の編集や日本語変換確定が独立履歴になること | §1, AD-022 |
| TC-UNDO-004 | Happy | document-12-steps-undo-redo-initial | P0 | `MarkdownDocument` に異なる `undoGroupId` で 12 回編集後、`undo()` を 12 回、`redo()` を 12 回実行 | 12 段階すべて逆順に戻り、12 回目で初期テキスト・`isDirty === false` へ復帰し、12 回の `redo()` で最終状態へ戻る | 要件「少なくとも過去10回程度戻せる」および初期状態復帰の保証 | §1, AD-022 |
| TC-UNDO-005 | Happy | document-coalescing-same-group | P0 | 同一 `undoGroupId` で `"a"` → `"ab"` → `"abc"` と 3 回更新後に `undo()` を 1 回実行 | `onDidChange` は 1 回のみ発火し、1 回の `undo()` で 3 文字入力前の状態へ戻る | 単語内打鍵が1つの記録ポイントへ結合されること | §1, AD-022 |
| TC-UNDO-006 | Corner | document-save-point-dirty-sync | P0 | 編集 1 → `save()` → 編集 2 → 編集 3 → `undo()` ×2 → `undo()` ×1 → `redo()` ×1 | 編集 1 地点に戻ると `isDirty === false`、初期状態へ戻すと `isDirty === true`、保存地点へ `redo()` すると `isDirty === false` | 保存状態との `isDirty` 整合性保証 | §1, AD-022 |
| TC-UNDO-007 | Boundary | document-max-history-100 | P1 | `MarkdownDocument` に異なる `undoGroupId` で `105` 回連続編集後、可能な限り `undo()` | `undoDepth === 100` で上限管理され、100 回まで正常に `undo()`・`redo()` できる | メモリ保護と `MAX_UNDO_HISTORY = 100` 境界検証 | §1, AD-022 |
| TC-UNDO-008 | Happy | webview-visual-ctrl-z-and-cmd-z | P0 | JSDOM Visual モードで編集後、`Ctrl+Z`（`ctrlKey: true, metaKey: false`）および `Cmd+Z`（`metaKey: true`）を発火 | 両方とも `defaultPrevented === true` かつ `requestUndo` が送信され、Provider 連携で編集前に戻る | macOS での `Ctrl+Z` 無効バグの根絶 | §1, §2 |
| TC-UNDO-009 | Happy | webview-visual-ime-composition | P0 | JSDOM Visual モードで `compositionstart` → DOM テキスト変更（未確定） → `compositionend` 発火 | `compositionstart`〜変換中は `update` 未送信、`compositionend` 後に 1 回だけ確定送信される | 日本語未確定文字が履歴を汚さないこと | §1, §2 |
| TC-UNDO-010 | Happy | webview-raw-initial-state-and-cursor | P0 | JSDOM Source モードで初期テキスト `"alpha"` に対し、追記 `"alpha beta"` 後に `Ctrl+Z` 1 回、続けて `Ctrl+Y` | 1 回目の `Ctrl+Z` が空振りせず即座に `"alpha"` に戻り、カーソル位置も復元され、`Ctrl+Y` で `"alpha beta"` に戻る | Source モードの 1 段ズレ・初期状態欠落バグの解消 | §1, AD-022 |
| TC-UNDO-011 | Corner | webview-raw-ime-enter-guard | P0 | JSDOM Source モードのリスト行 `"- item"` で `isComposing: true` の `Enter` を発火 | リスト自動継続が誤発火せず、`"- item\n- "` に書き換わらない | 日本語 IME 変換確定 `Enter` による誤動作防止 | §15 |
| TC-UNDO-012 | Happy | provider-10-word-e2e-and-cross-mode | P0 | `MarkdownEditorProvider` + JSDOM Webview 連携で Visual で 10 単語入力＋Source で 2 回編集し、12 回 `Ctrl+Z` で巻き戻し | モード横断で 12 回すべて逆順に巻き戻り、初期状態・`isDirty === false` に復帰する | 三重スタック競合の解消とモード横断履歴の一貫性 | §1, AD-022 |
| TC-UNDO-013 | Corner | webview-input-scope-and-readonly-guard | P1 | `#find-input` フォーカス時の `Ctrl+Z`、および `readonly: true` 時の `Ctrl+Z` | `#find-input` 内では `requestUndo` せず（非横取り）、`readonly: true` では Undo を拒否して変更しない | 入力ウィジェット保護と Readonly 契約遵守 | §1, §4, §11 |
| TC-UNDO-014 | Happy | integration-10-step-undo-redo | P0 | VS Code 統合テスト（`issue-31-lifecycle.integration.test.ts`）で CustomEditor に 10 回以上異なるグループ編集を行い、`undo` ×10 以上 → `redo` ×10 以上を実行 | 実 VS Code `undo` / `redo` コマンドで 10 回以上の編集をすべて初期状態まで戻し、再適用できる | 実 VS Code Extension Host での回帰保証 | §1 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-UNDO-001, TC-UNDO-002, TC-UNDO-003, TC-UNDO-004, TC-UNDO-005, TC-UNDO-008, TC-UNDO-009, TC-UNDO-010, TC-UNDO-012, TC-UNDO-014 | — |
| Boundary | TC-UNDO-007 | — |
| Corner | TC-UNDO-006, TC-UNDO-011, TC-UNDO-013 | — |
| Stress | — | 履歴上限 `MAX_UNDO_HISTORY = 100` により履歴配列は O(100) に制限される（TC-UNDO-007 で検証済み） |
