# Change Classification

## Additive（追加）

- 新 API、新フィールド（任意）、新エラー種別（既存に影響なし）
- **波及:** testspec に新 TC。既存 TC は維持

## Behavioral（振る舞い変更）

- 同じ入力で出力・ステータスが変わる
- **波及:** 該当 TC の Expected 更新、Trace 再実行、実装修正

## Breaking（非互換）

- 削除、リネーム、必須化、ステータスコード変更、デフォルト値変更
- **波及:** 全関連 doc、移行注記、deprecated TC、README

## Docs-only（ドキュメントのみ）

- 実装と一致させる誤記修正
- **波及:** systemspec 改訂履歴。testspec/tests は実装が既に正なら不変

## Constraint（制約変更）

- min/max、文字数上限、タイムアウト
- **波及:** 境界 TC、P2 ストレス TC の見直し

## 複合

複数該当時は **最も強い種別** で作業順を決める: Breaking > Behavioral > Constraint > Additive > Docs-only
