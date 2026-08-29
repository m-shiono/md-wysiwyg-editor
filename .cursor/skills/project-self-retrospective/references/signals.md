# Retrospective Signals

Use these signal classes when scanning a session transcript.

## `user_correction`

The user explicitly corrected the agent's direction or output.

Examples:

- "違う"
- "それじゃなくて"
- "その方針はやめて"

This usually points to:

- an ambiguous rule
- a skill description that under-specifies when to use it
- an agent prompt that lacks an exclusion or guardrail

## `repeated_instruction`

The user had to repeat the same instruction or preference more than once in the same session.

Examples:

- repeated requests about response language
- repeated reminders about commit behavior
- repeated formatting corrections

This usually points to:

- a rule that should be always-on
- a skill description that should trigger earlier
- missing emphasis in an existing rule

## `step_loop`

The agent repeated a step without making progress, or needed multiple retries because the process was unclear.

Examples:

- the same exploratory action repeated with little new information
- a tool handoff that stalls and resumes with no clear next step
- repeated "let me check" cycles with no concrete state change

This usually points to:

- a workflow step that needs a clearer exit condition
- a missing branch in a skill or agent
- an instruction that should be shorter and more operational

## `review_root_cause`

A review result explicitly identifies rule wording, skill wording, or agent wording as the cause of a problem.

Examples:

- code review notes that a local review skill missed an expected category
- design review notes that the prompt encouraged generic advice
- security review notes that a rule failed to remind the agent about secrets handling

This usually points to:

- updating wording in a skill or rule
- adding a checklist item
- clarifying target scope or output format

## Candidate rejection rules

Reject a candidate if:

- it does not map to one editable local target
- it requires product changes outside this repository
- the evidence contains sensitive data that cannot be safely summarized
- the suggested fix is too abstract to turn into a local edit
