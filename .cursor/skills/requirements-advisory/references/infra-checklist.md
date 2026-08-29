# Infra Checklist（要件段階）

実行環境・ネットワーク・デプロイ基盤の観点。`doc/stack.md` の `runtime` / `layout` を前提とする。

## 実行環境

- [ ] ターゲットランタイム（サーバーレス、コンテナ、VM 等）は `AD-*` で提案できるか
- [ ] リージョン・マルチ AZ / マルチリージョンの要否は明確か
- [ ] スケール方式（水平・垂直、オートスケール）の方針はあるか

## ネットワーク・境界

- [ ] 公開 / 非公開の境界（VPC、WAF、CDN）は定義できるか
- [ ] 内向き・外向き通信の許可リストは想定できるか
- [ ] TLS / 証明書管理の方針はあるか

## 構成・ IaC

- [ ] 環境分離（dev / staging / prod）の方針はあるか
- [ ] 設定・シークレットの注入方法は `doc/stack.md` の `secrets_policy` と整合するか
- [ ] インフラ変更のレビュー・適用手順は触れているか

## 障害・復旧

- [ ] RTO / RPO の目安はあるか（operations-checklist と重複時は統合）
- [ ] ディザスタリカバリの要否は検討したか

## 出力

インフラ選定のビジネストレードオフ → `UD-*`。スタック整合のデフォルト → `AD-*`。

実装後: [review-lifecycle.md](../../_shared/review-lifecycle.md)、[doc/deployment.md](../../../doc/deployment.md)（整備時）。
