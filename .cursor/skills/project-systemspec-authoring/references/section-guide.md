# Systemspec Section Guide

## Inputs & Types

- API: path / query / header / body を分けて表にする
- アルゴリズム: 変数 N, M と配列・グラフの形式を明記
- 「空を許すか」を必ず書く（空配列、空文字、body なし）

## Outputs & Failure Returns

- HTTP: status + body スキーマ
- 関数: 戻り値型 + 解なし時（`-1`, `null`, throw）
- **同じ失敗理由で複数表現しない**（404 vs 空配列 など一つに固定）

## Behavior vs Related Tests

| systemspec | testspec |
|-----------|----------|
| 何が起きるか | どう検証するか |
| 「未認証なら 401」 | TC-010: 401 without Authorization header |
| 制約 N ≤ 10^5 | TC-100: N=10^5 @slow |

## 改訂履歴

- `doc/systemspec.md` 末尾の **改訂履歴** に追記
- 節内にも Spec Gaps があればその節に ⚠️ を残す

## 非互換変更

- 旧挙動 → 新挙動を明記
- `spec-change-propagation` スキルを次に提案
