# Subagent Handoff Template

Subagents **must** end every response with this block only — no full file dumps, no long diffs, no skill text.

```markdown
---
handoff: true
agent: <agent-name>
task_id: <slug>
status: done | partial | blocked
---

## Summary
<!-- 1–3 sentences: what was accomplished -->

## Artifacts
<!-- repository-relative paths only -->
- `path/to/file`

## Verification
<!-- commands from doc/stack.md; or "not run" with reason -->
- tests: pass | fail | skipped
- typecheck: pass | fail | skipped | n/a
- lint: pass | fail | skipped | n/a

## Blockers
<!-- none, or bullet list -->

## Decision summary
<!-- requirements-agent only; omit for other agents -->
```yaml
decision_summary:
  advisor_defaults: <数>
  user_decisions_required: <数>
  panel_dissents: <数>
```

## Next
<!-- recommended next subagent + one-line reason -->
- agent: `<name>` — ...
```

## Rules

- **Max ~40 lines** for the entire handoff
- Link paths; do not paste file contents
- On `blocked`, include what the main session or user must decide
- On `partial`, list what remains

Main session reads **only** this block from subagent output.
