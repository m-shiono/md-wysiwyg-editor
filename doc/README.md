# Documentation index

製品ドキュメントの索引（AD-001）。内容の二重掲載はしない。各正本へのリンクのみ。

## Requirements（要求）

| 正本 | 説明 |
|------|------|
| [requirements/systemspec.md](requirements/systemspec.md) | 振る舞い仕様（WHAT） |
| [requirements/backlog-vsc-md-wysiwyg.md](requirements/backlog-vsc-md-wysiwyg.md) | MVP 外 backlog |

## Design（設計）

| 正本 | 説明 |
|------|------|
| [design/architecture.md](design/architecture.md) | AD-* 要約・HOW 境界・レイヤ方針 |

## Test（テスト仕様）

| 正本 | 説明 |
|------|------|
| [test/testspec-readme.md](test/testspec-readme.md) | testspec レイアウト |
| [test/testspec-vsc-md-wysiwyg.md](test/testspec-vsc-md-wysiwyg.md) | 主機能 testspec |
| [test/testspec-native-preview-side-and-default-raw.md](test/testspec-native-preview-side-and-default-raw.md) | Default Preview / 初期 Raw |
| [test/mermaid/testspec-mermaid.md](test/mermaid/testspec-mermaid.md) | Mermaid 統合 testspec |
| [test/mermaid/archive/](test/mermaid/archive/) | Mermaid 旧個別 testspec（参照用） |

## Deploy / Operations

| 正本 | 説明 |
|------|------|
| [deploy/deployment.md](deploy/deployment.md) | Marketplace 公開手順 |
| [operations/operations.md](operations/operations.md) | 利用者・作者向け最小運用 |

## Tooling（`.cursor` 寄せ — AD-002）

| 正本 | 説明 |
|------|------|
| [../.cursor/stack.md](../.cursor/stack.md) | スタックプロファイル |
| [../.cursor/development.md](../.cursor/development.md) | 開発・Cursor フロー |
| [../.cursor/coding-conventions.md](../.cursor/coding-conventions.md) | コーディング規約 |

旧フラットパス（`doc/stack.md` · `doc/systemspec.md` · `doc/testspec-*.md` 等）は互換スタブのみ（AD-003）。`.cursor/stack.md` 等は正本（AD-002）。

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-09-19 | doc-reorg: 索引新設。製品 doc を requirements / design / test / deploy / operations に分類 |
