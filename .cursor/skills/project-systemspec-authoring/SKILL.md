---
name: project-systemspec-authoring
description: >
  doc/systemspec.md を Specification-first ルールに沿って作成・更新する。
  入出力・制約・失敗時戻り値・改訂履歴を必須セクションとして標準化し、
  testspec へのリンクを整備する。
  「systemspec」「要件定義」「機能仕様を doc に」「仕様書を書いて」と言われたとき、
  または新機能・振る舞い変更の doc 更新前に使う。
---

# Project Systemspec Authoring

`doc/systemspec.md` を **振る舞いの正（WHAT）** として執筆・更新する。
実装やテストの詳細は書かず、testspec・実装が参照できる粒度に留める。

## 他スキルとの関係

| 前 | 本スキル | 後 |
|----|---------|-----|
| `requirement-thinking` + `requirements-agent` | systemspec 執筆 | `spec-test-design`（testspec 設計） |
| `spec-change-propagation`（変更波及） | systemspec 更新 | `testspec-implementation` / 実装 |

**本スキル完了前に実装コード・テストコードを書いてはならない。**

## 実行プロトコル

```text
[Phase 1: コンテキスト収集 & 影響範囲]
[Phase 2: 仕様ドラフト（テンプレート準拠）]
[Phase 3: レビューゲート & doc 書き込み]
```

---

## Phase 1: Context & Scope

### 読むもの

- `temporary/requirements-brief-<task-id>.md`（存在する場合 — requirement-thinking 完了後）
- 既存 [doc/systemspec.md](../../../doc/systemspec.md)（存在する場合）
- 関連 `doc/testspec-*.md`（更新・新規の影響）
- [references/systemspec-template.md](references/systemspec-template.md)

### 確認すること

1. **新規機能** vs **既存機能の変更** vs **非互換変更**
2. 対象 `<feature-slug>`（testspec ファイル名と一致させる）
3. 関連 API / モジュール / 外部依存
4. 仕様未定義の論点 → Phase 2 で ⚠️ Spec Gaps として明示

### Phase 1 出力

```markdown
## Scope Summary
- **種別:** 新規 / 変更 / 削除 / 非互換
- **feature-slug:** `<slug>`
- **影響節:** systemspec §X.Y（新規なら「新規節」）
- **関連 testspec:** `doc/testspec-<slug>.md`（新規 / 更新 / 不要）
```

---

## Phase 2: Spec Draft

[references/systemspec-template.md](references/systemspec-template.md) に従いドラフトを作成。

### 必須セクション（省略不可）

| セクション | 内容 |
|-----------|------|
| 概要 | 一行 + スコープ |
| Inputs & Types | 型、最小・最大、必須/任意 |
| Outputs & Failure Returns | 成功・失敗・エラーコード |
| Preconditions | 暗黙前提（認証、ソート済み等） |
| Behavior | 正常系・例外系の振る舞い |
| Non-Goals | 今回やらないこと |
| Related Tests | `doc/testspec-<slug>.md` へのリンク |
| 改訂履歴 | 日付・変更概要 |

### 執筆ルール

- **検証方法（TC 一覧）は testspec に書く。** systemspec には期待値の羅列を置かない
- 数値制約は **min/max を明示**（`spec-test-design` の入力になる）
- 未定義の挙動は ⚠️ で残し、Phase 3 でユーザー確認
- 英語 JSDoc と整合する用語を使う（公開 API 名）

---

## Phase 3: Review Gate & Write

### 完了ゲート

- [ ] Inputs / Outputs / Failure Returns が表形式で埋まっている
- [ ] 改訂履歴行を追加した
- [ ] Related Tests に testspec パスがある（または「testspec 未作成・後続で spec-test-design」）
- [ ] Spec Gaps が ⚠️ の項目はユーザー確認済み、または意図的に未決として記録

### 書き込み

1. `doc/systemspec.md` を更新（新規節追加 or 既存節修正）
2. `temporary/workflow-state-<task-id>.yaml` が存在すれば [update-workflow-state.py](../../hooks/update-workflow-state.py) で disk 更新:
   - `phases.spec: done`
   - `artifacts.systemspec_section` に更新節（例: `§3.2 User API`）
3. チャットに **変更サマリ** と **次スキル提案** を提示:
   - 新規/変更 → `spec-test-design` または `spec-change-propagation`
   - 軽微な typo → testspec 不要ならスキップ可

---

## 追加リソース

- テンプレート: [references/systemspec-template.md](references/systemspec-template.md)
- 節の書き方: [references/section-guide.md](references/section-guide.md)
