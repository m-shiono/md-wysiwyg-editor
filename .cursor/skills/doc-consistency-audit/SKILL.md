---
name: doc-consistency-audit
description: >
  doc/systemspec.md、doc/testspec-*.md、tests/、実装コードの四者整合を監査し、
  乖離・テスト漏れ・仕様外テストをレポートする。
  「仕様とテストの整合」「doc ドリフト」「テスト漏れ洗い出し」「spec と実装の差分」
  と言われたとき、または PR 前・リリース前の確認に使う。
---

# Doc Consistency Audit

**監査対象（四者）:**

```text
doc/systemspec.md  … WHAT
doc/testspec-*.md  … HOW TO VERIFY
tests/**/*.ts      … 自動検証
src/**             … 実装
```

修正は本スキルでは行わない。レポート後、必要に応じて各スキルへ誘導する。

## 他スキルとの関係

| 検出結果 | 次のアクション |
|---------|--------------|
| systemspec 不足 | `project-systemspec-authoring` |
| testspec 不足 / TC 欠落 | `spec-test-design` |
| tests 未実装 | `testspec-implementation` |
| 仕様変更の波及 | `spec-change-propagation` |
| コード品質全般 | `project-code-review` |

## 実行プロトコル

```text
[Phase 1: スコープ & ファイル収集]
[Phase 2: 四者マッピング]
[Phase 3: 乖離レポート]
```

---

## Phase 1: Scope

### 入力

- 監査対象 `<feature-slug>` または PR 変更ファイル
- 未指定時: 変更 diff から feature を推定

### 収集

| ソース | パス |
|--------|------|
| 機能仕様 | `doc/systemspec.md` § 該当節 |
| テスト仕様 | `doc/testspec-<slug>.md` |
| テスト | testspec 記載パス + grep TC ID |
| 実装 | `src/` 該当モジュール |

[references/audit-checklist.md](references/audit-checklist.md) を読む。

---

## Phase 2: Cross-Mapping

### 2a. systemspec → testspec

| 観点 | 検証 |
|------|------|
| 各 Outputs & Failure Returns | 対応 TC が testspec にあるか |
| 各 Precondition | 境界 TC でカバーされているか |
| Spec Gaps ⚠️ | testspec にも ⚠️ または TC 保留と一致しているか |

### 2b. testspec → tests

| 観点 | 検証 |
|------|------|
| P0/P1 の各 TC ID | `tests/` に同名 `it('TC-xxx` があるか |
| Expected | assert が testspec と一致するか |
| P2 @slow | skip 等の扱いが testspec「実行方針」と一致するか |

### 2c. tests → testspec

| 観点 | 検証 |
|------|------|
| testspec にない `it()` | **仕様外テスト** として列挙 |
| ハードコード expected | testspec に根拠があるか |

### 2d. 実装 → systemspec

| 観点 | 検証 |
|------|------|
| 公開 API / エンドポイント | systemspec に記載があるか |
| エラーパス | Failure Returns と一致するか |
| 実装のみの分岐 | **undocumented behavior** として列挙 |

---

## Phase 3: Report

[references/report-template.md](references/report-template.md) 形式で出力。

### 深刻度

| レベル | 意味 |
|--------|------|
| **Critical** | 仕様と実装が矛盾。リリース前に必須修正 |
| **Warning** | testspec 未整備、P0/P1 未実装、undocumented behavior |
| **Info** | P2 未実装、ドキュメント体裁、改訂履歴未更新 |

### 完了条件

- [ ] 四者すべてをスコープに含めた（対象外は N/A 理由付き）
- [ ] Critical / Warning ごとに **推奨スキル** を記載
- [ ] ユーザーに修正順序を提案（systemspec → testspec → tests → src）

---

## 追加リソース

- チェックリスト: [references/audit-checklist.md](references/audit-checklist.md)
- レポート形式: [references/report-template.md](references/report-template.md)
