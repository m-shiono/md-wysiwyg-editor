---
name: bug-regression-test
description: >
  バグ報告・再現手順から最小の回帰テストケースを設計し、
  doc/testspec-*.md に追記してテストコードを実装する（ランナーは doc/stack.md）。
  網羅設計ではなく再発防止に特化。
  「回帰テスト」「バグの TC」「再現手順からテスト」「この不具合をテスト化」
  と言われたとき、または bugfix PR にテスト追加が必要なときに使う。
---

# Bug Regression Test

**目的:** 報告された不具合が **再発しない** ことを 1（＋必要なら 2）本の TC で固定する。
`spec-test-design` の網羅設計は行わない。最小再現に集中。

## 他スキルとの関係

| 段階 | スキル |
|------|--------|
| 原因未特定・再現不安 | `project-debugging` で Repro Digest を先に完成 |
| 仕様に根拠がない挙動 | `project-systemspec-authoring` で systemspec 先に更新 |
| TC 設計・testspec 追記 | **本スキル** |
| テストコード | 本スキル Phase 3 または `testspec-implementation` |
| 監査 | `doc-consistency-audit` |

**入力:** `project-debugging` の Repro Digest（根本原因欄が埋まっていること）を Phase 1 の起点として使える。

## 実行プロトコル

```text
[Phase 1: 再現条件の最小化]
[Phase 2: 回帰 TC を testspec に追記]
[Phase 3: テスト実装 & 再現確認]
```

---

## Phase 1: Minimize Repro

### 入力

- バグ説明、再現手順、期待 vs 実際、関連 issue/PR
- 関連 `doc/systemspec.md` 節、`doc/testspec-<slug>.md`

### 出力: Repro Digest

```markdown
## Repro Digest

- **feature-slug:** `<slug>`
- **症状:** [一行]
- **根本原因（仮説）:** ...
- **最小入力 / 操作:** ...
- **期待:** ...
- **実際（修正前）:** ...
- **systemspec 根拠:** §X.Y / ⚠️ 仕様未定義 → systemspec 更新要
```

### ゲート

- 再現手順が **3 ステップ以内** に縮められている
- 仕様未定義なら **systemspec 更新を先** に提案（Specification-first）

---

## Phase 2: Append to Testspec

[references/regression-tc-template.md](references/regression-tc-template.md) に従い `doc/testspec-<slug>.md` を更新。

### TC 命名

- ID: 既存 max + 1（例: TC-042）
- `domain_tag`: `regression`, `bug-<issue-id>`
- Priority: **P0**（回帰は CI 常時実行）
- `rationale`: `Regression: [症状] (issue #N)`

### testspec 更新内容

1. Test Matrix に 1 行追加
2. Trace Results に「修正前 Fail → 修正後 Pass」予定を記載
3. 改訂履歴に追記

**既存 TC の Expected がバグにより誤っていた場合:** 該当 TC を更新し、改訂履歴に **Behavioral fix** と明記。

---

## Phase 3: Implement & Verify

### テスト実装

[../spec-test-design/references/test-code-patterns.md](../spec-test-design/references/test-code-patterns.md) に従う。

```typescript
it('TC-042: regression — [symptom] (issue #123)', () => {
  // 最小再現
});
```

### 確認フロー

1. **修正前コード** で Fail することを確認（可能なら）
2. **修正後** で Pass
3. testspec Trace Results を Pass + 日付で更新

### 完了ゲート

- [ ] testspec に回帰 TC が追記済み
- [ ] テストコードが TC ID 1:1
- [ ] テスト実行 Pass（doc/stack.md の test runner）
- [ ] systemspec に該当振る舞いが記載（または更新済み）

---

## 追加リソース

- TC 追記形式: [references/regression-tc-template.md](references/regression-tc-template.md)
