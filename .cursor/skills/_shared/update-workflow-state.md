# Workflow State — Disk Update (Required)

`temporary/workflow-state-<task-id>.yaml` is the **SDD source of truth on disk**.
Hooks read this file — **handoff `## Workflow state` YAML is documentation only**.

## Create（要件フェーズ完了 — main session）

```bash
python3 .cursor/hooks/init-workflow-state.py --task-id <slug> --triage middle
```

Middle / Large では **要件フェーズ完了時**に実行する:

- Phase C 完了（全 `UD-*` resolved）後
- Phase C スキップ（`user_decisions_required: 0`）後の Advisor Defaults 確認後

**`verifier`（requirements-gate）より前**に必須。既存ファイルがある場合は `--force`。

init 時点では `phases.requirements: done` だが **`gates.requirements: pending`**（verifier が pass 後に `done` を設定）。spec-agent 委譲前に requirements-gate 必須。

## Subagents MUST

1. Update the YAML **file on disk** when completing a phase or gate
2. Prefer the CLI helper:

```bash
python3 .cursor/hooks/update-workflow-state.py --task-id <slug> \
  --phase spec --phase-status done \
  --artifact systemspec_section='§3.2 Feature Name'
```

```bash
python3 .cursor/hooks/update-workflow-state.py --task-id <slug> \
  --gate spec --gate-status done
```

3. Include the same values in handoff `## Workflow state` for the main session

## Phase → agent mapping

| Phase / gate | Who sets `done` | CLI flags |
|--------------|-----------------|-----------|
| `phases.requirements` | main（Phase C または Phase C スキップ後） | `--phase requirements --phase-status done` |
| `gates.requirements` | verifier | `--gate requirements --gate-status done` |
| `phases.spec` + `artifacts.systemspec_section` | spec-agent | `--phase spec --phase-status done --artifact systemspec_section='§…'` |
| `gates.spec` | verifier | `--gate spec --gate-status done` |
| `phases.testspec` + `artifacts.testspec` | test-agent (spec-test-design) | `--phase testspec --phase-status done --artifact testspec=doc/testspec-<slug>.md` |
| `gates.testspec` | verifier | `--gate testspec --gate-status done` |
| `phases.tests` | test-agent (testspec-implementation) | `--phase tests --phase-status done` |
| `phases.implementation` | main（tdd-red-green-loop）— Green 確定時 | `--phase implementation --phase-status done`（`--tdd-status green` と併用） |
| `phases.implementation` | project-refactoring（bypass リファクタのみ） | `--phase implementation --phase-status done` |
| `phases.review` | review-agent | `--phase review --phase-status done` |
| `tdd_loop.*` | build-agent（Fail 時）/ main（tdd-red-green-loop） | `--tdd-iteration N --tdd-status pending|green|blocked --tdd-last-failure "..."` |

## Task ID in delegations

Middle+ tasks with concurrent work: every Task prompt **must** include `Task ID: <slug>` so Hooks scope to the correct workflow-state file.

## Archive on task completion

最終 `verifier` pass 後、メインまたは `verifier` が実行:

```bash
python3 .cursor/hooks/archive-workflow-state.py --task-id <slug>
```

削除は `--delete`（非推奨）。詳細: [verifier.md](../../agents/verifier.md) Final acceptance。
