# Review Lifecycle

要件段階と実装後のレビューを対応づける。`meta-agent` は実装後レビューで要件段階の見落としを検出したら、左列のチェックリストを更新する。

## 対応表

| 観点 | 要件段階（予防） | 実装後（検証） |
|------|------------------|----------------|
| Security | [security-checklist.md](../requirements-advisory/references/security-checklist.md) | [project-security-review/SKILL.md](../project-security-review/SKILL.md) |
| Design / Architecture | [project-design-review/SKILL.md](../project-design-review/SKILL.md) Design questions | 同スキル + `doc/stack.md` layout |
| Cost | [cost-checklist.md](../requirements-advisory/references/cost-checklist.md) | 設計レビュー + 運用コストの手動確認 |
| Operations | [operations-checklist.md](../requirements-advisory/references/operations-checklist.md) | [doc/deployment.md](../../../doc/deployment.md)、運用 Runbook |
| Frontend | [frontend-checklist.md](../requirements-advisory/references/frontend-checklist.md) | [project-code-review/SKILL.md](../project-code-review/SKILL.md) |
| Backend | [backend-checklist.md](../requirements-advisory/references/backend-checklist.md) | [project-code-review/SKILL.md](../project-code-review/SKILL.md) |
| Infra | [infra-checklist.md](../requirements-advisory/references/infra-checklist.md) | [project-security-review/SKILL.md](../project-security-review/SKILL.md) stack notes |

## ゲート

| タイミング | 担当 | スキル / エージェント |
|------------|------|------------------------|
| spec-agent 着手前 | `verifier` | [requirements-gate-check/SKILL.md](../requirements-gate-check/SKILL.md) |
| Task 委譲時（機械的） | Cursor Hooks | [`.cursor/hooks.json`](../../../hooks.json) — `gate-requirements-workflow.py` |
| 実装完了後 | `review-agent` | project-security-review, project-design-review, project-code-review |
| 最終受け入れ | `verifier` | 既存 Checks + spec alignment |

## フィードバックループ

1. `review-agent` が要件段階で拾えたはずの問題を検出
2. handoff に `review_root_cause: requirements-gap` を付与（任意）
3. `meta-agent` が [self-improvement.yaml](../../../.cursor/self-improvement.yaml) 経由で requirements-advisory references を更新候補にする

## Requirements Brief との関係

- 要件段階の `AD-*` / `RK-*` は実装後レビューの期待値になる
- 実装後に新規 `Critical` / `High` が出た場合、対応するチェックリスト項目の不足を疑う
