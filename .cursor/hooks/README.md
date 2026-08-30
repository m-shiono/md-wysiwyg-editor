# Cursor Hooks — Workflow Gates

プロジェクト共有の Hook。要件ワークフロー（上流）と仕様ワークフロー（下流 SDD）の逸脱を検知・抑制する。

## 構成

| Hook / CLI | 用途 |
|------------|------|
| Session reminder | `sessionStart` — ワークフロー要約をコンテキスト注入 |
| Requirements gate | `gate-requirements-workflow.py` — 要件 Brief・UD・workflow-state |
| Specification gate | `gate-specification-workflow.py` — phase / artifact / gates / Strict TDD |
| Verifier gate | `gate-verifier-workflow.py` — mid-pipeline gate 前提（phase / 先行 gate） |
| Stop nudge | `requirements-stop-check.py` — Intent のみ存在時に follow-up |
| **update-workflow-state.py** | subagent が **disk 上の** workflow-state を更新（必須） |
| **init-workflow-state.py** | main（要件フェーズ完了）が workflow-state をテンプレートから作成 |
| **archive-workflow-state.py** | タスク完了時に workflow-state を `temporary/archive/` へ移動（または `--delete`） |

設定: [hooks.json](../hooks.json)

## workflow-state の disk 更新（必須）

Hook は `temporary/workflow-state-<task-id>.yaml` **実ファイル**を読む。handoff の `## Workflow state` だけでは不十分。

```bash
python3 .cursor/hooks/update-workflow-state.py --task-id <slug> \
  --phase spec --phase-status done \
  --artifact systemspec_section='§3.2 Feature'

python3 .cursor/hooks/update-workflow-state.py --task-id <slug> \
  --gate spec --gate-status done
```

手順: [update-workflow-state.md](../skills/_shared/update-workflow-state.md)

## Requirements gate（上流）

`failClosed: true`（Hook 障害時も deny）。

### spec-agent 委譲を deny する条件

Hook は `subagent_type`（または `description`）が `spec-agent` のときのみ評価する。

1. Intent Brief のみで Requirements Brief がない（Phase B スキップ）
2. Requirements Brief 内に `UD-*` が `status: open`
3. Intent Brief の `triage` が Middle/Large だが `workflow-state-<task-id>.yaml` がない
4. workflow-state があるが `gates.requirements` が `done` / `skipped` 以外

### requirements-agent 委譲を deny する条件

1. `temporary/intent-brief-*.md` がない（Phase A スキップ）

### スキップされるケース（Trivial / Small）

Intent Brief も Requirements Brief もない → spec-agent 委譲は許可（Middle 未満の想定）。

## Specification gate（下流 SDD）

Hook は `test-agent` / `build-agent` 委譲時のみ評価。`failClosed: true`。

**task_id スコープ:** 委譲プロンプトに `Task ID: <slug>` を含める。複数 workflow-state がある場合、Task ID なしは deny。

### test-agent 委譲を deny する条件（Middle/Large、`bypass.reason` 未設定）

1. `phases.spec` が `done` / `skipped` 以外
2. `phases.spec: done` だが `artifacts.systemspec_section` 欠落、または systemspec に該当節がない
3. `gates.spec` が `done` / `skipped` 以外（verifier spec-gate 未完了）

### build-agent 委譲を deny する条件（Middle/Large、`bypass.reason` 未設定）

1. `phases.testspec` が `done` / `skipped` 以外
2. `phases.testspec: done` だが `artifacts.testspec` ファイルが存在しない
3. `gates.testspec` が `done` / `skipped` 以外（verifier testspec-gate 未完了）
4. **`phases.tests` が `done` / `skipped` 以外（Red テスト未実装）**
5. **`phases.tests: done` だが P0 TC ID が tests/ 内のテストコードに見つからない**

### スキップされるケース
- `bypass.reason` が設定されている（例: `refactor-no-behavior-change`）
- 対象 task_id の state のみ評価（他タスクの未完了 phase は無視）

### verifier 中間ゲート（Hook 連動）

| ゲート | verifier 実行後の disk 更新 |
|--------|----------------------------|
| requirements-gate | `gates.requirements: done` |
| spec-gate | `gates.spec: done` |
| testspec-gate | `gates.testspec: done` |

Hook が `gates.*` を検証するため、**verifier 省略不可**。

### verifier 委譲ゲート（品質ゲート前提）

`gate-verifier-workflow.py` は `verifier` 委譲時、プロンプト内のゲート種別キーワード（`requirements-gate` / `spec-gate` / `testspec-gate`）に応じて **先行フェーズ完了** を検証する。キーワードなしは**最終受け入れ**とみなし、`phases.implementation` / `phases.review` の完了を検証する（workflow-state がある Middle+ のみ）。

