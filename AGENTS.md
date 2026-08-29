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

Rules: [`.cursor/rules/orchestrator.mdc`](.cursor/rules/orchestrator.mdc) · Handoff: [`.cursor/agents/handoff-template.md`](.cursor/agents/handoff-template.md) · Hooks: [`.cursor/hooks/README.md`](.cursor/hooks/README.md)

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
| [spec-agent](.cursor/agents/spec-agent.md) | systemspec-authoring, spec-change-propagation, doc-coauthoring | Spec & docs |
| [test-agent](.cursor/agents/test-agent.md) | spec-test-design, testspec-implementation, bug-regression-test | Testspec & tests |
| [build-agent](.cursor/agents/build-agent.md) | project-debugging, project-refactoring | Debug, implement, refactor |
| [vscode-extension-agent](.cursor/agents/vscode-extension-agent.md) | vscode-extension-dev, vscode-extension-test, vscode-extension-publish | VS Code 拡張機能の実装・テスト・公開 |
| [review-agent](.cursor/agents/review-agent.md) | code/security/design review, doc-consistency-audit | Reviews & audit |
| [verifier](.cursor/agents/verifier.md) | requirements-gate-check | Requirements gate + final acceptance |
| [meta-agent](.cursor/agents/meta-agent.md) | self-retrospective, skill-triage, skill-creator | Cursor setup |

**Main session only:** [requirement-thinking](.cursor/skills/requirement-thinking/SKILL.md).

All implementation skills read [doc/stack.md](doc/stack.md) via [_shared/read-stack.md](.cursor/skills/_shared/read-stack.md).

## Typical flows

**New feature:** requirement-thinking Phase A → requirements-agent → requirement-thinking Phase C → verifier (requirements-gate) → spec-agent → test-agent → build-agent → review-agent → verifier

**Bugfix:** build-agent → test-agent → build-agent → review-agent → verifier

**Refactor:** build-agent → review-agent (if large) → verifier

**Spec change:** spec-agent → test-agent → build-agent → review-agent → verifier

**Security-sensitive:** above + review-agent (security) before deploy

**VS Code extension:** spec-agent → test-agent → vscode-extension-agent → review-agent → verifier

**VS Code extension release:** vscode-extension-agent → review-agent (security) → vscode-extension-agent (publish) → verifier

**Template / Cursor setup:** meta-agent

## Task planning (main session)

SMART steps · Dependencies: doc → spec-agent · testspec → test-agent · debug → build-agent · parallel when independent

## Specification-first

Behavior changes: **doc first** (spec-agent), then test/build, then review + verifier. See [project-conventions.mdc](.cursor/rules/project-conventions.mdc).

## Project docs

- [doc/development.md](doc/development.md) — dev & Cursor workflow
- [doc/coding-conventions.md](doc/coding-conventions.md) — naming & coding style
- [doc/systemspec.md](doc/systemspec.md) — system requirements
- [doc/testspec-readme.md](doc/testspec-readme.md) — testspec layout
- [doc/stack.md](doc/stack.md) — stack profile
- [doc/deployment.md](doc/deployment.md) — deploy (TBD)

