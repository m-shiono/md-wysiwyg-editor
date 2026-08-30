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

## Workflow state
<!-- when temporary/workflow-state-<task_id>.yaml exists; omit for trivial/small without state -->
<!-- MUST update the file on disk via update-workflow-state.py — handoff alone does NOT satisfy Hooks -->
```yaml
workflow_state: temporary/workflow-state-<task_id>.yaml
workflow_state_updated_on_disk: true  # false → Hook will deny next delegation
phase_completed: spec | testspec | tests | implementation | review  # implementation は tdd-red-green-loop / project-refactoring のみ
phase_status: done | skipped
gate_completed: spec | testspec | requirements  # verifier only
gate_status: done | skipped
tdd_loop_updated: true  # build-agent: Pass 時 green / Fail 時 iteration+last_failure
artifacts_updated:
  systemspec_section: "§X.Y"  # spec-agent only, when applicable
  testspec: doc/testspec-<slug>.md  # test-agent only, when applicable
```

## Decision summary
<!-- requirements-agent only; omit for other agents -->
```yaml
decision_summary:
  advisor_defaults: <数>
  user_decisions_required: <数>
  panel_dissents: <数>
```

## Review feedback
<!-- review-agent only; omit when no requirements-stage gap found -->
```yaml
review_feedback:
  review_root_cause: requirements-gap | implementation | null
  checklist_gaps: []  # e.g. security-checklist item IDs — meta-agent triage input
```

## Next
<!-- recommended next subagent + one-line reason -->
- agent: `<name>` — ...
```

## Rules

- **Max ~40 lines** for the entire handoff
- Link paths; do not paste file contents
- **Workflow state:** run [update-workflow-state.py](../hooks/update-workflow-state.py) per [_shared/update-workflow-state.md](../skills/_shared/update-workflow-state.md); set `workflow_state_updated_on_disk: true` only after the file write succeeds
- On `blocked`, include what the main session or user must decide
- On `partial`, list what remains

Main session reads **only** this block from subagent output.
