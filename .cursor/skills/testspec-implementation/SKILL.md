---
name: testspec-implementation
description: >
  既存の doc/testspec-*.md からテストコードを実装する（ランナーは doc/stack.md 参照）。
  TC ID と testspec の Test Matrix を 1:1 で対応させ、P0/P1 を優先実装する。
  「testspec からテスト実装」「TC をコード化」「テスト仕様書どおりにテスト書いて」
  と言われたとき、または testspec のみ merge 済みで tests/ が未整備のときに使う。
---

# Testspec Implementation

**入力の正:** `doc/testspec-<feature-slug>.md`（`spec-test-design` で作成済みを想定）

開始時: [_shared/read-stack.md](../_shared/read-stack.md) → [doc/stack.md](../../../doc/stack.md)（`test_file_glob`, `test_single`）

設計 Phase は行わない。testspec にないテストを追加する場合は **先に testspec を更新** する。

## 他スキルとの関係

| 前 | 本スキル | 後 |
|----|---------|-----|
| `spec-test-design`（testspec 作成） | テストコード実装 | 実装・`doc-consistency-audit` |
| `bug-regression-test`（回帰 TC 追記後） | 該当 TC のみ実装 | — |

## 実行プロトコル

```text
[Phase 1: testspec 読込 & ギャップ確認]
[Phase 2: テストファイル実装]
[Phase 3: 実行・Trace 更新・完了ゲート]
```

---

## Phase 1: Ingest Testspec

### 読むもの

1. 対象 `doc/testspec-<feature-slug>.md` 全文
2. リンク先 `doc/systemspec.md` の該当節
3. [../spec-test-design/references/test-code-patterns.md](../spec-test-design/references/test-code-patterns.md)
4. 既存テスト（`test_file_glob` from stack.md）

### 確認すること

| チェック |  action |
|---------|--------|
| Test Matrix に TC ID がある | 実装対象リストを作成 |
| 期待値が空 / ⚠️ | 実装停止 → ユーザー or `spec-test-design` |
| testspec のテストコードパス | そのパスに書く |
| P0/P1 未実装 TC | Phase 2 のスコープ |

### Phase 1 出力

```markdown
## Implementation Plan
- **testspec:** doc/testspec-<slug>.md
- **出力先:** tests/.../....test.ts
- **実装 TC:** TC-001, TC-002, ...（P0/P1）
- **skip:** TC-100 (P2 @slow) — 理由
- **testspec 更新要否:** なし / あり（理由）
```

---

## Phase 2: Write Tests

### 規約（必須）

- 各 `it()` に **TC ID** を含める: `it('TC-003: ...', ...)`
- testspec の Input / Expected をそのまま使う（実装に合わせて expected を変えない）
- `describe` は機能単位、名前は **What**
- P2 は `it.skip` + `@slow` コメント

### 実装順

1. P0 全件
2. P1 全件
3. P2（testspec で実装対象とされている場合のみ）

### API / Worker

[../spec-test-design/references/domain-patterns/api-worker.md](../spec-test-design/references/domain-patterns/api-worker.md) の assert 規約に従う（status + body + header）。

---

## Phase 3: Run & Update Trace

### 実行

[doc/stack.md](../../../doc/stack.md) の `test_single` を使用（例: `npx vitest run <path>` / `uv run pytest <path>`）。

失敗時:
- **実装バグ** → 本スキルではテスト expected を変えず、実装修正を提案
- **testspec 誤り** → testspec を先に修正してから本スキルを再実行

### testspec 更新

Trace Results 節に実行結果を追記（Pass/Fail、日付）。
[../spec-test-design/references/output-templates/trace-template.md](../spec-test-design/references/output-templates/trace-template.md) 形式。

### 完了ゲート

- [ ] P0 + P1 の全 TC がテストコードに存在（1:1）
- [ ] テスト実行 Pass（stack.md の test runner）
- [ ] testspec の Trace Results を更新
- [ ] testspec にない `it()` がない
- [ ] `temporary/workflow-state-<task-id>.yaml` が存在すれば [update-workflow-state.py](../../hooks/update-workflow-state.py) で `phases.tests: done` を disk 更新

---

## 追加リソース

- テストコード規約: [../spec-test-design/references/test-code-patterns.md](../spec-test-design/references/test-code-patterns.md)
