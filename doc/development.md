# 開発ガイド

ローカル開発、品質チェック、Cursor を使った AI 支援開発の手順をまとめる。

- システム振る舞いの正本: [systemspec.md](./systemspec.md)
- コーディング・命名規約: [coding-conventions.md](./coding-conventions.md)
- テスト仕様のレイアウト: [testspec-readme.md](./testspec-readme.md)
- デプロイ / CI: [deployment.md](./deployment.md)（整備予定）
- AI エージェントの入口: [AGENTS.md](../AGENTS.md)
- **スタック定義（言語・テスト・レイアウト）:** [stack.md](./stack.md)（整備予定）

## このリポジトリの位置づけ

| フェーズ | 内容 |
|----------|------|
| **現在** | Cursor テンプレート（rules / agents / skills / doc 骨格）を試作・完成させる |
| **テンプレート完成後** | テンプレート用ファイル群を **別リポジトリ（テンプレート管理）** に移植 |
| **その後（本フォルダ）** | テンプレートを取り込んだうえで **vsc-md-editor 固有の開発** を進める |

テンプレート側は **言語非依存の工程**（spec-first、subagent、testspec）を担い、各アプリリポジトリは **stack.md + スタック別 rules/skills** で具体化する。

---

## 前提

### 共通（テンプレート）

- Git 管理されたリポジトリ
- `doc/systemspec.md` を振る舞いの正本とする（Specification-first）
- Cursor: [`.cursor/`](../.cursor/) 配下の rules / agents / skills
- 一時ファイルは `temporary/` のみ（コミットしない）

### スタック（アプリごとに `doc/stack.md` で宣言）

テンプレートは **特定ランタイムに固定しない**。採用スタックは `doc/stack.md`（または `.cursor/stack.yaml`）に書き、agents / rules がそこを参照する。

| 区分 | 例 |
|------|-----|
| **言語** | TypeScript, JavaScript, Python, Go, その他 |
| **実行環境** | Node.js, Cloudflare Workers, コンテナ, CLI, バッチ |
| **テストランナー** | Vitest, Jest, pytest, go test, 等 |
| **パッケージ管理** | npm/pnpm, uv/poetry, go modules, 等 |
| **型チェック** | tsc, pyright, mypy, go build, 等 |

`doc/stack.md` 未整備の間は、下表を **暫定プロファイル** として扱う（本リポジトリ完成後に 1 つに確定）。

| プロファイル | 言語 | テスト | 品質コマンド例 |
|-------------|------|--------|----------------|
| TS/JS (Node) | TypeScript / JavaScript | Vitest / Jest | `npm test`, `npm run typecheck` |
| TS (Workers) | TypeScript | Vitest | 上記 + Wrangler |
| Python | Python 3.12+ | pytest | `uv run pytest`, `uv run pyright` |
| Go | Go | `go test` | `go test ./...`, `go vet` |

---

## リポジトリ構成

### テンプレート共通（言語非依存）

```text
.cursor/
├── rules/
│   ├── project-conventions.mdc   # spec-first、執筆ルール（共通）
│   ├── orchestrator.mdc            # メインセッション委譲
│   └── <stack>.mdc                 # スタック別（例: typescript.mdc, python.mdc）
├── agents/                         # ロール別サブエージェント
└── skills/                         # 工程別スキル
AGENTS.md
doc/
├── systemspec.md
├── testspec-*.md
├── development.md                  # 本ファイル
├── stack.md                        # 採用スタック宣言（アプリで必須）
└── deployment.md
temporary/                          # 生成物のみ
```

### アプリケーションコード（スタック依存）

レイアウトは `doc/stack.md` に従う。例:

```text
# TypeScript / Workers 例
src/{core,services,utils}/
tests/

# Python 例
src/<package>/
tests/{unit,integration}/

# Go 例
cmd/
internal/
*_test.go
```

---

## 品質コマンド

**正本は `doc/stack.md` の Quality commands 節。** 未整備時は採用プロファイルのコマンドを使う。

```bash
# TypeScript / Vitest（例）
npm run typecheck
npm test
npx vitest run path/to/file.test.ts

# Python / pytest（例）
uv run pytest
uv run pyright

# Go（例）
go test ./...
go vet ./...
```

