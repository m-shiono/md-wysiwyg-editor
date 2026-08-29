# Cursor Hooks — Requirements Workflow

プロジェクト共有の Hook。2 層 `requirement-thinking` フローの逸脱を検知・抑制する。

## 構成

| Hook | イベント | スクリプト | 動作 |
|------|---------|-----------|------|
| Session reminder | `sessionStart` | `session-requirements-reminder.sh` | ワークフロー要約をコンテキスト注入 |
| Delegation gate | `preToolUse` (`Task`) | `gate-requirements-workflow.py` | 委譲順序・UD 未解決をブロック |
| Stop nudge | `stop` | `requirements-stop-check.py` | Intent のみ存在時に follow-up |

設定: [hooks.json](../hooks.json)

## Delegation gate のルール

### spec-agent 委譲を deny する条件

Hook は `subagent_type`（または `description`）が `spec-agent` のときのみ評価する。プロンプト本文でのエージェント名言及は無視する。

1. `temporary/intent-brief-*.md` があるのに `temporary/requirements-brief-*.md` がない（Phase B スキップ）
2. Requirements Brief 内に `UD-*` が `status: open` のまま残っている

### requirements-agent 委譲を deny する条件

`subagent_type`（または `description`）が `requirements-agent` のときのみ評価する。

1. `temporary/intent-brief-*.md` がない（Phase A スキップ）

### スキップされるケース（Trivial / Small）

Intent Brief も Requirements Brief もない → spec-agent 委譲は許可（Middle 未満の想定）。

## 依存関係

- `python3`（stdlib のみ）
- `bash`（sessionStart）

Hook スクリプトは実行可能であること:

```bash
chmod +x .cursor/hooks/*.sh .cursor/hooks/*.py
```

## デバッグ

Cursor の **Hooks** 設定タブまたは **Hooks** 出力チャンネルで確認する。`hooks.json` 保存後に自動リロード。読み込まれない場合は Cursor を再起動。

手動確認は **`subagent_type` を必ず含める**（プロンプト本文だけでは評価しない — meta-agent 等の誤検知防止）:

```bash
# Phase B スキップ検知（deny 期待）
echo '{"tool_input":{"subagent_type":"spec-agent"}}' \
  | python3 .cursor/hooks/gate-requirements-workflow.py

# ゲート対象外（allow 期待 — spec-agent 以外は評価しない）
echo '{"tool_input":{"subagent_type":"meta-agent","prompt":"spec-agent を更新"}}' \
  | python3 .cursor/hooks/gate-requirements-workflow.py
```

## 関連

- [requirement-thinking/SKILL.md](../skills/requirement-thinking/SKILL.md)
- [requirements-gate-check/SKILL.md](../skills/requirements-gate-check/SKILL.md)
- [review-lifecycle.md](../skills/_shared/review-lifecycle.md)
