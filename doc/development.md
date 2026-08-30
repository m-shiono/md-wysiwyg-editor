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

## ハーネス 3 レイヤー（DocDD / SDD / TDD）

AI エージェントハーネスは、開発の DocDD → SDD → TDD の考え方に対応づけて設計する。

| レイヤ | 役割 | ハーネス上の正本 | 主な仕組み |
|--------|------|------------------|-----------|
| **DocDD** | 振る舞い・検証の「真実のソース」 | `doc/systemspec.md`, `doc/testspec-*.md`, `.cursor/rules/` | Specification-first、`doc-consistency-audit` |
| **SDD** | フェーズ順序・必須条件・委譲ゲート | `temporary/workflow-state-<task-id>.yaml` | `orchestrator.mdc`、Hooks、handoff |
| **TDD** | 合格基準の自動検証 | testspec Test Matrix → テストコード | `spec-test-design`, `testspec-implementation`, `tdd-red-green-loop`, `verifier` |

### workflow-state（SDD のフェーズ正本）

Middle / Large タスクでは `requirement-thinking` **要件フェーズ完了時**（Phase C 完了、または Phase C スキップ後の Advisor Defaults 確認後）に `temporary/workflow-state-<task-id>.yaml` を作成する。`verifier`（requirements-gate）より前に必須。各 subagent は [update-workflow-state.py](../.cursor/hooks/update-workflow-state.py) で **disk 上の** `phases.*` / `gates.*` を更新する（handoff 記載のみでは Hook を通過しない）。

テンプレート: [workflow-state-template.yaml](../.cursor/skills/requirement-thinking/references/workflow-state-template.yaml) · 手順: [update-workflow-state.md](../.cursor/skills/_shared/update-workflow-state.md)

| phase / gate | 更新担当 | 意味 |
|--------------|---------|------|
| `phases.requirements` | main（Phase C または Phase C スキップ後） | Intent / Requirements Brief 完了 |
| `gates.requirements` | verifier | requirements-gate pass |
| `phases.spec` | spec-agent | systemspec 確定 |
| `gates.spec` | verifier | spec-gate pass |
| `phases.testspec` | test-agent（spec-test-design） | testspec ドキュメント確定 |
| `gates.testspec` | verifier | testspec-gate pass |
| `phases.tests` | test-agent（testspec-implementation） | Red テスト実装（Strict TDD） |
| `phases.implementation` | main（tdd-red-green-loop）— Green 確定時 | `phases.implementation: done` + `tdd_loop.status: green` |
| `phases.implementation` | project-refactoring（bypass リファクタのみ） | 挙動不変リファクタ完了時 |
| `phases.review` | review-agent | レビュー完了 |

タスク完了（verifier 最終 pass）後: [archive-workflow-state.py](../.cursor/hooks/archive-workflow-state.py) `--task-id <slug>`（推奨。`temporary/archive/` へ移動）。

Trivial / Small では workflow-state を作らず、Hook は従来どおりバイパスする。

### Red-Green ループ（TDD — Strict）

**Strict TDD:** `build-agent` は `phases.tests: done`（Red テスト実装済み）後のみ Hook が許可する。

1. `test-agent`（spec-test-design）→ testspec doc
2. `verifier`（testspec-gate）→ `gates.testspec: done`
3. `test-agent`（testspec-implementation）→ Red テスト → `phases.tests: done`
4. `build-agent` → Green 化（`phases.implementation` は **更新しない** — `--tdd-status green` のみ）
5. メインが [tdd-red-green-loop](../.cursor/skills/tdd-red-green-loop/SKILL.md) — **Pass 時 Phase 0**（`implementation: done` 設定）/ **Fail 時ループ**（最大 3 回）

### ゲート一覧

| タイミング | 種別 | 実装 |
|-----------|------|------|
| spec-agent 委譲前 | 要件ゲート | Hook（UD / workflow-state / `gates.requirements`）+ verifier |
| test-agent 委譲前 | 仕様ゲート | Hook（spec phase / artifacts / `gates.spec`）+ verifier |
| build-agent 委譲前 | TDD + 仕様ゲート | Hook（testspec / `gates.testspec` / **`phases.tests`**）+ verifier |
| build-agent 後 | Green 確定 | メイン `tdd-red-green-loop` Phase 0（Pass）またはループ（Fail） |
| 実装完了後 | 受け入れ | `verifier` 最終チェック → `archive-workflow-state.py`

