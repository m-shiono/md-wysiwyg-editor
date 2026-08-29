---
name: project-debugging
description: >
  体系的デバッグ — エラー調査、テスト失敗の切り分け、原因不明の不具合、ブロッカー。
  doc/stack.md のスタックに従う。根本原因特定後は bug-regression-test へ引き渡す。
  「デバッグして」「原因調査」「テストが落ちる」「動かない」「ブロッカー」で使用。
---

# Debugging

**目的:** 証拠に基づき根本原因を特定。修正・回帰 TC は別スキル。

**開始時:** [_shared/read-stack.md](../_shared/read-stack.md) → [doc/stack.md](../../../doc/stack.md)

## 他スキルとの関係

| 状況 | スキル |
|------|--------|
| 設計・要件の穴 | `requirement-thinking` |
| 仕様未定義 | `project-systemspec-authoring` |
| **原因調査** | **本スキル** |
| 回帰 TC | `bug-regression-test` |
| リファクタ中の失敗 | `project-refactoring` |
| 整合確認 | `doc-consistency-audit` |

**引き渡し:** Repro Digest 完成 → `bug-regression-test`

---

## Phase 0: 分類

| 類型 | 典型症状 | 初動 |
|------|----------|------|
| **技術的** | 例外、型エラー、テスト Fail | ログ・スタック・最小再現 |
| **仕様不明** | 期待動作未定義 | systemspec 確認 → spec-agent |
| **環境** | ローカル/本番差 | `doc/development.md`, stack secrets/config |
| **外部依存** | API/サービス障害 | モックで切り分け |
| **テスト設計** | testspec と実装ズレ | doc-consistency-audit 観点 |

30 分進展なし → [blocker-report-template.md](references/blocker-report-template.md)

---

## Phase 1: 問題定義

```markdown
## 問題の定義
- **期待:** [systemspec / testspec TC]
- **実際:**
- **エラー / スタック:**
- **タイミング / 再現率:**
- **影響範囲:**
```

---

## Phase 2: 情報収集

### コマンド（stack.md から）

- `test_single` — 単一テスト
- `typecheck` — 型チェック（あれば）
- `test_all` — 全体

```bash
git log --oneline -15
git diff --stat HEAD~3
```

### スタック固有

- `secrets_policy`, `tracked_config_paths` を照合
- `stack-specific review notes` の環境・I/O 項目
- ランタイムバージョン（stack の `package_manager` / language に応じる）

---

## Phase 3: 切り分け

スコープ: 入口 → 層 → モジュール → 関数

**チェック:** ロジック vs I/O / 本番のみ vs テストでも再現 / 最近の diff / testspec Expected

### よくあるパターン（言語共通）

| パターン | 確認 |
|----------|------|
| 非同期 | 未 await、コールバック漏れ |
| 状態 | 競合、TTL、冪等性 |
| 認証 | 検証漏れ |
| 型 | 暗黙変換、null |
| テスト | モック差異、時刻依存、flaky |

スタック notes に固有パターンがあれば優先。

---

## Phase 4: Repro Digest

```markdown
## Repro Digest
- **feature-slug:**
- **症状:**
- **根本原因:**
- **最小再現:** [3 ステップ以内]
- **期待 / 実際:**
- **systemspec 根拠:** §X.Y / ⚠️ 未定義
```

### 次アクション

| 次 | スキル |
|----|--------|
| 回帰 TC | `bug-regression-test` |
| 仕様 | `project-systemspec-authoring` |
| 解決不能 | Blocker Report |

検証コマンドは stack.md の `test_single` / `test_all`。

---

## Guidelines

1. 推測より計測
2. 一度に一仮説
3. 30 分ルール
4. 調査と修正を混ぜない
