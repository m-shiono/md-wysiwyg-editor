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
| **Small** | 既存パターン内の単一モジュール変更、既知 repro のバグ修正、挙動不変リファクタ、doc のみ | スキップ → `spec-agent` / `build-agent` / `test-agent` へ |
| **Middle** | 新機能・振る舞い追加、API 契約変更、認可・認証、外部連携、永続データモデル変更、本番運用への影響 | **本スキルを実行** |
| **Large** | 新システム、マルチサービス、コンプライアンス要件、大規模アーキテクチャ変更 | **本スキルを実行** |

### Middle 判定チェック（いずれか 1 つでも該当 → Middle 以上）

- [ ] ユーザー向けの新しい振る舞い・画面・API を追加する
- [ ] 既存 API / データ形式の互換性に影響する
- [ ] 認証・認可・個人情報・秘密情報の扱いが変わる
- [ ] 外部サービス・ネットワーク・永続ストアを新たに使う
- [ ] 本番の可用性・コスト・運用プロセスに影響する

判定結果は質問開始前にユーザーへ 1 行で共有する。

## 2 層フロー

```text
Phase A: Intent Capture（メイン）→ intent-brief
Phase B: Advisory Panel（requirements-agent 委譲）→ requirements-brief
Phase C: Decision Gate（メイン）→ UD-* のみ質問
完了 → spec-agent
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
| `user_decisions_required: 0` | Phase C をスキップし、Advisor Defaults の要約をユーザーに提示して確認 |
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

Phase C 完了後、**`verifier`（requirements-gate）** を実行する。`pass` のときのみ `spec-agent` へ委譲する。

## Hook による強制（Phase 3）

[`.cursor/hooks.json`](../../hooks.json) が委譲順序を機械的に検証する（[hooks/README.md](../../hooks/README.md)）。

| 逸脱 | Hook の動作 |
|------|------------|
| Phase B スキップ（Intent のみで spec-agent） | `preToolUse` で deny |
| `UD-*` が open のまま spec-agent | `preToolUse` で deny |
| Phase A スキップで requirements-agent | `preToolUse` で deny |
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

### 次のステップ
- agent: `verifier` — requirements-gate（UD-* resolved・Brief 整合）
- ゲート pass 後: `spec-agent` — Requirements Brief を入力に systemspec 執筆
```
