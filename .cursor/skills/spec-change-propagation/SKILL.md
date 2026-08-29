---
name: spec-change-propagation
description: >
  doc/systemspec.md の変更内容を分析し、testspec・tests・README・deployment 等
  に波及する更新項目のチェックリストを出力する。
  「仕様変更した。何を直す？」「breaking change の波及」「systemspec 更新後の作業」
  と言われたとき、または非互換変更・機能追加の doc 更新直後に使う。
---

# Spec Change Propagation

`systemspec` 変更後に **何を更新すべきか** を漏れなく列挙する。
本スキルはチェックリスト生成が主。実際の更新は各スキルに委譲。

## 他スキルとの関係

```text
spec-change-propagation（本スキル: 何を直すか）
    ↓
project-systemspec-authoring（systemspec 修正）
spec-test-design（testspec 更新）
testspec-implementation（tests 更新）
doc-consistency-audit（最終確認）
```

## 実行プロトコル

```text
[Phase 1: 変更分類 & diff 把握]
[Phase 2: 波及マトリクス生成]
[Phase 3: 作業順序 & ゲート]
```

---

## Phase 1: Classify Change

### 読むもの

- `doc/systemspec.md` の diff（またはユーザー説明）
- 関連 `doc/testspec-*.md`
- [references/change-classification.md](references/change-classification.md)

### 変更種別（1 つ以上）

| 種別 | 例 |
|------|-----|
| **Additive** | 新エンドポイント、新オプション |
| **Behavioral** | 同入力で出力が変わる |
| **Breaking** | 削除、非互換、ステータスコード変更 |
| **Docs-only** | 誤記修正、既存実装との整合 |
| **Constraint** | 制約 min/max 変更 |

### Phase 1 出力

```markdown
## Change Summary
- **種別:** Additive / Behavioral / Breaking / ...
- **feature-slug(s):** ...
- **systemspec 節:** §X.Y
- **非互換:** はい / いいえ
```

---

## Phase 2: Propagation Matrix

[references/propagation-matrix.md](references/propagation-matrix.md) に従い、更新要否を ✅ 要 / ➖ 不要 / ⚠️ 要確認 で埋める。

### 標準チェック対象

| 成果物 | 要否 | 作業内容 |
|--------|------|---------|
| `doc/systemspec.md` 改訂履歴 | ✅ | 日付・節・概要 |
| `doc/testspec-<slug>.md` | | TC 追加/deprecated/Expected 変更 |
| `tests/**/*.test.ts` | | TC 実装・expected 更新 |
| `doc/development.md` | | 開発手順変更時 |
| `doc/deployment.md` | | デプロイ・env 変更時 |
| `README.md` | | セットアップ・使い方変更時 |
| `src/**` 実装 | | 仕様に合わせた修正 |

### TC への影響

| 変更種別 | testspec 操作 |
|---------|--------------|
| Additive | 新 TC 追加（P0/P1） |
| Behavioral | Expected 更新 + Trace 再実行 |
| Breaking | 旧 TC を ~~deprecated~~、新 TC 追加、移行注記 |
| Constraint | 境界 TC の Input/Expected 見直し |

---

## Phase 3: Action Order & Gate

### 推奨順序（Specification-first）

```text
1. systemspec 確定（project-systemspec-authoring）
2. testspec 更新（spec-test-design）
3. tests 更新（testspec-implementation）
4. 実装更新
5. doc-consistency-audit
6. その他 doc（README, deployment, ...）
```

### Breaking change 追加

- 改訂履歴に **BREAKING** タグ
- 旧挙動 TC を deprecated として testspec に残す期間を記載（任意）

### 完了ゲート（本スキル）

- [ ] 波及マトリクス全行が ✅ / ➖ / ⚠️
- [ ] 作業順序が提示されている
- [ ] 各 ✅ 行に **担当スキル** が紐づいている

---

## 追加リソース

- 変更分類: [references/change-classification.md](references/change-classification.md)
- 波及マトリクス: [references/propagation-matrix.md](references/propagation-matrix.md)
