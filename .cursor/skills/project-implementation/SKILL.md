---
name: project-implementation
description: >
  systemspec 節に沿って本番コードを実装する。stack layout 遵守、最小 diff、検証コマンド実行。
  build-agent が新機能・振る舞い変更の実装時に使う。
---

# Implementation

**目的:** `doc/systemspec.md` の対象節どおりに本番コードを追加・変更する。

**開始時:** [_shared/read-stack.md](../_shared/read-stack.md) → [doc/stack.md](../../../doc/stack.md)

## 前提

- [ ] `doc/systemspec.md` 該当節が確定（spec-agent 完了）
- [ ] `doc/testspec-*.md` の P0 TC が Red テストとして存在（testspec-implementation 完了）
- [ ] `doc/stack.md` の `status: active`

## Phase 1: 取り込み

1. systemspec 節 — Inputs / Outputs / Failure Returns
2. testspec の P0/P1 TC（Expected は変更しない）
3. `source_roots` / `layout`（stack.md）— 配置先を決める

```markdown
## Implementation Plan
- **systemspec:** §X.Y
- **testspec:** doc/testspec-<slug>.md
- **変更ファイル:** path/to/module
- **スコープ外:** ...
```

## Phase 2: 実装

- 既存パターン・命名規約に合わせる（[naming-conventions.mdc](../../rules/naming-conventions.mdc)）
- 1 論点ずつ変更 → `test_single`（stack.md）で対象 TC を確認
- testspec Expected を実装に合わせて変えない（失敗時は spec/testspec へエスカレーション）

## Phase 3: 完了

- [ ] 対象 P0 TC が Pass
- [ ] `typecheck`（stack.md にあれば）Pass
- [ ] tests Fail 時は `tdd_loop` を disk 更新（`--tdd-iteration` / `--tdd-last-failure`）— **`phases.implementation` は更新しない**
- [ ] tests Pass 時は handoff `Next: main session (tdd-red-green-loop Phase 0)` — implementation 完了はメインが担当

**禁止:** tests Fail のまま `--phase implementation --phase-status done` を実行しない。

## エスカレーション

| 状況 | 先 |
|------|-----|
| Expected と spec が矛盾 | spec-agent |
| TC 設計ミス | test-agent |
| 原因不明の失敗 | project-debugging |

## 参照

- [project-debugging/SKILL.md](../project-debugging/SKILL.md)
- [tdd-red-green-loop/SKILL.md](../tdd-red-green-loop/SKILL.md)
- [_shared/update-workflow-state.md](../_shared/update-workflow-state.md)
