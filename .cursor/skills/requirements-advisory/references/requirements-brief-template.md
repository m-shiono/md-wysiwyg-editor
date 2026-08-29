# Requirements Brief — `<task-id>`

> 作業用成果物。`temporary/requirements-brief-<task-id>.md` に出力する。

## Metadata

| 項目 | 値 |
|------|-----|
| task_id | `<slug>` |
| triage | Middle / Large |
| intent_brief | `temporary/intent-brief-<task-id>.md` |
| stack | `doc/stack.md` |

## Intent Summary

<!-- Intent Brief から 3〜5 行で要約 -->

## Advisor Defaults（AD-*）

<!-- Class A。ユーザー確認不要。異議で覆す。 -->

- **AD-001:** ...

## User Decisions Required（UD-*）

<!-- Class U / B。メインセッションが Phase C で質問する。 -->

- **UD-001:** [質問] — 推奨: A — 理由: ... — 代替: B — **status:** open | resolved

<!-- Phase C 完了後、すべて resolved に更新すること -->

## Risks（RK-*）

<!-- 情報提供。 -->

- **RK-001:** ...

## Panel Dissent

<!-- 視点間の対立要約。なければ none -->

## Trace（監査用・ユーザーには要約のみ提示）

### Security
- ...

### Cost
- ...

### Operations
- ...

### Design
- ...

### Frontend
- ...

### Backend
- ...

### Infra
- ...

## Next

- agent: `verifier` — requirements-gate 通過後に `spec-agent` へ
