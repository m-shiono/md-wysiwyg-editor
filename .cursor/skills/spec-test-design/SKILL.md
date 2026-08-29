---
name: spec-test-design
description: >
  仕様・問題文から体系的にテストケースを設計し、境界値・エッジケース・ストレステストの漏れを防ぐ。
  doc/ 配下にテスト仕様書を作成し、テストマトリクスとテストコード（Vitest 等）の両方を出力する。
  アルゴリズム問題・API/Worker 仕様のいずれにも対応。
  「テストケース」「境界値」「エッジケース」「仕様に沿ったテスト」「テスト仕様書」
  「サンプルケース」「網羅性確認」と言われたとき、または新機能・アルゴリズム実装前に必ず使う。
---

# Spec-Driven Test Design

仕様遵守とエッジケース網羅を、**実装前の仕様分解**と**セルフチェックゲート**で強制する。

## 適用範囲

| ドメイン | 入力ソース例 | テストコード先 |
|---------|-------------|--------------|
| アルゴリズム / 競技プログラミング | 問題文、入出力制約 | `tests/` またはユーザー指定 |
| API / Worker / アプリケーション | `doc/systemspec.md`、OpenAPI、機能仕様 | `test_file_glob` from [doc/stack.md](../../../doc/stack.md) |

**Phase 1 と Phase 2 が完了するまで、テストコード・実装コード（本編）を出力してはならない。**

## 実行プロトコル

```text
[Phase 1: 仕様分解 & 制約抽出]
[Phase 2: テストマトリクス & 計算量見積もり]
  └── ユーザー確認（仕様ギャップがある場合は必須）
[Phase 3: テスト仕様書 + テストコード + セルフチェック]
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

Phase 3 では **3 つの成果物** を必ず作成する。

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

### 2. テストコード

実装規約: [references/test-code-patterns.md](references/test-code-patterns.md)

**配置ルール:**

| ドメイン | 配置先 | フレームワーク |
|---------|-------|--------------|
| 本リポジトリ（TS） | `tests/<module>/<feature>.test.ts` | Vitest |
| アルゴリズム（汎用） | ユーザー指定 or `tests/<feature>.test.ts` | Vitest / プロジェクト標準 |
| 実行のみ（競プロ verify） | `scripts/verify-<feature>.ts` 等 | プロジェクトに合わせる |

**命名規則:**
- `describe` / テスト名は **What**（何を検証するか）を述べる
- TC ID をコメントまたはテスト名に含める（例: `TC-003: returns -1 when no solution exists`）

**P2（ストレス）の扱い:**
- テストコードには `@slow` タグまたは `describe.skip` + コメントで CI 分離を明示
- テスト仕様書の「実行方針」節に P2 の CI 扱いを記載

### 3. セルフチェック

[references/agent-check-matrix.md](references/agent-check-matrix.md) の A〜E を ✅ / N/A / ⚠️ で埋め、テスト仕様書末尾に貼る。

**P0 + P1** について [references/output-templates/trace-template.md](references/output-templates/trace-template.md) で机上トレースまたは実行結果を提示する。

### Phase 3 完了ゲート

- [ ] `doc/testspec-<feature-slug>.md` が作成・更新された
- [ ] テストコードが P0 + P1 をカバーしている
- [ ] Self-Check Report が全項目記入済み
- [ ] Spec Gaps が ⚠️ の項目は「未実装」または「要仕様確認」として明記

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
3. Phase 3:
   - `doc/testspec-<feature-slug>.md` を書き込む
   - テストコードを書き込む
   - Self-Check Report + トレース結果をチャットに提示

Phase 3 では **doc 作成をテストコードより先** に行う（仕様書が単一の正とする）。

---

## 追加リソース

- ドメイン索引: [references/domain-routing-index.md](references/domain-routing-index.md)
- チェックリスト: [references/agent-check-matrix.md](references/agent-check-matrix.md)
- カテゴリ一覧: [references/category-catalog.md](references/category-catalog.md)
- テストコード規約: [references/test-code-patterns.md](references/test-code-patterns.md)
- ドメインパターン: [references/domain-patterns/](references/domain-patterns/)
- 出力テンプレート: [references/output-templates/](references/output-templates/)