| キーワード | deny 条件（Middle/Large、`bypass.reason` 未設定） |
|-----------|-----------------------------------------------------|
| `requirements-gate` | Middle+ Intent Brief があるが workflow-state 欠落、または `phases.requirements` が `done` / `skipped` 以外 |
| `spec-gate` | `gates.requirements` 未完了、または `phases.spec` 未完了、または spec artifact 欠落 |
| `testspec-gate` | `gates.spec` 未完了、または `phases.testspec` 未完了、または testspec ファイル欠落 |
| （キーワードなし＝最終受け入れ） | `phases.implementation` または `phases.review` が未完了 |

委譲プロンプト例: `Task ID: my-feature` + `Goal: spec-gate`（キーワード必須）。

## workflow-state のライフサイクル（並行タスク）

| タイミング | 操作 |
|-----------|------|
| 要件フェーズ完了（Phase C 完了、または Phase C スキップ後の Advisor Defaults 確認後） | `init-workflow-state.py --task-id <slug>` — **requirements-gate verifier より前** |
| タスク完了（verifier 最終 pass） | `archive-workflow-state.py --task-id <slug>`（**推奨**）または `--delete` |
| 新タスク開始 | 別 `task_id` を使う。完了済み state を残したまま並行可だが、委譲には **Task ID 必須** |
| 中断・キャンセル | state ファイルを削除するか、`bypass.reason: cancelled` + 全 phase `skipped` を記録 |

古い workflow-state が残ると Hook が複数 state を検出し Task ID なし委譲を deny する。週次またはタスク完了時に `temporary/workflow-state-*.yaml` を整理する。

## 依存関係

- `python3`（stdlib のみ）
- `bash`（sessionStart）

```bash
chmod +x .cursor/hooks/*.sh .cursor/hooks/*.py
python3 .cursor/hooks/test_workflow_state.py -v
python3 .cursor/hooks/test_gate_e2e.py -v
python3 .cursor/hooks/test_doc_links.py -v
python3 .cursor/hooks/test_doc_drift.py -v
```

## デバッグ

手動確認は **`subagent_type` と `Task ID` を含める**:

```bash
# tests 未完了で build-agent（deny 期待）
cat > temporary/workflow-state-demo.yaml <<'EOF'
task_id: demo
triage: middle
feature_slug: demo
phases:
  requirements: done
  spec: done
  testspec: done
  tests: pending
  implementation: pending
  review: pending
gates:
  requirements: done
  spec: done
  testspec: done
artifacts:
  intent_brief: temporary/intent-brief-demo.md
  requirements_brief: temporary/requirements-brief-demo.md
  systemspec_section: "§9.1 Demo"
  testspec: doc/testspec-demo.md
bypass:
  reason: null
EOF
echo '{"tool_input":{"subagent_type":"build-agent","prompt":"Task ID: demo"}}' \
  | python3 .cursor/hooks/gate-specification-workflow.py
rm temporary/workflow-state-demo.yaml
```

## 関連

- [requirement-thinking/SKILL.md](../skills/requirement-thinking/SKILL.md)
- [update-workflow-state.md](../skills/_shared/update-workflow-state.md)
- [review-lifecycle.md](../skills/_shared/review-lifecycle.md)
- [development.md](../../doc/development.md)

## failClosed 時の切り分け（Runbook）

`hooks.json` の `preToolUse` ゲートは `failClosed: true` のため、Hook スクリプト自体が失敗すると **すべての Task 委譲が deny** される。

### 症状

- 任意の subagent 委譲が即 deny され、workflow 逸脱メッセージではなく Hook 実行エラー
- Cursor の Hook ログに Python traceback や `permission: deny` が連続

### 切り分け手順

1. **ローカルで Hook を手動実行**（委譲と同じ JSON を stdin に渡す）:

```bash
echo '{"tool_input":{"subagent_type":"build-agent","prompt":"Task ID: demo"}}' \
  | python3 .cursor/hooks/gate-specification-workflow.py
```

2. **Python 3 が利用可能か確認**: `python3 --version`（stdlib のみで可）

3. **実行権限**: `chmod +x .cursor/hooks/*.py .cursor/hooks/*.sh`

4. **テストスイート**: リポジトリ root で以下が Pass するか確認

```bash
python3 .cursor/hooks/test_workflow_state.py -v
python3 .cursor/hooks/test_gate_e2e.py -v
```

5. **一時的な回避**（緊急時のみ）: `.cursor/hooks.json` で該当 Hook の `failClosed` を `false` に変更 → 問題修正後に **必ず true に戻す**

6. **workflow-state 未作成で deny** される場合: [requirement-thinking](../skills/requirement-thinking/SKILL.md) に従い `init-workflow-state.py` を requirements-gate **より前**に実行

---

## バックログ（技術的負債）

| 項目 | 理由 | 優先度 |
|------|------|--------|
| `_workflow_state.py` の regex YAML パーサを stdlib / 最小パーサへ | 手動編集・複雑な scalar で誤パースのリスク | P2 |
| `review-agent` 委譲ゲート（`phases.implementation` 前提） | 実装前レビューの無駄を防ぐ（最終 verifier で止まるため緊急度は低） | P3 |
