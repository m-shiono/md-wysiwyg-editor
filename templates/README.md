# Cursor テンプレート — スタック別オーバーレイ

このディレクトリは **言語・ランタイム固有** の Cursor rules を置く。  
テンプレート本体（`.cursor/rules/project-conventions.mdc`, `orchestrator.mdc`, agents, skills）は言語非依存。

## 新規アプリリポジトリでの使い方

### 1. テンプレート本体を取り込む

テンプレート管理リポジトリから次をコピー（または submodule / sync スクリプト）:

```text
.cursor/rules/project-conventions.mdc
.cursor/rules/orchestrator.mdc
.cursor/agents/
.cursor/skills/
.cursor/hooks.json
.cursor/hooks/
AGENTS.md
doc/development.md
doc/coding-conventions.md
doc/testspec-readme.md
doc/stack.md.example
templates/
```

### 2. スタックを宣言

```bash
cp doc/stack.md.example doc/stack.md
# doc/stack.md を編集 — status: active, 言語, コマンド, layout
```

### 3. スタック別 rules を有効化

`doc/stack.md` の `cursor_rules` に列挙したファイルを `.cursor/rules/` にコピー:

```bash
# 例: TypeScript + Cloudflare Workers
cp templates/rules/typescript-workers.mdc .cursor/rules/
cp templates/rules/tests-typescript.mdc .cursor/rules/
```

[`.cursor/rules/README.md`](../.cursor/rules/README.md) のチェックリストを確認。

Hook スクリプトを実行可能にする:

```bash
chmod +x .cursor/hooks/*.sh .cursor/hooks/*.py
```

### 4. プロダクト doc を追加

- `doc/systemspec.md` — 振る舞いの正本
- `README.md` — セットアップ
- `doc/deployment.md` — CI/CD

## templates/rules/ 一覧

| ファイル | 用途 | globs |
|----------|------|-------|
| `typescript-workers.mdc` | TS + Cloudflare Workers | `src/**/*.ts` |
| `tests-typescript.mdc` | Vitest / Jest (TS) | `tests/**/*.ts` |
| `python.mdc` | Python アプリ | `src/**/*.py` |
| `tests-python.mdc` | pytest | `tests/**/*.py` |
| `go.mdc` | Go アプリ | `**/*.go` |
| `vscode-extension.mdc` | VS Code 拡張機能 | `src/**/*.ts` |
| `tests-vscode-extension.mdc` | 拡張機能統合テスト | `src/test/**/*.ts` |

必要なものだけコピーする。複数言語モノレポの場合は該当 glob ごとに複数有効化可。

## テンプレート更新の取り込み

アプリ repo 側:

1. テンプレート repo の変更を pull / sync
2. **上書き:** `orchestrator.mdc`, agents, 汎用 skills
3. **マージ注意:** `doc/stack.md`, `.cursor/rules/` のスタック rules, `doc/systemspec.md`

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-08-29 | 初版 |
| 2026-08-29 | hooks.json / hooks/ のコピー手順を追記 |
