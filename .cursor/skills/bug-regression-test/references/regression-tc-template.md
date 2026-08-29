# Regression TC Template

`doc/testspec-<slug>.md` の Test Matrix に追加する 1 行の例。

## Matrix 行

```markdown
| TC-042 | Corner | regression-bug-123 | P0 | [最小入力] | [期待出力] | Regression: [症状] (#123) | §X.Y |
```

## 改訂履歴（testspec 末尾）

```markdown
| 2026-08-29 | TC-042 追加 | 回帰: [症状] issue #123 |
```

## Trace Results 追記

```markdown
### TC-042 (P0): Regression — [症状]

| Step | Value |
|------|-------|
| Input | ... |
| Expected | ... |
| Actual (pre-fix) | Fail: ... |
| Actual (post-fix) | Pass |

**Result:** ✅ Pass（vitest run YYYY-MM-DD）
```

## 既存 TC 修正時

```markdown
| TC-010 | Corner | auth | P1 | ... | 403 | **Updated:** was 401, spec §X.Y clarified | §X.Y |
```

testspec 改訂履歴:

```markdown
| 2026-08-29 | TC-010 Expected 401→403 | Behavioral fix, issue #124 |
```

## systemspec 側（必要時）

Failure Returns 表に行を追加または修正し、Related Tests で testspec を参照。
