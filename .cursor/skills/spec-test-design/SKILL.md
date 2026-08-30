---
name: spec-test-design
description: >
  仕様・問題文から体系的にテストケースを設計し、境界値・エッジケースの漏れを防ぐ。
  doc/testspec-*.md を作成する（テストコードは testspec-implementation が担当）。
  「テストケース」「境界値」「testspec」と言われたとき、または新機能実装前の設計時に使う。
---

# Spec-Driven Test Design

仕様遵守とエッジケース網羅を、**実装前の仕様分解**と**セルフチェックゲート**で強制する。

## 適用範囲

| ドメイン | 入力ソース例 | テストコード（後続） |
|---------|-------------|-------------------|
| アルゴリズム / 競技プログラミング | 問題文、入出力制約 | `testspec-implementation` → `tests/` |
| API / Worker / アプリケーション | `doc/systemspec.md`、OpenAPI、機能仕様 | `testspec-implementation` → `test_file_glob` from [doc/stack.md](../../../doc/stack.md) |

**Phase 1 と Phase 2 が完了するまで、テストコード・実装コード（本編）を出力してはならない。**

## 実行プロトコル

```text
[Phase 1: 仕様分解 & 制約抽出]
[Phase 2: テストマトリクス & 計算量見積もり]
  └── ユーザー確認（仕様ギャップがある場合は必須）
[Phase 3: テスト仕様書（doc/testspec-*.md）+ セルフチェック]
```

---

## Phase 1: Specification Ingestion

### 入力ソースの優先順位

1. `doc/systemspec.md`（本リポジトリの機能仕様）
2. ユーザー提供の問題文 / 仕様 / OpenAPI
3. 既存実装（**参照のみ**。テストは仕様から導く。実装に合わせてテストを歪めない）

### 必須読込

- [references/agent-check-matrix.md](references/agent-check-matrix.md)
- [references/category-catalog.md](references/category-catalog.md)
- [references/domain-routing-index.md](references/domain-routing-index.md) — 追加参照の判定

### ドメイン判定 → 追加読込

[references/domain-routing-index.md](references/domain-routing-index.md) のキーワード表に従い、該当する `domain-patterns/*.md` をすべて読む。

主要ドメイン（詳細は索引）:

| 領域 | 参照 |
|------|------|
| 木・グラフ | `domain-patterns/tree-graph.md` |
| DP | `domain-patterns/dynamic-programming.md` |
| 二分探索 | `domain-patterns/binary-search.md` |
| 累積和・スライド窓 | `domain-patterns/prefix-sum-window.md` |
| ソート・ハッシュ | `domain-patterns/sorting-hash.md` |
| 文字列・テキスト | `domain-patterns/string-text.md` |
| グリッド・マトリクス | `domain-patterns/grid-matrix.md` |
| 整数・数学 | `domain-patterns/integer-math.md` |
| API / Worker | `domain-patterns/api-worker.md` |
| 非同期・冪等性 | `domain-patterns/async-idempotency.md` |

### Phase 1 出力: Spec Digest

```markdown
## Spec Digest

### Inputs & Types
| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |

### Outputs & Failure Returns
| 条件 | 戻り値 | 仕様根拠 |

### Preconditions & Assumptions
- （ソート済み、連結グラフ前提、認証必須 など）

### Complexity Budget
- 制約上限 → 許容計算量 → 想定アルゴリズム family

### Spec Gaps（仕様未定義・曖昧）
- ⚠️ [項目]: [内容] → Phase 2 前にユーザー確認
```

---

## Phase 2: Edge Case & Boundary Matrix

[references/output-templates/test-matrix-template.md](references/output-templates/test-matrix-template.md) の形式でテストマトリクスを設計する。

### 最低保証ルール

| 優先度 | 必須内容 |
|-------|---------|
| **P0** | 問題文サンプル ≥ 1、代表一般ケース ≥ 1 |
| **P1** | 各制約の min/max ≥ 1、解なしケース ≥ 1（該当時）、先頭/末尾一致 ≥ 1（探索系） |
| **P2** | 最悪計算量入力 ≥ 1（該当アルゴリズム family がある場合）、制約上限のランダム生成 ≥ 1 |

[references/category-catalog.md](references/category-catalog.md) の 5 カテゴリすべてを検討し、該当しない場合は `N/A` と理由を記録する。

