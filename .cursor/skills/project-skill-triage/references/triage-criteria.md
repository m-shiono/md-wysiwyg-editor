# Triage Criteria

Use these rules when turning self-retrospective findings into local edits.

## Accept

Accept a finding only when all are true:

- The target is one local file under `.cursor/rules/`, `.cursor/skills/`, or `.cursor/agents/`
- The current file still shows the problem described by the finding
- The suggested fix direction can be implemented as a small local edit
- The edit does not require product changes outside this repository
- The edit does not depend on multiple coordinated file changes to stay correct

Typical accepted cases:

- clarify which file is the canonical source of truth
- add a missing workflow branch to a local skill
- tighten wording so a rule triggers earlier or more consistently
- add a small checklist or output requirement

## Reject

Reject a finding when any are true:

- the issue is already addressed in the current target
- the finding is too vague to edit safely
- the real fix would be in Cursor product behavior, not this repository
- the finding duplicates another finding that already covers the same change
- the evidence is too weak or too indirect

Typical rejected cases:

- "the model felt off" with no local wording root cause
- "tool selection was bad" without a stable local rule or skill fix
- a finding that points to a file outside the local Cursor setup

## Conflict

Mark a finding as `conflict` when:

- the target seems right but the fix is not safely automatable
- two findings overlap and you cannot merge them cleanly
- the finding would require editing multiple files together
- you cannot verify the change after editing

Typical conflicted cases:

- a fix that changes both a rule and several skills at once
- a broad workflow restructuring
- a finding with competing plausible edits

## Minimality rule

For Phase 2 MVP, prefer the smallest useful change.

- one finding should usually lead to one target file
- if two findings collapse into one tiny clarification, that is acceptable
- if the change grows beyond a small local edit, stop and mark `conflict`
