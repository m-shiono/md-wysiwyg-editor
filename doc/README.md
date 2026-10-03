# Documentation index

製品ドキュメントの索引。各正本へのリンクのみを保持し、内容の二重掲載は行いません。

## Requirements（要求）

| 正本 | 説明 |
|------|------|
| [requirements/systemspec.md](requirements/systemspec.md) | 振る舞い仕様（WHAT） |
| [requirements/backlog.md](requirements/backlog.md) | MVP 外 backlog |

## Design（設計）

| 正本 | 説明 |
|------|------|
| [design/architecture.md](design/architecture.md) | AD-* 要約・HOW 境界・レイヤ方針 |

## Test（テスト仕様）

| 正本 | 説明 |
|------|------|
| [test/testspec-readme.md](test/testspec-readme.md) | testspec レイアウト・規約 |
| [test/testspec-vsc-md-wysiwyg.md](test/testspec-vsc-md-wysiwyg.md) | 主機能 testspec |
| [test/testspec-native-preview-side-and-default-raw.md](test/testspec-native-preview-side-and-default-raw.md) | Default Preview / 初期 Raw |
| [test/mermaid/testspec-mermaid.md](test/mermaid/testspec-mermaid.md) | Mermaid 統合 testspec |

## Operations（運用）

| 正本 | 説明 |
|------|------|
| [operations/operations.md](operations/operations.md) | 利用者・作者向け最小運用 |

## Tooling（開発ツール・規約）

開発フローやコーディング規約などの開発環境ルールは、リポジトリ規約に従い `.cursor/` 配下が正本です。

| 正本 | 説明 |
|------|------|
| [../.cursor/stack.md](../.cursor/stack.md) | スタックプロファイル |
| [../.cursor/development.md](../.cursor/development.md) | 開発・Cursor フロー |
| [../.cursor/coding-conventions.md](../.cursor/coding-conventions.md) | コーディング規約 |

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-19 | doc-reorg: 索引新設。製品 doc を requirements / design / test / deploy / operations に分類 |
| 2026-10-03 | doc 整理: 旧互換スタブおよび Mermaid 旧アーカイブを全廃。backlog リンク更新 |
| 2026-10-03 | doc 整理: Marketplace / Azure DevOps 関連ドキュメント（deploy/deployment.md）を削除 |
