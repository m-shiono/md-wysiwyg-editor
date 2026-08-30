# Agent Instructions

AI guidance for this repository is centralized under `.cursor/`.

## Repository model

| Layer | Location | Role |
|-------|----------|------|
| **Template core** | `.cursor/rules/` (core), `.cursor/agents/`, `.cursor/skills/` | Language-agnostic workflow |
| **Stack overlay** | `doc/stack.md`, `templates/rules/` → `.cursor/rules/` | Per-app language/runtime |
| **Product** | `doc/systemspec.md`, `src/`, `tests/` | Application (after template phase) |

Template usage: [templates/README.md](templates/README.md). Stack declaration: [doc/stack.md](doc/stack.md) (copy from [doc/stack.md.example](doc/stack.md.example)).

While `doc/stack.md` has `status: template`, do not assume a runtime — activate stack before implementation.

## Architecture: orchestrator + subagents

**Main session:** user communication, requirement-thinking, task decomposition, delegation, handoff synthesis.

**Subagents:** execute skills, edit files, run commands; return compact handoffs only.

| Layer | Responsibility |
|-------|----------------|
| Main session | requirement-thinking, planning, delegate, summarize for user |
| Subagents | spec / test / build / review / verify / meta work |

Rules: [`.cursor/rules/orchestrator.mdc`](.cursor/rules/orchestrator.mdc) · Handoff: [`.cursor/agents/handoff-template.md`](.cursor/agents/handoff-template.md) · Hooks: [`.cursor/hooks/README.md`](.cursor/hooks/README.md)（`gate-requirements-workflow` / `gate-specification-workflow` / `gate-verifier-workflow`）

## Canonical rules

| Rule | Scope |
|------|--------|
| [project-conventions.mdc](.cursor/rules/project-conventions.mdc) | Always — spec-first, writing rules |
| [naming-conventions.mdc](.cursor/rules/naming-conventions.mdc) | Always — naming semantics, comments language |
| [orchestrator.mdc](.cursor/rules/orchestrator.mdc) | Always — main-session delegation |
| Stack rules (from [templates/rules/](templates/rules/)) | When copied — see [doc/stack.md](doc/stack.md) |

Index: [`.cursor/rules/README.md`](.cursor/rules/README.md)

## Subagents

| Subagent | Skills | Use for |
|----------|--------|---------|
| [requirements-agent](.cursor/agents/requirements-agent.md) | requirements-advisory | Security/cost/ops/design advisory before spec |
| [spec-agent](.cursor/agents/spec-agent.md) | project-systemspec-authoring, spec-change-propagation, doc-coauthoring | Spec & docs |
| [test-agent](.cursor/agents/test-agent.md) | spec-test-design, testspec-implementation, bug-regression-test | Testspec & tests |
| [build-agent](.cursor/agents/build-agent.md) | project-debugging, project-implementation, project-refactoring | Debug, implement, refactor |
| [review-agent](.cursor/agents/review-agent.md) | code/security/design review, doc-consistency-audit | Reviews & audit |
| [verifier](.cursor/agents/verifier.md) | requirements-gate-check, spec-gate-check, testspec-gate-check | Mid-pipeline gates + final acceptance |
| [meta-agent](.cursor/agents/meta-agent.md) | self-retrospective, skill-triage, skill-creator | Cursor setup |

**Main session only:** [requirement-thinking](.cursor/skills/requirement-thinking/SKILL.md), [tdd-red-green-loop](.cursor/skills/tdd-red-green-loop/SKILL.md)（build-agent 後 — Pass 時 Phase 0 / Fail 時ループ。`phases.implementation: done` の単一 Owner）。

All implementation skills read [doc/stack.md](doc/stack.md) via [_shared/read-stack.md](.cursor/skills/_shared/read-stack.md).

## Typical flows

フロー詳細・phase 更新担当・バグ修正分岐は [doc/development.md](doc/development.md#cursor-開発フロー) を正本とする（以下は要約）。

**New feature:** requirement-thinking → requirements-agent → requirement-thinking Phase C → verifier (requirements-gate) → spec-agent → verifier (spec-gate) → test-agent (spec-test-design) → verifier (testspec-gate) → test-agent (testspec-implementation) → build-agent → main (tdd-red-green-loop) → review-agent → verifier → archive-workflow-state

**Bugfix:** build-agent → test-agent → build-agent → review-agent → verifier

**Refactor:** build-agent → review-agent (if large) → verifier

**Spec change:** spec-agent → verifier (spec-gate) → test-agent (spec-test-design) → verifier (testspec-gate) → test-agent (testspec-implementation) → build-agent → main (tdd-red-green-loop) → review-agent → verifier → archive-workflow-state

**Security-sensitive:** above + review-agent (security) before deploy

**Template / Cursor setup:** meta-agent

## Task planning (main session)

SMART steps · Dependencies: doc → spec-agent · testspec → test-agent · debug → build-agent · parallel when independent

## Harness layers (DocDD / SDD / TDD)

| Layer | Source of truth | Enforcement |
|-------|-----------------|-------------|
| DocDD | `doc/systemspec.md`, `doc/testspec-*.md`, `.cursor/rules/` | Specification-first, audits |
| SDD | `temporary/workflow-state-<task-id>.yaml` | Hooks, orchestrator flows, handoff |
| TDD | testspec Test Matrix → tests | test-agent, verifier |

See [doc/development.md](doc/development.md#ハーネス-3-レイヤーdocdd--sdd--tdd).

## Specification-first

Behavior changes: **doc first** (spec-agent), then test/build, then review + verifier. See [project-conventions.mdc](.cursor/rules/project-conventions.mdc).

## Project docs

- [doc/development.md](doc/development.md) — dev & Cursor workflow
- [doc/coding-conventions.md](doc/coding-conventions.md) — naming & coding style
- [doc/systemspec.md](doc/systemspec.md) — system requirements
- [doc/testspec-readme.md](doc/testspec-readme.md) — testspec layout
- [doc/stack.md](doc/stack.md) — stack profile
- [doc/deployment.md](doc/deployment.md) — deploy (TBD)

