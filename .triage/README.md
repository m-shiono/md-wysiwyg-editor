# .triage — Cursor ハーネス自己改善

`meta-agent` の **self-retrospective → skill triage** ループ用の固定ディレクトリ。
プロダクト要件の作業用 [`temporary/`](../temporary/) とは別物。

## 構成

| パス | 内容 | Git |
|------|------|-----|
| `findings/` | 機械可読 findings（`*.json`） | ignore（再生成可） |
| `reports/` | 人間向けレポート（`self-retrospective.md`, `skill-triage-latest.md`） | ignore（再生成可） |
| `README.md` | 本ファイル | 追跡 |

## 設定の正本

[`.cursor/self-improvement.yaml`](../.cursor/self-improvement.yaml) が feedback パスと改善対象（rules / skills / agents / hooks）を定義する。

## 実行方法

1. `meta-agent` にセッション振り返りを委譲（`project-self-retrospective`）
2. 続けて skill triage（`project-skill-triage`）で accept 分のみ `.cursor/` へ小さく反映

詳細: [doc/development.md](../doc/development.md) · [AGENTS.md](../AGENTS.md)

## 運用

- **ディレクトリ構造**はリポジトリに残す（`findings/` / `reports/` の `.gitkeep`）
- **run 成果物**はローカル生成物。不要なら削除してよい
- チームで findings / reports を共有したい場合は、個別にコミットするか `.gitignore` の該当行を調整する
