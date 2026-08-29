# Trace Template

P0 + P1 テストケースの机上検証または実行結果の記録形式。

```markdown
## Trace Results

### TC-001 (P0): [短い説明]

| Step | State / Action | Value |
|------|----------------|-------|
| Input | 初期入力 | `[1, 2, 3]` |
| 1 | 処理 ... | ... |
| Output | 最終出力 | `6` |

**Result:** ✅ Pass（期待値と一致）

---

### TC-004 (P1): [短い説明]

| Step | State / Action | Value |
|------|----------------|-------|
| Input | ... | ... |
| Output | ... | `-1` |

**Result:** ✅ Pass

---

### Summary

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-001 | P0 | ✅ | |
| TC-004 | P1 | ✅ | |
```

## API テスト用（追記列）

HTTP テストでは Step 表に以下を含める:

- Request: method, path, headers, body
- Response: status, body, 主要 header
- Side effects: KV put/get の mock 呼び出し

## 実行結果の記録

実際に Vitest を実行した場合:

```markdown
**Result:** ✅ Pass（`vitest run tests/foo.test.ts` 2026-08-29）
```

失敗時は expected vs actual を明示する。
