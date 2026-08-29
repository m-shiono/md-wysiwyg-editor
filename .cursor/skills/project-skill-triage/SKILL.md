---
name: project-skill-triage
description: Triage sanitized findings from this repository's self-improvement loop and turn acceptable ones into small local edits for rules, skills, and agents. Use when the user wants to process `.triage/findings/*.json`, accept or reject findings, apply minimal local fixes, or create a triage summary from self-retrospective output.
---

# Project Skill Triage

Read sanitized findings from `.triage/findings/*.json`, decide which ones are safe to act on, and apply small local fixes to this repository's Cursor rules, skills, and agents.

## Scope

Use this skill only for local self-improvement artifacts in this repository.

Valid edit targets are limited to:

- `.cursor/rules/*.mdc`
- `.cursor/skills/**/*.md`
- `.cursor/agents/*.md`

Do not edit application code, tests, or deployment files through this skill.

## Inputs

Prefer one of these inputs:

1. An explicit findings JSON path such as `.triage/findings/self-retrospective-latest.json`
2. A request to use the latest local findings artifact

If the user does not specify a file, use the newest file in `.triage/findings/`.

## Output goal

For each finding, produce one of:

- `accept`: safe, local, and worth applying now
- `reject`: not actionable, stale, duplicated, or outside scope
- `conflict`: plausible but unsafe to apply automatically

Apply only small accepted changes that fit in one target file at a time.

## Workflow

### 1. Load inputs and config

- Read `.cursor/self-improvement.yaml`
- Read the findings JSON
- Confirm every candidate target is listed in config or is clearly inside the allowed local target families

Stop if the findings file is missing or malformed.

### 2. Judge each finding

Use [references/triage-criteria.md](references/triage-criteria.md).

Accept a finding only when all are true:

- it maps to one local target
- the target still reproduces the problem
- the fix is small and local
- the fix does not require coordinated edits across multiple files

Reject findings that are already addressed, too vague, or product-only.

Mark a finding as conflict when the idea is reasonable but the safe fix is unclear.

### 3. Apply accepted findings

For each accepted finding:

- read the current target file first
- make the smallest edit that satisfies the finding
- keep the repository writing rules intact:
  - Code should make the `How` clear
  - Test code should make the `What` clear
  - Commit logs should make the `Why` clear
  - Code comments should explain `Why not`

If an accepted finding overlaps a previously applied change in the same run, merge them only when the result stays small and clear. Otherwise, downgrade the later finding to `conflict`.

### 4. Verify locally

After edits:

- re-read the edited file if needed
- confirm the intended issue is actually addressed
- run lints on changed markdown or rule files when available

If verification fails, revert that finding's edit if practical and mark it as `conflict`.

### 5. Write a local triage summary

Write a markdown report to `.triage/reports/skill-triage-latest.md`.

Summarize:

- findings file used
- accepted findings
- rejected findings
- conflicted findings
- files changed
- follow-up work, if any

## Operating mode

This minimal Phase 2 skill is local-first.

- no GitHub issue updates
- no automatic commits
- no automatic PR creation

Those can be added in a later phase after the local loop is stable.

## Return format

Return:

1. The findings file used
2. Accepted, rejected, and conflicted finding ids
3. The files changed
4. The path to the triage summary