### Phase 2 完了ゲート

- [ ] P0 全件が具体入力・期待値付きで定義されている
- [ ] 各 TC に `rationale`（何を検出するか）がある
- [ ] Spec Gaps が ⚠️ のまま残る場合、ユーザーに確認を取った

---

## Phase 3: Deliverables & Self-Check

Phase 3 では **2 つの成果物** を必ず作成する（**テストコードは書かない** — [testspec-implementation](../testspec-implementation/SKILL.md) へ委譲）。

### 1. テスト仕様書（`doc/` 配下）

**ファイル名:** `doc/testspec-<feature-slug>.md`

- `<feature-slug>`: 対象機能の kebab-case（例: `user-auth`, `markdown-parse`, `two-sum`）
- 同一機能の更新時は既存ファイルを更新し、**改訂履歴**に追記

テンプレート: [references/output-templates/test-spec-doc-template.md](references/output-templates/test-spec-doc-template.md)

含める内容:
- Spec Digest（Phase 1）
- テストマトリクス全文（Phase 2）
- Self-Check Report（Phase 3 末尾）
- 対象仕様へのリンク（`doc/systemspec.md` の節、または問題文）
- **実行方針** — P2（`@slow` / nightly）の CI 扱い、想定テスト配置（`test_file_glob` 参照）

testspec 内の TC 命名・配置の正本は [references/test-code-patterns.md](references/test-code-patterns.md)（実装は testspec-implementation が参照）。

### 2. セルフチェック

[references/agent-check-matrix.md](references/agent-check-matrix.md) の A〜E を ✅ / N/A / ⚠️ で埋め、テスト仕様書末尾に貼る。

**P0 + P1** について [references/output-templates/trace-template.md](references/output-templates/trace-template.md) で**机上トレース**を提示する（実行結果は testspec-implementation 以降）。

### Phase 3 完了ゲート

- [ ] `doc/testspec-<feature-slug>.md` が作成・更新された
- [ ] Test Matrix に P0 TC が 1 件以上ある（P1 は推奨）
- [ ] Self-Check Report が全項目記入済み
- [ ] Spec Gaps が ⚠️ の項目は「未実装」または「要仕様確認」として明記
- [ ] テストコードは **未実装**（`testspec-implementation` へ委譲）

---

## 他スキル・プロジェクトルールとの連携

| 状況 | スキル |
|-----|------|
| 仕様そのものに穴がある | `requirement-thinking` |
| `doc/systemspec.md` が未整備 | `project-systemspec-authoring` |
| testspec のみ存在し tests 未実装 | `testspec-implementation` |
| 仕様変更後の波及 | `spec-change-propagation` |
| 四者整合確認 | `doc-consistency-audit` |
| バグ回帰 TC | `bug-regression-test` |
| `doc/systemspec.md` と矛盾 | **doc を先に修正**（Specification-first） |
| 実装完了後のレビュー | `project-code-review` |

---

## 出力順序（厳守）

1. Phase 1: Spec Digest（チャットに提示）
2. Phase 2: テストマトリクス（チャットに提示 → Spec Gaps あれば確認）
3. Phase 3（testspec ドキュメントのみ — テストコードは testspec-implementation へ）:
   - `doc/testspec-<feature-slug>.md` を書き込む
   - workflow-state がある場合 [update-workflow-state.py](../../hooks/update-workflow-state.py) で disk 更新:
     - `phases.testspec: done`
     - `artifacts.testspec: doc/testspec-<slug>.md`
   - Self-Check Report をチャットに提示

**Strict TDD:** テストコードは本スキルでは書かない。`test-agent`（testspec-implementation）→ `phases.tests: done` → `build-agent` の順。

---

## 追加リソース

- ドメイン索引: [references/domain-routing-index.md](references/domain-routing-index.md)
- チェックリスト: [references/agent-check-matrix.md](references/agent-check-matrix.md)
- カテゴリ一覧: [references/category-catalog.md](references/category-catalog.md)
- テストコード規約: [references/test-code-patterns.md](references/test-code-patterns.md)
- ドメインパターン: [references/domain-patterns/](references/domain-patterns/)
- 出力テンプレート: [references/output-templates/](references/output-templates/)