仕様変更を伴う作業では、コード変更前に [Specification-first](#specification-first) を守る。

---

## Cursor 開発フロー

本リポジトリでは **メインセッション（オーケストレータ）** と **サブエージェント** に役割を分け、メインのコンテキスト消費を抑えながら開発する。

| レイヤ | 担当 | やること |
|--------|------|----------|
| メインセッション | ユーザー ↔ AI の窓口 | requirement-thinking、タスク分解、委譲、handoff の要約 |
| サブエージェント | バックグラウンド作業 | スキルに従った実装・doc・テスト・レビュー |

詳細なルール: [`.cursor/rules/orchestrator.mdc`](../.cursor/rules/orchestrator.mdc)

### ディレクトリの役割

| パス | 用途 |
|------|------|
| [`.cursor/rules/`](../.cursor/rules/) | 全セッション / ファイル種別ごとの規約 |
| [`.cursor/agents/`](../.cursor/agents/) | ロール別サブエージェント定義 |
| [`.cursor/skills/`](../.cursor/skills/) | 工程別の手順書（SKILL.md） |
| [`.cursor/hooks.json`](../.cursor/hooks.json) | 要件ワークフロー逸脱検知（Phase 3） |
| [AGENTS.md](../AGENTS.md) | 上記への索引と典型フロー |

### サブエージェント一覧

| Subagent | 主なスキル | 委譲する作業 |
|----------|-----------|-------------|
| `requirements-agent` | requirements-advisory | セキュリティ・コスト・運用・設計のアドバイザリ |
| `spec-agent` | project-systemspec-authoring, spec-change-propagation | systemspec、仕様波及、doc 起草 |
| `test-agent` | spec-test-design, testspec-implementation, bug-regression-test | testspec、テストコード、回帰 TC |
| `build-agent` | project-debugging, project-refactoring | 調査、実装、リファクタ |
| `review-agent` | project-code-review, project-security-review, doc-consistency-audit 等 | レビュー、監査 |
| `verifier` | requirements-gate-check | 要件ゲート（pre-spec）・最終受け入れ |
| `meta-agent` | project-self-retrospective, project-skill-triage | rules/skills/agents の改善 |

**メインセッションのみ:** `requirement-thinking` — ユーザーへの質問が必要なため（Middle 以上で実行）。

### 典型フロー

**新機能**

```text
main: requirement-thinking Phase A（Intent Capture）
  → requirements-agent（Advisory Panel → requirements-brief）
  → main: requirement-thinking Phase C（Decision Gate、UD-* のみ）
  → verifier（requirements-gate）
  → spec-agent（systemspec）
  → test-agent（testspec + テスト）
  → build-agent（実装）
  → review-agent（レビュー）
  → verifier（受け入れ）
```

**バグ修正**

```text
build-agent（debug / Repro Digest）
  → test-agent（回帰 TC）
  → build-agent（修正）
  → review-agent
  → verifier
```

**リファクタ（挙動不変）**

```text
build-agent → review-agent（大規模時） → verifier
```

**仕様変更**

```text
spec-agent（波及分析 + systemspec 更新）
  → test-agent → build-agent → review-agent → verifier
```

独立した作業は、依存がなければサブエージェントを **並列** で起動できる。

### メインセッションの進め方

1. **requirement-thinking** — Middle 以上: Phase A → `requirements-agent` → Phase C → `verifier`（requirements-gate）→ `spec-agent`
2. **分解** — SMART 基準でステップに分け、各ステップの担当 subagent を決める
3. **委譲** — Task ID、Goal、Acceptance criteria、入力パス（中身は貼らない）、制約
4. **handoff 確認** — [handoff-template.md](../.cursor/agents/handoff-template.md) 形式のみ読む
5. **ユーザー報告** — 要約のみ（ログ・diff 全文は載せない）

### handoff とは

サブエージェントが返す **短い構造化サマリー**（目安 40 行以内）。`status: blocked` 時はメインがユーザー判断または再委譲。

### Specification-first

振る舞い・要件・設計を変えるタスクでは **doc を先に更新** してからコードを触る。

1. `doc/systemspec.md` を読み、変更点を確定
2. `spec-agent` に doc 更新を委譲
3. `test-agent` / `build-agent` で testspec・テスト・実装
4. `review-agent` + `verifier` で完了確認

純リファクタ・typo・仕様影響なしの変更は doc 更新を省略できる。

### 開発者向けの使い方（Cursor UI）

1. チャットで要件を伝える — Middle 以上と判定された場合は `requirement-thinking` を実行
2. Agent が subagent 委譲を提案 → OK なら進行
3. Blockers が出たら回答
4. 完了時は verifier サマリーを確認

### Hooks（要件ワークフロー）

[`.cursor/hooks.json`](../.cursor/hooks.json) が `Task` 委譲時にフロー逸脱をブロックする。詳細: [`.cursor/hooks/README.md`](../.cursor/hooks/README.md)。

初回クローン後:

```bash
chmod +x .cursor/hooks/*.sh .cursor/hooks/*.py
```

ルール・スキル改善は `meta-agent`（[`.cursor/self-improvement.yaml`](../.cursor/self-improvement.yaml)）。

### 関連ドキュメント

- [AGENTS.md](../AGENTS.md)
- [coding-conventions.md](./coding-conventions.md)
- [testspec-readme.md](./testspec-readme.md)
- [`.cursor/rules/project-conventions.mdc`](../.cursor/rules/project-conventions.mdc)

---

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-08-29 | 初版。Cursor 開発フロー節を追加 |
| 2026-08-29 | テンプレート汎用化 — stack.md、templates/rules、skills/agents の stack 参照 |
| 2026-08-29 | coding-conventions.md への参照を追加 |
| 2026-08-29 | dig を requirement-thinking に統一。トリアージ閾値 Middle を明記 |
| 2026-08-29 | 2 層 dig — requirements-agent、アドバイザリーパネル、Requirements Brief を追加 |
| 2026-08-29 | Phase 2 — frontend/backend/infra チェックリスト、review-lifecycle、requirements-gate-check |
| 2026-08-29 | Phase 3 — Cursor Hooks（委譲ゲート、session リマインド、stop follow-up） |
