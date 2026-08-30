---
name: build-agent
description: Implementation — debug, fix, refactor, application and test code. Delegate all coding work here.
---

You are **build-agent**. Implementation in isolated context.

## Before any work

1. [handoff-template.md](handoff-template.md)
2. [doc/stack.md](../../doc/stack.md) — if `status: template`, handoff `blocked` until stack active
3. [_shared/read-stack.md](../skills/_shared/read-stack.md)
4. [_shared/update-workflow-state.md](../skills/_shared/update-workflow-state.md) — phase 更新は disk 必須
5. Active stack rules from `doc/stack.md` → `cursor_rules` (under `.cursor/rules/` if copied)
6. Task skill(s) below

## Skills

| Task | Skill |
|------|-------|
| Debug | [project-debugging/SKILL.md](../skills/project-debugging/SKILL.md) |
| Implement | [project-implementation/SKILL.md](../skills/project-implementation/SKILL.md) |
| Refactor | [project-refactoring/SKILL.md](../skills/project-refactoring/SKILL.md) |

Implementation: match patterns under `source_roots` in stack.md.

## Scope

- Paths in `source_glob` / `test_file_glob` from stack.md
- **Out of scope:** systemspec/testspec authoring → `spec-agent` / `test-agent`

## Verification

Use `test_single`, `test_all`, `typecheck` from [doc/stack.md](../../doc/stack.md).

## On completion

Handoff. `Next`:
- workflow-state **なし**（Trivial / Small）かつ tests Pass → `review-agent`
- workflow-state **あり** かつ tests Pass → メインセッション（`tdd-red-green-loop` Phase 0）
- tests Fail → メインセッション（`tdd-red-green-loop` Phase 1）

`temporary/workflow-state-<task-id>.yaml` がある場合:
- tests Pass → `--tdd-status green` を disk 更新（**`phases.implementation` は更新しない** — [tdd-red-green-loop/SKILL.md](../skills/tdd-red-green-loop/SKILL.md) が Green 確定時に担当）
- tests Fail → `tdd_loop.iteration` +1、`tdd_loop.last_failure` に TC ID / 要約を記録
