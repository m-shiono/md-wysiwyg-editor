---
name: project-design-review
description: Review design and architecture for separation of concerns, boundaries, extensibility, testability, and fit with the stack layout. Use for design or architecture review.
---

# Design Review

Architecture-focused review. Read [_shared/read-stack.md](../_shared/read-stack.md) and [doc/stack.md](../../../doc/stack.md) first.

**要件段階:** 同スキルの Design questions を `requirements-agent` が使用（[review-lifecycle.md](../_shared/review-lifecycle.md)）。

## Review goals

Evaluate whether the change fits the declared structure and remains easy to evolve.

## Stack layout

Use `layout` from `doc/stack.md` as the intended layering — do not invent a parallel structure unless systemspec mandates migration.

## Design questions

1. Is responsibility in the right layer?
2. Does coupling increase or decrease?
3. Are interfaces and dependencies clear?
4. Will the next related change be easier or harder?
5. Is testing strategy aligned?
6. Is observability preserved?

## Review checklist

- [ ] Boundaries match stack layout
- [ ] New abstractions solve a real problem
- [ ] Side effects isolated enough to test
- [ ] Naming matches domain and repo language

## Output format

1. Key findings
2. Trade-offs and assumptions
3. Recommended next steps

Tie guidance to `doc/stack.md` layout, not generic advice only.
