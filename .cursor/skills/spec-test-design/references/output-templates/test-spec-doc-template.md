# Test Specification Document Template

`doc/testspec-<feature-slug>.md` の雛形。Phase 3 でこの構造に従ってファイルを作成する。

---

```markdown
# Test Specification: [機能名 / 問題名]

## 概要

- **対象:** [一行説明]
- **対応仕様:** [doc/systemspec.md §X.Y](systemspec.md#...) または問題文リンク
- **テストコード:** `tests/[path]/[file].test.ts`
- **作成日:** YYYY-MM-DD

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|

### Outputs & Failure Returns

| 条件 | 戻り値 | 仕様根拠 |
|------|--------|---------|

### Preconditions & Assumptions

- ...

### Complexity Budget

- ...

### Spec Gaps

- （なし、または ⚠️ 項目リスト）

## Test Matrix

（[test-matrix-template.md](test-matrix-template.md) 形式の表をここに全文記載）

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | 通常 PR で実行 | |
| P2 | `@slow` / nightly | TC-XXX |

## Trace Results

（[trace-template.md](trace-template.md) 形式。P0 + P1）

## Self-Check Report

### A. Input & Constraints
- [x] ...

### B. Structural Patterns
- [x] ...

### C. Corner & Failure
- [x] ...

### D. Complexity & Resources
- [x] ...

### E. API / Worker（該当時）
- [x] ...

### Uncovered / Spec Gaps
- ...

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| YYYY-MM-DD | 初版作成 |
```

---

## ファイル命名規則

| ルール | 例 |
|-------|-----|
| プレフィックス | `testspec-` |
| slug | kebab-case、機能を表す |
| 配置 | 常に `doc/` 直下 |

例:
- `doc/testspec-markdown-render.md`
- `doc/testspec-two-sum.md`
- `doc/testspec-api-items.md`

## 更新ルール

- 仕様変更時: 対応する `doc/systemspec.md` を **先に** 更新してから本ファイルを更新
- 改訂履歴に日付と変更概要を追記
- TC ID は削除せず deprecated マーク（例: ~~TC-005~~ → 理由）

## 他ドキュメントとの関係

```text
doc/systemspec.md     … 振る舞いの正（WHAT）
doc/testspec-*.md     … 検証の正（HOW TO VERIFY）
tests/**/*.test.ts    … 実行可能な検証コード
```
