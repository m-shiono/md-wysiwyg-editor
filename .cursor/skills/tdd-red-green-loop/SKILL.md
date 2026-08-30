---
name: tdd-red-green-loop
description: >
  build-agent 実装後にメインが Green 確定と phases.implementation 完了を担う。
  Pass 時は Phase 0（初回 Green 確認）、Fail 時は Red-Green ループ（最大 3 回）。
  失敗原因を実装/testspec/spec に分類し、build-agent 再委譲または test-agent / spec-agent へエスカレーション。
  build-agent handoff 後は常に本スキルを実行（Middle+ workflow-state がある場合）。メインセッション専用。
---

# TDD Red-Green Loop

**目的:** testspec に定義された TC が **Green（Pass）** になるまで、最小の修正ループを回す。

**所有者:** メインセッション（オーケストレータ）。build-agent は 1 イテレーション分の修正のみ担当。

**`phases.implementation: done` の単一 Owner:** 本スキル（メインセッション）のみ。build-agent / project-implementation は **更新しない**（例外: `project-refactoring` の bypass リファクタ）。

**開始時:** [_shared/read-stack.md](../_shared/read-stack.md) → [doc/stack.md](../../../doc/stack.md)

## 他スキルとの関係

| 状況 | スキル / agent |
|------|----------------|
| 根本原因調査（原因不明） | `project-debugging` → build-agent |
| 実装修正（1 回分） | build-agent |
| testspec / Expected 誤り | test-agent（testspec 先に修正） |
| 振る舞い未定義 | spec-agent |
| ループ完了・レビューへ | review-agent |

---

## Phase 0: 初回 Pass（ループ不要）

build-agent handoff で `Verification.tests: pass` かつ `tdd_loop` に失敗履歴がない場合（`iteration: 0` かつ `last_failure: null`）:

1. Phase 4 の disk 更新を実行（`tdd-status green` + `phases.implementation: done`）
2. `Next: review-agent`
3. build-agent 再委譲は不要

workflow-state がない Trivial / Small は本 Phase をスキップし、直接 `review-agent` へ。

---

## Phase 1: 失敗の取り込み

build-agent handoff から以下を抽出する。

- 失敗コマンド（`test_single` / `test_all`）
- 失敗 TC ID（testspec の `TC-0xx`）
- エラーメッセージ / スタック（1 行要約可）
- `temporary/workflow-state-<task-id>.yaml` の有無

### 分類（いずれか 1 つ）

| 類型 | 判定 | 次 |
|------|------|-----|
| **implementation** | 実装ロジック・型・I/O の誤り。testspec Expected は妥当 | Phase 2（build-agent 再委譲） |
| **testspec** | Expected が systemspec と矛盾、または TC 設計ミス | test-agent → testspec 修正 → Phase 2 |
| **spec** | systemspec に根拠がない振る舞い | spec-agent → Phase 1 から再開 |
| **environment** | stack 未 active、依存不足 | blocked → ユーザー |

---

## Phase 2: Red-Green ループ

workflow-state がある場合、`tdd_loop` を [update-workflow-state.py](../../hooks/update-workflow-state.py) で disk 更新する:

```bash
python3 .cursor/hooks/update-workflow-state.py --task-id <slug> \
  --tdd-iteration <n> --tdd-status pending --tdd-last-failure "TC-0xx: 要約"
```

```yaml
tdd_loop:
  iteration: 0
  max: 3
  status: pending  # pending | green | blocked
  last_failure: null
```

### ループ手順

1. `tdd_loop.iteration` を +1（`max` 超えたら Phase 3 へ）— 上記 CLI で disk 更新
2. **build-agent** へ再委譲 — Goal: 失敗 TC を Pass にする。入力: TC ID、エラー要約、関連パス
3. handoff の `Verification.tests` を確認
4. **pass** → `--tdd-status green` + `--phase implementation --phase-status done` → `Next: review-agent`
5. **fail** → Phase 1 に戻り再分類

### 委譲プロンプト（最小）

```
Task ID: <slug>
Goal: TC-0xx を Pass にする（Red-Green iteration <n>/<max>）
Acceptance criteria:
- test_single（stack.md）で対象 TC Pass
- testspec Expected を変更しない（testspec 問題の場合は test-agent へ）
Inputs:
- temporary/workflow-state-<task-id>.yaml
- doc/testspec-<slug>.md（TC-0xx）
- <source/test paths>
Constraints: spec-first。testspec 誤りなら blocked で test-agent へ
```

---

## Phase 3: エスカレーション（iteration >= max）

- `tdd_loop.status: blocked`
- ユーザーに: 失敗 TC、試行回数、分類、推奨（testspec 見直し / 仕様確認 / 人手デバッグ）
- `Next`: 分類に応じ test-agent / spec-agent / build-agent（debug）

---

## Phase 4: Green 後の workflow-state

ループ成功時に disk 更新:

```bash
python3 .cursor/hooks/update-workflow-state.py --task-id <slug> \
  --phase implementation --phase-status done \
  --tdd-status green
```

- testspec Trace Results を build-agent / test-agent が Pass + 日付で更新済みであること

---

## 完了ゲート

- [ ] 対象 P0 + P1 TC が Pass（stack.md の test runner）
- [ ] `phases.implementation: done`（workflow-state がある場合）
- [ ] testspec 外のテスト追加なし
- [ ] `Next: review-agent`

## 参照

- [testspec-implementation/SKILL.md](../testspec-implementation/SKILL.md)
- [project-debugging/SKILL.md](../project-debugging/SKILL.md)
- [workflow-state-template.yaml](../requirement-thinking/references/workflow-state-template.yaml)
- [_shared/update-workflow-state.md](../_shared/update-workflow-state.md)
