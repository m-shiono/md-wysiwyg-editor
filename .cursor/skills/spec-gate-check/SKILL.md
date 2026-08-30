---
name: spec-gate-check
description: >
  test-agent 着手前に systemspec の完了を検証する。
  workflow-state の spec フェーズ、systemspec 節の存在、Related Tests を確認する。
  verifier が spec-agent 完了後・test-agent 委譲前に使う。
---

# Spec Gate Check

`test-agent` 委譲前のゲート。読み取り専用。

## 入力

| ファイル | 条件 |
|---------|------|
| `temporary/workflow-state-<task-id>.yaml` | Middle+ で存在すれば phase 整合を確認 |
| `doc/systemspec.md` | 対象 feature の節 |
| spec-agent handoff | `artifacts` / `Workflow state` |

## チェックリスト

### 1. トリアージ整合

- [ ] Trivial / Small（workflow-state なし）→ 本ゲートは **スキップ**（`status: done`、理由を Summary に記載）
- [ ] Middle / Large → 以下を実施

### 2. workflow-state 整合

- [ ] `temporary/workflow-state-<task-id>.yaml` が存在する
- [ ] `phases.spec` が `done` である（`pending` なら **blocked**）
- [ ] `artifacts.systemspec_section` が設定されている（例: `§3.2 User API`）

### 3. systemspec 内容

- [ ] `doc/systemspec.md` に `artifacts.systemspec_section` 相当の節が存在する
- [ ] Inputs / Outputs / Failure Returns が表形式で埋まっている
- [ ] 改訂履歴に当該変更が追記されている
- [ ] Related Tests に `doc/testspec-<slug>.md` パスがある、または「testspec 未作成・後続で spec-test-design」と明記

### 4. Spec Gaps

- [ ] ⚠️ Spec Gaps がある場合、意図的未決として記録されているか、ユーザー確認済み

## 出力（verifier handoff）

```markdown
## Spec gate
- triage: Middle | Large | skipped (Small/Trivial)
- workflow_state: present | missing
- spec_phase: done | pending | skipped
- systemspec_section: §X.Y | missing
- related_tests: linked | pending | n/a
- result: pass | blocked
```

## blocked 時

- `Next: spec-agent` — 不足項目を列挙（節未作成、phase 未更新、Related Tests 欠落）
- `phases.spec: done` になるまで `test-agent` へ進めない

## pass 時（disk 更新必須）

Hook が `gates.spec: done` を要求する。verifier は以下を実行:

```bash
python3 .cursor/hooks/update-workflow-state.py --task-id <slug> \
  --gate spec --gate-status done
```

## 参照

- [review-lifecycle.md](../_shared/review-lifecycle.md)
- [project-systemspec-authoring/SKILL.md](../project-systemspec-authoring/SKILL.md)
- [workflow-state-template.yaml](../requirement-thinking/references/workflow-state-template.yaml)
