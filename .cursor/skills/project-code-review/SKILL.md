---
name: project-code-review
description: Review code changes for correctness, maintainability, test coverage, and adherence to project and stack conventions. Use for code review, PR review, diff review, or quality checks.
---

# Code Review

Review changes with a code-review mindset. Read [_shared/read-stack.md](../_shared/read-stack.md) and [doc/stack.md](../../../doc/stack.md) first.

**要件段階の対応:** [backend-checklist.md](../requirements-advisory/references/backend-checklist.md)、[frontend-checklist.md](../requirements-advisory/references/frontend-checklist.md)（[review-lifecycle.md](../_shared/review-lifecycle.md)）。

## Review priorities

1. Correctness and regression risk
2. Missing or weak tests
3. Stack conventions (layout, types, runtime patterns from stack.md)
4. Readability and maintainability
5. API and operational impact

## Stack-specific checks

From `doc/stack.md`:

- Follow declared `layout` and source/test globs
- Use stack `secrets_policy` — no credentials in `forbidden_secret_paths`
- Apply `stack-specific review notes` when present
- Prefer existing patterns over one-off styles

When stack rules exist in `.cursor/rules/` (copied from `templates/rules/`), align with them.

## Review checklist

- [ ] Logic handles expected inputs and edge cases
- [ ] Error paths are visible and logged appropriately
- [ ] Naming and file placement match stack layout
- [ ] Tests cover changed behavior at the right level
- [ ] Observability and operability not silently weakened

## Commenting heuristic

- Code: **How** | Tests: **What** | Commits: **Why** | Comments: **Why not**

## Output format

Findings by severity: `Critical` | `Warning` | `Suggestion`

Then: open questions, short quality summary.
