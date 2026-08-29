# Async, Idempotency & Retry Patterns

**適用条件:** 非同期 API、Webhook、キュー、Worker、二重送信・リトライ

## 冪等性 (Idempotency)

| パターン | 検出目的 | 期待 |
|---------|---------|------|
| 同一 POST 2 回 | 二重作成防止 | 409 / 同一 id 返却 |
| Idempotency-Key ヘッダ | キー相同 | 2 回目も 201 同 body |
| キー異なる同一 body | 別リソース | 2 つの 201 |
| PUT/PATCH 再送 | 最終状態一致 | 同結果 |
| DELETE 2 回 | 削除冪等 | 2 回目 404 or 204 |

## 非同期・順序

| パターン | 検出目的 |
|---------|---------|
| 並行 2 リクエスト | 競合・lost update |
| 先着 / 後着 | タイムスタンプ・version |
| 処理中の再 poll | 202 → 200 遷移 |
| タイムアウト後の完了 | 中途半端状態 |

## リトライ・Webhook

| パターン | 期待 |
|---------|------|
| 5xx でクライアントリトライ | 副作用 1 回のみ |
| Webhook 再送（同 event id） | 重複処理しない |
| 部分失敗 + 補償 | ロールバック or 補正 Job |
| at-least-once 配信 | 冪等 consumer |

## Worker / キュー固有

| パターン | 検出目的 |
|---------|---------|
| scheduled 重複実行 | 同一 cron 窓 |
| メッセージ 2 回 dequeue | exactly-once 偽装 |
| 処理中 Worker クラッシュ | 再実行で整合 |

## テスト設計のヒント

- 時刻は `vi.useFakeTimers()` または inject 可能 clock
- 2 回目呼び出しは **同一 TC 内** または **ペア TC**（TC-020a/b）で明示
- 外部 API mock: 1 回目成功・2 回目失敗などシーケンスを `mockImplementationOnce` で

## api-worker との関係

HTTP ステータス・認証は [api-worker.md](api-worker.md)。本ファイルは **時間軸・再実行** に焦点。
