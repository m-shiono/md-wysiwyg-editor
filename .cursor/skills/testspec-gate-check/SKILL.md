---
name: testspec-gate-check
description: >
  build-agent 着手前に testspec の完了を検証する。
  workflow-state の testspec フェーズ、testspec ファイル、P0 TC の存在を確認する。
  verifier が test-agent（spec-test-design）完了後・build-agent 委譲前に使う。
---

# Testspec Gate Check

`build-agent` 委譲前の品質ゲート。読み取り専用。Hook（`gate-specification-workflow.py`）と併用する。

## 入力

| ファイル | 条件 |
|---------|------|
| `temporary/workflow-state-<task-id>.yaml` | Middle+ で存在すれば phase 整合を確認 |
| `doc/testspec-<feature-slug>.md` | test-agent handoff の `artifacts.testspec` |
| `doc/systemspec.md` | testspec がリンクする節 |

## チェックリスト

### 1. トリアージ整合

- [ ] Trivial / Small（workflow-state なし）→ 本ゲートは **スキップ**（`status: done`、理由を Summary に記載）
- [ ] Middle / Large → 以下を実施

### 2. workflow-state 整合

- [ ] `temporary/workflow-state-<task-id>.yaml` が存在する
- [ ] `phases.testspec` が `done` である（`pending` なら **blocked**）
- [ ] `artifacts.testspec` が `doc/testspec-<slug>.md` を指している

### 3. testspec 内容

- [ ] `doc/testspec-<feature-slug>.md` が存在する
- [ ] Test Matrix に P0 TC が 1 件以上ある
- [ ] 対応仕様リンク（`doc/systemspec.md` §）が testspec ヘッダに記載されている
- [ ] Spec Gaps が ⚠️ の項目は「未実装」または「要仕様確認」と明記

### 4. systemspec との整合（軽量）

- [ ] testspec の feature-slug が workflow-state の `feature_slug` と一致
- [ ] systemspec 節が存在する（spec-gate で確認済みなら Summary に参照のみ）

## 出力（verifier handoff）

```markdown
## Testspec gate
- triage: Middle | Large | skipped (Small/Trivial)
- workflow_state: present | missing
- testspec_phase: done | pending | skipped
- testspec_file: doc/testspec-<slug>.md | missing
- p0_tc_count: <数>
- result: pass | blocked
```

## blocked 時

- `Next: test-agent` — 不足項目を列挙（testspec 未作成、P0 欠落、phase 未更新）
- `phases.testspec: done` になるまで `build-agent` へ進めない

## pass 時（disk 更新必須）

Hook が `gates.testspec: done` を要求する。verifier は以下を実行:

```bash
python3 .cursor/hooks/update-workflow-state.py --task-id <slug> \
  --gate testspec --gate-status done
```

**Strict TDD:** testspec-gate pass 後は `test-agent`（testspec-implementation）で Red テストを実装し `phases.tests: done` にしてから `build-agent` へ委譲する。

## 参照

- [review-lifecycle.md](../_shared/review-lifecycle.md)
- [spec-test-design/SKILL.md](../spec-test-design/SKILL.md)
- [testspec-readme.md](../../../doc/testspec-readme.md)
