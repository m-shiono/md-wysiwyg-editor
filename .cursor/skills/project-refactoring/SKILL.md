---
name: project-refactoring
description: >
  外部挙動を変えずにコード構造を改善。重複排除、抽出、命名、モジュール分割。
  doc/stack.md の layout に従う。純リファクタでは doc 更新省略可。
---

# Refactoring

**目的:** 挙動不変で保守性向上。**バグ修正は別タスク。**

**開始時:** [_shared/read-stack.md](../_shared/read-stack.md) → [doc/stack.md](../../../doc/stack.md)

## 前提ゲート

- [ ] `test_all`（stack.md）が Pass
- [ ] 対象にテストあり（なければ test-agent へ）
- [ ] 挙動不変と説明できる

## doc 更新

| 変更 | doc |
|------|-----|
| 内部のみ | 不要 |
| 公開 API / 契約 | systemspec 要 |
| testspec Trace 陳腐化 | testspec のみ |

## Phase 1: 計画

臭い: 重複、長関数、命名、責務過多、マジック値

```markdown
## Refactor Plan
- **対象:** paths per stack layout
- **手順:** 各ステップ後に test command from stack.md
```

## Phase 2: 実行

```text
1 変更 → test (stack.md) → 次
```

- `layout` 配置規約を維持
- stack notes のエントリポイント・binding 名を変えない（該当時）

バグ発見 → `project-debugging` へ中断

## Phase 3: 完了

- [ ] test_all + typecheck（あれば）Pass
- [ ] 大規模 → `project-code-review`
- [ ] workflow-state がある場合 [update-workflow-state.py](../../hooks/update-workflow-state.py) で `phases.implementation: done` を disk 更新（挙動不変リファクタ専用。bypass 時は TDD ループを経ずここで完了）

### bypass（Middle+ で testspec / Red テストを省略）

**条件（すべて）:** 挙動不変、既存 test_all Pass、公開 API / 契約変更なし。

1. workflow-state 作成時に `bypass.reason: refactor-no-behavior-change` を YAML に設定（Phase C または refactor 開始前）
2. Hook が `phases.testspec` / `phases.tests` / `gates.testspec` チェックをスキップし build-agent 委譲を許可
3. **新機能・契約変更では bypass 不可**

## Guidelines

挙動不変 / テストが安全網 / 小ステップ / doc は必要時のみ
