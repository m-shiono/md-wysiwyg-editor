# Systemspec Section Template

`doc/systemspec.md` に追加・更新する節の雛形。複数機能がある場合は機能ごとに `## §X Feature Name` で分割。

---

```markdown
## §X.Y [機能名]

### 概要

[一行説明。誰が何のために使うか]

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| | | | | | |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | | |
| [失敗条件] | | |

### Preconditions

- [認証要否、データ形式、環境 など]

### Behavior

#### 正常系

1. ...

#### 例外系

1. ...

### Non-Goals

- [今回スコープ外]

### Related Tests

- [doc/testspec-<feature-slug>.md](testspec-<feature-slug>.md)

### Spec Gaps（未定義・要確認）

- ⚠️ [項目]: [内容]（該当なしなら「なし」）

---

## 改訂履歴（doc/systemspec.md 末尾に集約）

| 日付 | 節 | 変更内容 |
|------|-----|---------|
| YYYY-MM-DD | §X.Y | 初版 |
```

## feature-slug 命名

- kebab-case
- `doc/testspec-<slug>.md` と一致させる
- 例: `api-items`, `markdown-parse`, `auth-token`
