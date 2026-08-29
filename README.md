# cursor-coding-template

Cursor 向けの spec-first 開発テンプレート（rules / agents / skills / hooks）。

## Quick start

1. [doc/stack.md](doc/stack.md) をアプリ用に整備（`status: active`）
2. [templates/README.md](templates/README.md) からスタック rules をコピー
3. Hook を有効化:

```bash
chmod +x .cursor/hooks/*.sh .cursor/hooks/*.py
```

4. 新機能（Middle+）: [requirement-thinking](.cursor/skills/requirement-thinking/SKILL.md) → [requirements-agent](.cursor/agents/requirements-agent.md) → spec/test/build フロー

## リポジトリ構成（主要）

| パス | 役割 | Git |
|------|------|-----|
| `.cursor/` | rules、agents、skills、hooks | 追跡 |
| `doc/` | systemspec、stack、開発ガイド | 追跡 |
| `templates/` | スタック別 rules テンプレート | 追跡 |
| `temporary/` | 要件整理の作業用 Brief 等 | **ignore** |
| `.triage/` | meta-agent 自己改善ループの成果物 | 構造のみ追跡（[README](.triage/README.md)） |

## Docs

- [AGENTS.md](AGENTS.md) — エージェント索引
- [doc/development.md](doc/development.md) — 開発フロー
- [.cursor/hooks/README.md](.cursor/hooks/README.md) — Hook 仕様
- [.triage/README.md](.triage/README.md) — 自己改善ループ（findings / reports）

## 自己改善ループ

rules / skills / agents の改善は `meta-agent` が担当。設定は [`.cursor/self-improvement.yaml`](.cursor/self-improvement.yaml)。各 run の JSON / レポートは `.triage/` に出力され、`.gitignore` で除外される（再実行で再生成可能）。
