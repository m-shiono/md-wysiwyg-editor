# Cursor Rules

## Always active (template core)

| File | Scope |
|------|--------|
| [project-conventions.mdc](./project-conventions.mdc) | spec-first, writing rules, temp files |
| [naming-conventions.mdc](./naming-conventions.mdc) | naming semantics, comments language, test naming |
| [orchestrator.mdc](./orchestrator.mdc) | main session delegation |

## Stack-specific (copy from templates/)

Enable by copying from [templates/rules/](../../templates/rules/) per [doc/stack.md](../../doc/stack.md) `cursor_rules`.

| Template | When to use |
|----------|-------------|
| `typescript-workers.mdc` | TypeScript + Cloudflare Workers |
| `tests-typescript.mdc` | Vitest/Jest + `tests/**/*.ts` |
| `python.mdc` | Python `src/**/*.py` |
| `tests-python.mdc` | pytest `tests/**/*.py` |
| `go.mdc` | Go `**/*.go` |

## Activation checklist

- [ ] `doc/stack.md` exists with `status: active`
- [ ] Required template rules copied into `.cursor/rules/`
- [ ] `cursor_rules` in stack.md matches files present
- [ ] globs match actual source/test paths
- [ ] Quality commands in stack.md work locally

## Template phase (this repo)

While `doc/stack.md` has `status: template`, only core rules above are active. No stack rules in this folder until app development starts.