詳細: [`.cursor/skills/_shared/review-lifecycle.md`](../.cursor/skills/_shared/review-lifecycle.md)、[`.cursor/hooks/README.md`](../.cursor/hooks/README.md)

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
| [`.cursor/hooks.json`](../.cursor/hooks.json) | ワークフロー逸脱検知（要件ゲート + 仕様ゲート） |
| [AGENTS.md](../AGENTS.md) | 上記への索引と典型フロー |

### サブエージェント一覧

| Subagent | 主なスキル | 委譲する作業 |
|----------|-----------|-------------|
| `requirements-agent` | requirements-advisory | セキュリティ・コスト・運用・設計のアドバイザリ |
| `spec-agent` | project-systemspec-authoring, spec-change-propagation | systemspec、仕様波及、doc 起草 |
| `test-agent` | spec-test-design, testspec-implementation, bug-regression-test | testspec、テストコード、回帰 TC |
| `build-agent` | project-debugging, project-implementation, project-refactoring | 調査、実装、リファクタ |
| `review-agent` | project-code-review, project-security-review, doc-consistency-audit 等 | レビュー、監査 |
| `verifier` | requirements-gate-check, spec-gate-check, testspec-gate-check | 中間ゲート + 最終受け入れ |
| `meta-agent` | project-self-retrospective, project-skill-triage | rules/skills/agents の改善 |

**メインセッションのみ:** `requirement-thinking`（Middle+）、`tdd-red-green-loop`（build-agent 後 — workflow-state がある場合は Pass でも実行）

### 典型フロー

**新機能**

```text
main: requirement-thinking Phase A（Intent Capture）
  → requirements-agent（Advisory Panel → requirements-brief）
  → main: requirement-thinking Phase C（Decision Gate、UD-* のみ）
  → verifier（requirements-gate）
  → spec-agent（systemspec）
  → verifier（spec-gate）
  → test-agent（spec-test-design → testspec doc）
  → verifier（testspec-gate）
  → test-agent（testspec-implementation → Red テスト）
  → build-agent（実装 / Green — `tdd-status green` のみ disk 更新）
  → main（tdd-red-green-loop — Pass 時 Phase 0 / Fail 時ループ → `phases.implementation: done`）
  → review-agent（レビュー）
  → verifier（受け入れ）
  → archive-workflow-state.py（workflow-state 整理）
```

**バグ修正**

```text
build-agent（debug / Repro Digest）
  → test-agent（回帰 TC）
  → build-agent（修正）
  → review-agent
  → verifier
```

#### バグ修正のトリアージ分岐

| 条件 | トリアージ | フロー | workflow-state |
|------|-----------|--------|----------------|
| typo / 既知 repro / 単一モジュール / 振る舞い不変 | **Small** | 上記 Short flow 直行 | 作らない |
| 新機能領域のバグだが repro 明確・契約変更なし | **Small**（要 Intent Brief に `triage: Small` 記録） | Short flow | 作らない |
| 認可・データ契約・外部連携に関わる / repro 不明 | **Middle+** | requirement-thinking または既存 task の state を更新 → spec/test 波及 → 新機能フロー相当 | 新規作成または既存更新 |
| 既存 Middle+ task の follow-up | 既存 `task_id` 継続 | 未完了 phase から再開（Task ID 必須） | 既存ファイルを更新 |

振る舞い変更を伴うバグ修正（仕様との乖離が正しい等）は **仕様変更フロー** へ切り替える。

**リファクタ（挙動不変）**

```text
build-agent → review-agent（大規模時） → verifier
```

**仕様変更**

```text
spec-agent（波及分析 + systemspec 更新）
  → verifier（spec-gate）
  → test-agent（spec-test-design → testspec doc）
  → verifier（testspec-gate）
  → test-agent（testspec-implementation → Red テスト）
  → build-agent（実装 / Green）
  → main（tdd-red-green-loop — Pass 時 Phase 0 / Fail 時ループ）
  → review-agent
  → verifier（受け入れ）
  → archive-workflow-state.py
```

独立した作業は、依存がなければサブエージェントを **並列** で起動できる。

### メインセッションの進め方

