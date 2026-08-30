---
name: requirement-thinking
description: >
  Middle 以上の要件整理。メインは Class U（方向性・ビジネス判断）のみユーザーと会話し、
  技術デフォルトは requirements-agent 委譲で決める。Phase C は UD-* のみ質問。
  「requirement-thinking して」「要件を整理して」と言われたとき、
  または新機能・振る舞い変更でトリアージが Middle 以上と判定されたときに使う。
---

メインセッション専用。ユーザーには **方向性・ビジネス判断（Class U）のみ** を聞く。
技術的デフォルトは `requirements-agent` が決め、メインはその結果を要約して提示する。

参照: [decision-taxonomy.md](references/decision-taxonomy.md)

## トリアージ（閾値: Middle）

着手前に規模を判定する。**Middle 未満は本スキルをスキップ**し、該当フローへ直行する。

| レベル | 目安 | アクション |
|--------|------|------------|
| **Trivial** | typo、コピー、フォーマット、コメントのみ。振る舞い・仕様への影響なし | スキップ → 直接 `build-agent` または doc 修正 |
| **Small** | 既存パターン内の単一モジュール変更、既知 repro のバグ修正、挙動不変リファクタ、doc のみ | スキップ → 直接委譲。**workflow-state を作らない**（バグ修正分岐: [development.md](../../../doc/development.md#バグ修正のトリアージ分岐)） |
| **Middle** | 新機能・振る舞い追加、API 契約変更、認可・認証、外部連携、永続データモデル変更、本番運用への影響 | **本スキルを実行** — Intent Brief の `triage: Middle` を必須 |
| **Large** | 新システム、マルチサービス、コンプライアンス要件、大規模アーキテクチャ変更 | **本スキルを実行** |

### Middle 判定チェック（いずれか 1 つでも該当 → Middle 以上）

- [ ] ユーザー向けの新しい振る舞い・画面・API を追加する
- [ ] 既存 API / データ形式の互換性に影響する
- [ ] 認証・認可・個人情報・秘密情報の扱いが変わる
- [ ] 外部サービス・ネットワーク・永続ストアを新たに使う
- [ ] 本番の可用性・コスト・運用プロセスに影響する

判定結果は質問開始前にユーザーへ 1 行で共有する。**Intent Brief の Metadata に `triage` を必ず記録**する（Hook が Middle/Large を検証）。

### bypass（挙動不変リファクタ等）

Middle 判定だが **振る舞い変更なし** で testspec / Red テストを省略する場合のみ、Phase C 完了後に workflow-state の `bypass.reason` を設定する（例: `refactor-no-behavior-change`）。詳細: [project-refactoring/SKILL.md](../project-refactoring/SKILL.md)。

## 2 層フロー（Phase A/B/C）

```text
Phase A: Intent Capture（メイン）→ intent-brief
Phase B: Advisory Panel（requirements-agent 委譲）→ requirements-brief
Phase C: Decision Gate（メイン）→ UD-* のみ質問
完了 → verifier（requirements-gate）→ spec-agent
```

---

## Phase A — Intent Capture

**聞くこと（Class U のみ）:** 対象ユーザー・解く問題、スコープ In/Out、既知の期限・予算・コンプライアンス、優先順位の原則。

**聞かないこと（Class A）:** 認証実装、DB 選定、キャッシュ、ログ設計など → Phase B へ委譲。

環境を調べれば分かる事実は自分で確認する。質問は一度に一つ。フォーマットは Phase C と同じ。

**出力:** `temporary/intent-brief-<task-id>.md`（[intent-brief-template.md](references/intent-brief-template.md) 準拠、10〜20 行）

Intent が十分なら **Phase B へ `requirements-agent` を委譲**する（handoff テンプレート準拠のプロンプト）。

---

## Phase B — Advisory Panel（委譲）

メインは実行しない。`requirements-agent` に委譲し、handoff の `decision_summary` のみ読む。

| handoff 値 | メインの動き |
|------------|-------------|
| `user_decisions_required: 0` | Phase C をスキップし、Advisor Defaults の要約をユーザーに提示して確認 → **workflow-state 作成** → `verifier`（requirements-gate） |
| `user_decisions_required: > 0` | Phase C へ |
| `status: blocked` | ブロッカーをユーザーに提示 |

---

## Phase C — Decision Gate

Requirements Brief の `UD-*` のみを質問する。各問に必ず含める:

- パネル合意の推奨案（デフォルト採用）
- 理由（1 行）
- 代替（あれば）
- 関連リスク `RK-*`（あれば）

**「推奨どおりで進める」** を明示的な選択肢にする。

質問フォーマット（`AskQuestion` / `AskUserQuestion` は使用しない）:

```
### ❓ UD-[番号]: [質問文]

[なぜこの判断がユーザーに必要か]

- **A** — [選択肢]（パネル推奨）
- **B** — [選択肢]
- **C** — 推奨どおりで進める

**推奨: A** — [パネル合意の理由]
```

Class A（`AD-*`）についてユーザーに質問してはならない。Advisor Defaults は要約のみ提示する。

全 `UD-*` が確定し、ユーザーが共通理解を確認するまで `spec-agent` へ進まない。

Phase C で確定した各 `UD-*` は Requirements Brief 上で `status: resolved` に更新する。

Phase C 完了後、または Phase C をスキップした場合は Advisor Defaults 確認後、**`verifier`（requirements-gate）** を実行する。`pass` のときのみ `spec-agent` へ委譲する。

### Workflow state（SDD フェーズ正本）

Middle / Large では **要件フェーズ完了時**（Phase C 完了、または Phase C スキップ後の Advisor Defaults 確認後）に workflow-state を **disk 作成**する。**`verifier`（requirements-gate）より前**に必ず実行する（Hook が未作成を deny）。

```bash
python3 .cursor/hooks/init-workflow-state.py --task-id <task-id> --triage middle
```

テンプレート: [workflow-state-template.yaml](references/workflow-state-template.yaml)。以降の更新は [update-workflow-state.py](../../hooks/update-workflow-state.py)。

- `phases.requirements: done`
- `gates.requirements: pending`（init 時点。**verifier** が pass 後に `done` を disk 更新）
- `artifacts.intent_brief` / `artifacts.requirements_brief` を Brief パスで埋める
- Trivial / Small では **作成しない**（Hook バイパス想定）

各 subagent は [_shared/update-workflow-state.md](../_shared/update-workflow-state.md) に従い、担当フェーズ完了時に **workflow-state ファイルを disk 更新**する（handoff 記載のみでは不十分）。

## Hook による強制（Phase 3）

[`.cursor/hooks.json`](../../hooks.json) が委譲順序を機械的に検証する（[hooks/README.md](../../hooks/README.md)）。

| 逸脱 | Hook の動作 |
|------|------------|
| Phase B スキップ（Intent のみで spec-agent） | `preToolUse` で deny |
| `UD-*` が open のまま spec-agent | `preToolUse` で deny |
| Phase A スキップで requirements-agent | `preToolUse` で deny |
| Middle+ で workflow-state 未作成のまま verifier（requirements-gate） | `preToolUse` で deny |
| Intent のみでセッション終了 | `stop` で follow-up |

Trivial / Small（Brief なし）は Hook を通過する。

---

## 終了時のまとめフォーマット

```
## まとめ

### トリアージ
- レベル: [Middle / Large]

### ユーザーが決めたこと（UD-*）
- ...

### 専門家パネルが決めたこと（AD-*、異議なし）
- ...

### リスク（RK-*）
- ...

### 成果物
- `temporary/intent-brief-<task-id>.md`
- `temporary/requirements-brief-<task-id>.md`
- `temporary/workflow-state-<task-id>.yaml`（Middle / Large のみ）

### 次のステップ
- disk: `init-workflow-state.py --task-id <task-id>`（Middle / Large — requirements-gate **より前**）
- agent: `verifier` — requirements-gate（UD-* resolved・Brief 整合）→ `gates.requirements: done`
- ゲート pass 後: `spec-agent` — Requirements Brief を入力に systemspec 執筆
- spec-agent 完了後: `verifier` — spec-gate → `test-agent`（spec-test-design）
- testspec-gate pass 後: `test-agent`（testspec-implementation / Red）→ `build-agent`
- build-agent 後: main（`tdd-red-green-loop` — Pass Phase 0 / Fail ループ）→ `review-agent` → `verifier` → `archive-workflow-state.py`
```
