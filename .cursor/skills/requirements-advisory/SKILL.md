---
name: requirements-advisory
description: >
  Intent Brief を入力に、セキュリティ・コスト・運用・設計の観点で要件をレビューし、
  Requirements Brief を作成する。requirements-agent が使用する。
  メインセッションやユーザーが直接呼び出さない。
---

# Requirements Advisory

技術的妥当性・見落としやすい非機能要件を **ユーザーに判断させる前に** 専門家視点で整理する。
出力は [requirements-brief-template.md](references/requirements-brief-template.md) に従う。

## 入力

| ファイル | 必須 |
|---------|------|
| `temporary/intent-brief-<task-id>.md` | はい |
| [doc/stack.md](../../../doc/stack.md) | はい |
| [decision-taxonomy.md](../requirement-thinking/references/decision-taxonomy.md) | はい |
| `doc/systemspec.md` | 存在すれば |

## 実行プロトコル

```text
[Phase 1: コンテキスト読込]
[Phase 2: 並列アドバイザリレビュー]
[Phase 3: Synthesis → Requirements Brief 書き込み]
```

### Phase 1: コンテキスト読込

- [_shared/read-stack.md](../_shared/read-stack.md) に従い `doc/stack.md` を読む
- Intent Brief から Class U の未記入・曖昧な点を洗い出す（Phase 3 で `UD-*` 化）

### Phase 2: 並列アドバイザリレビュー

各チェックリストを適用し、視点ごとにメモを取る（ユーザーには見せない）。

| 視点 | Reference |
|------|-----------|
| Security | [security-checklist.md](references/security-checklist.md) |
| Cost | [cost-checklist.md](references/cost-checklist.md) |
| Operations | [operations-checklist.md](references/operations-checklist.md) |
| Design | [project-design-review/SKILL.md](../project-design-review/SKILL.md) |
| Frontend | [frontend-checklist.md](references/frontend-checklist.md)（UI ありの場合） |
| Backend | [backend-checklist.md](references/backend-checklist.md) |
| Infra | [infra-checklist.md](references/infra-checklist.md) |

ライフサイクル対応: [_shared/review-lifecycle.md](../_shared/review-lifecycle.md)

`status: template` の stack ではランタイムを仮定せず、論点を `RK-*` として一般化する。

### Phase 3: Synthesis

[synthesis-rules.md](references/synthesis-rules.md) に従い統合する。

**出力先:** `temporary/requirements-brief-<task-id>.md`

## 分類ルール

[decision-taxonomy.md](../requirement-thinking/references/decision-taxonomy.md) を厳守:

- 技術詳細 → `AD-*`（Advisor default）
- ビジネストレードオフ・方向性 → `UD-*`（User decision）
- パネル対立 → `UD-*` に 1 問に集約

## Handoff 追加フィールド

```yaml
decision_summary:
  advisor_defaults: <数>
  user_decisions_required: <数>
  panel_dissents: <数>
```

## 禁止事項

- ユーザー向けの質問文をチャットに直接書かない（Brief の `UD-*` に書く）
- 実装コード・systemspec の執筆（→ `spec-agent`）
- Class A を `UD-*` に昇格させてユーザー負荷を増やすこと

## 完了条件

- [ ] `temporary/requirements-brief-<task-id>.md` がテンプレート全セクションを満たす
- [ ] `UD-*` は未決の Class U/B のみ
- [ ] handoff に `decision_summary` がある
