# Consistency Audit Report Template

```markdown
# Consistency Audit: [feature-slug / PR scope]

**日付:** YYYY-MM-DD
**スコープ:** [feature-slug / 変更ファイル一覧]

## Summary

| 四者 | 状態 | 備考 |
|------|------|------|
| systemspec | ✅ / ⚠️ / ❌ | |
| testspec | ✅ / ⚠️ / ❌ | |
| tests/ | ✅ / ⚠️ / ❌ | |
| src/ | ✅ / ⚠️ / ❌ | |

## Findings

### Critical

1. **[ID-C1]** [説明]
   - **所在:** systemspec §X / testspec TC-YYY / `src/...`
   - **推奨:** `project-systemspec-authoring` / ...

### Warning

1. **[ID-W1]** ...

### Info

1. **[ID-I1]** ...

## Coverage Matrix

| 仕様項目 (systemspec) | testspec TC | tests it() | 実装 |
|----------------------|-------------|------------|------|
| 未認証 → 401 | TC-010 | ✅ | ✅ |
| ... | | | |

## Recommended Action Order

1. ...
2. ...

## N/A Items

| 項目 | 理由 |
|------|------|
| P2 stress | 未実装・意図的 skip |
```
