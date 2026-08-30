---
name: requirements-gate-check
description: >
  spec-agent 着手前に Requirements Brief の完了を検証する。
  UD-* が未解決のまま進んでいないか、Middle+ で Brief が欠けていないかを確認する。
  verifier が requirement-thinking 完了後・spec-agent 委譲前に使う。
---

# Requirements Gate Check

`spec-agent` 委譲前のゲート。読み取り専用。

## 入力

| ファイル | 条件 |
|---------|------|
| `temporary/intent-brief-<task-id>.md` | Middle+ で必須 |
| `temporary/requirements-brief-<task-id>.md` | Middle+ で必須 |
| トリアージ結果 | prompt または Brief Metadata |

## チェックリスト

### 1. トリアージ整合

- [ ] Trivial / Small → 本ゲートは **スキップ**（`status: done`、理由を Summary に記載）
- [ ] Middle / Large → 以下をすべて実施

### 2. 成果物の存在

- [ ] `temporary/intent-brief-<task-id>.md` が存在する
- [ ] `temporary/requirements-brief-<task-id>.md` が存在する
- [ ] Brief が [requirements-brief-template.md](../requirements-advisory/references/requirements-brief-template.md) の必須セクションを満たす

### 3. User Decisions（UD-*）

- [ ] `User Decisions Required` 内のすべての `UD-*` が `status: resolved` である
- [ ] `status: open` の `UD-*` が 1 件でもあれば **blocked**
- [ ] セクションが空または `none` → OK

### 4. Advisor Defaults（AD-*）

- [ ] 1 件以上の `AD-*` がある（Large）または Middle で技術論点があれば 1 件以上
- [ ] 技術論点がない純ビジネス変更のみの場合は `none` 可（Summary に理由）

### 5. Handoff 整合（requirements-agent 直後の場合）

- [ ] `decision_summary.user_decisions_required` が Brief 内の `open` UD 数と一致

## 出力（verifier handoff）

```markdown
## Requirements gate
- triage: Middle | Large | skipped (Small/Trivial)
- intent_brief: present | missing
- requirements_brief: present | missing
- ud_open: <数>
- ud_resolved: <数>
- result: pass | blocked
```

## blocked 時

- `Next: main session (requirement-thinking Phase C)` — 未解決 `UD-*` を列挙
- ユーザーまたはメインが Brief を更新するまで `spec-agent` へ進めない

## pass 時（disk 更新必須）

```bash
python3 .cursor/hooks/update-workflow-state.py --task-id <slug> \
  --gate requirements --gate-status done
```

## 参照

- [review-lifecycle.md](../_shared/review-lifecycle.md)
- [decision-taxonomy.md](../requirement-thinking/references/decision-taxonomy.md)
