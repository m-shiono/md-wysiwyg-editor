# Security Checklist（要件段階）

実装前に `requirements-agent` が確認する。実装後は [project-security-review/SKILL.md](../../project-security-review/SKILL.md)。対応表: [review-lifecycle.md](../../_shared/review-lifecycle.md)。

## 認証・認可

- [ ] 公開エンドポイント / トリガーの認証要件は明確か
- [ ] ロール・権限モデルは最小権限か
- [ ] セッション / トークンの有効期限・失効方針はあるか

## データ・秘密情報

- [ ] 個人情報・秘密情報の分類と保存場所は定義されているか
- [ ] ログ・エラー応答に秘密が漏れない設計か
- [ ] `doc/stack.md` の `secrets_policy` / `forbidden_secret_paths` に抵触しないか

## 入力・外部連携

- [ ] 信頼できない入力の検証ポイントは決まっているか
- [ ] 外部 API 呼び出しのタイムアウト・リトライ方針はあるか
- [ ] Webhook / コールバックの署名検証は必要か

## 運用セキュリティ

- [ ] レート制限・ abuse 対策は必要か
- [ ] 監査ログの要件はあるか
- [ ] インシデント時の連絡・ロールバック手順は触れているか

## 出力

未対応項目は `RK-NNN` として Requirements Brief に記載。対策案は `AD-NNN` で提案する。
