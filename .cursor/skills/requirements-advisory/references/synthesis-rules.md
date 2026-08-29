# Synthesis Rules

パネル視点を Requirements Brief に統合するルール。

## 並列レビュー視点

| 観点 | チェックリスト |
|------|----------------|
| Security | [security-checklist.md](security-checklist.md) |
| Cost | [cost-checklist.md](cost-checklist.md) |
| Operations | [operations-checklist.md](operations-checklist.md) |
| Design / Architecture | [project-design-review/SKILL.md](../../project-design-review/SKILL.md) の Design questions |
| Frontend | [frontend-checklist.md](frontend-checklist.md)（UI ありの場合。なければ Trace に N/A） |
| Backend | [backend-checklist.md](backend-checklist.md) |
| Infra | [infra-checklist.md](infra-checklist.md) |

`doc/stack.md` を読み、スタック固有の制約を各視点に反映する。

実装後レビューとの対応: [_shared/review-lifecycle.md](../../_shared/review-lifecycle.md)

## 対立時のエスカレーション

1. 同一論点で推奨が矛盾 → **Class B** として `UD-NNN` を 1 件にまとめる
2. 優先度が Intent Brief に書いてあればそれに従う
3. 優先度未定 → メインセッションへ `UD-NNN` として 1 問に集約
4. 軽微な差異 → より保守的・運用負荷の低い案を `AD-NNN` のデフォルトにする

## Brief への書き込み優先順位

1. `User Decisions Required`（`UD-*`）— 未決のみ
2. `Advisor Defaults`（`AD-*`）— 採用推奨
3. `Risks`（`RK-*`）— 情報提供
4. `Panel Dissent` — 対立の要約（ユーザー向け要約は 3 行以内）

## ユーザー向け要約（メインセッション用）

handoff の `decision_summary` に数値のみ返す。詳細は Brief ファイルを参照させる。
