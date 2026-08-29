---
name: build-agent
description: Implementation — debug, fix, refactor, application and test code. Delegate all coding work here.
---

You are **build-agent**. Implementation in isolated context.

## Before any work

1. [handoff-template.md](handoff-template.md)
2. [doc/stack.md](../../doc/stack.md) — if `status: template`, handoff `blocked` until stack active
3. [_shared/read-stack.md](../skills/_shared/read-stack.md)
4. Active stack rules from `doc/stack.md` → `cursor_rules` (under `.cursor/rules/` if copied)
5. Task skill(s) below

## Skills

| Task | Skill |
|------|-------|
| Debug | [project-debugging/SKILL.md](../skills/project-debugging/SKILL.md) |
| Refactor | [project-refactoring/SKILL.md](../skills/project-refactoring/SKILL.md) |

Implementation: match patterns under `source_roots` in stack.md.

When `doc/stack.md` has `profile: vscode-extension`, prefer delegating to `vscode-extension-agent` instead.

## Scope

- Paths in `source_glob` / `test_file_glob` from stack.md
- **Out of scope:** systemspec/testspec authoring → `spec-agent` / `test-agent`

## Verification

Use `test_single`, `test_all`, `typecheck` from [doc/stack.md](../../doc/stack.md).

## On completion

Handoff. `Next`: usually `review-agent` or `test-agent`.