1. **requirement-thinking** — Middle 以上: Phase A → `requirements-agent` → Phase C → `verifier`（requirements-gate）→ `spec-agent` → `verifier`（spec-gate）→ `test-agent`（spec-test-design）→ `verifier`（testspec-gate）→ `test-agent`（Red テスト）→ `build-agent` → **main（tdd-red-green-loop）** → `review-agent` → `verifier` → archive
2. **分解** — SMART 基準でステップに分け、各ステップの担当 subagent を決める
3. **委譲** — **Task ID**、Goal、Acceptance criteria、入力パス（中身は貼らない）、制約
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

### Hooks（ワークフローゲート）

[`.cursor/hooks.json`](../.cursor/hooks.json) が `Task` 委譲時にフロー逸脱をブロックする。詳細: [`.cursor/hooks/README.md`](../.cursor/hooks/README.md)。

| Hook | 対象 | 概要 |
|------|------|------|
| `gate-requirements-workflow.py` | spec-agent / requirements-agent | 要件 Brief・UD 未解決を検知（`failClosed: true`） |
| `gate-specification-workflow.py` | test-agent / build-agent | phase / artifact / gate / **tests** フェーズを検証（`failClosed: true`） |
| `gate-verifier-workflow.py` | verifier（中間・最終） | ゲート種別キーワードに応じた先行フェーズ完了を検証（`failClosed: true`） |

CLI: `archive-workflow-state.py` — タスク完了時の workflow-state 整理（推奨: archive、代替: `--delete`）。

初回クローン後:

```bash
chmod +x .cursor/hooks/*.sh .cursor/hooks/*.py
python3 -m unittest discover -s .cursor/hooks -p 'test_*.py'
# または
python3 .cursor/hooks/test_workflow_state.py
```

### ハーネス同期

テンプレート repo からアプリ repo へ agents / skills / hooks / doc 骨格を反映する CLI。

```bash
# 差分確認
./scripts/sync-harness.sh --target ../my-app --dry-run

# 初回（doc/stack.md が無ければ example から作成）
./scripts/sync-harness.sh --target ../my-app --init

# 本番 sync（managed ディレクトリは --delete — テンプレートから削除された skill も消える）
./scripts/sync-harness.sh --target ../my-app

# ハーネス本体のみ
./scripts/sync-harness.sh --target ../my-app --tier core --verify
```

| 区分 | 方針 |
|------|------|
| **managed** | `.cursor/agents/`, `.cursor/skills/`, `.cursor/hooks/`, 共通 rules — テンプレート正本、削除反映あり |
| **protect** | `doc/stack.md`, `doc/systemspec.md`, スタック rules — 上書きしない |
| **local overlay** | `.cursor/skills-local/` — sync 対象外（プロジェクト独自 skill） |

詳細: [scripts/README.md](../scripts/README.md) · マニフェスト: [scripts/harness-manifest.json](../scripts/harness-manifest.json)

アプリ repo では同期したハーネスを Git 追跡しない場合、[scripts/harness-gitignore.txt](../scripts/harness-gitignore.txt) を `.gitignore` に追加する（手順: [scripts/harness-gitignore.md](../scripts/harness-gitignore.md)）。

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
| 2026-08-30 | SDD Phase 3 — 要件ゲート failClosed、tdd-red-green-loop、implementation/review phase 更新 |
| 2026-08-30 | SDD Phase 2 — test-agent Hook、spec-gate / testspec-gate-check、仕様ゲート failClosed |
| 2026-08-30 | SDD 強化 — DocDD/SDD/TDD 3 レイヤー、workflow-state、build-agent 仕様ゲート Hook |
| 2026-08-30 | ハーネス改善 — init-workflow-state、Red テスト実在チェック、Hook CI、review/tdd disk 更新統一 |
| 2026-08-30 | ハーネス修正 — init 時 gates.requirements を pending に、Spec change フロー統一、spec-test-design Phase 3 整合 |
| 2026-08-30 | ハーネス Phase 4 — verifier Hook、バグ修正分岐表、workflow-state クリーンアップ指針、review フィードバック |
| 2026-08-30 | ハーネス Phase 5 — 最終 verifier の review フェーズ検証、P0 TC ID 命名バリアント（pytest/go） |
| 2026-08-30 | ドキュメント整合 — tdd-red-green-loop Phase 0、implementation Owner、archive 手順、sessionStart 同期 |
| 2026-08-30 | ハーネス同期 MVP — sync-harness.sh、manifest / protect、skills-local overlay |
| 2026-08-30 | ハーネス gitignore — harness-gitignore.txt / .md、manifest 追加時チェックリスト |
