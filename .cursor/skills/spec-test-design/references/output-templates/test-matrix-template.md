# Test Matrix Template

Phase 2 の出力形式。チャット提示と `doc/testspec-*.md` 両方で使用する。

```markdown
## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-001 | Happy | sample | P0 | ... | ... | 公式サンプルで入出力形式を固定 | §3.1 |
| TC-002 | Happy | general | P0 | ... | ... | 標準的な中規模入力 | §3.1 |
| TC-003 | Boundary | min-N | P1 | ... | ... | N=0 の境界 | 制約 |
| TC-004 | Corner | no-solution | P1 | ... | ... | 解なし時 -1 | §3.2 |
| TC-005 | Stress | worst-case | P2 | ... | ... | 偏り木で DFS 深度 | — |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-001, TC-002 | — |
| Boundary | TC-003 | — |
| Structural | — | グラフ非該当 |
| Corner | TC-004 | — |
| Stress | TC-005 | — |

### Complexity Notes

- 制約: N ≤ 10^5
- 想定: O(N log N)
- P2 TC-005: 最悪 O(N) 入力で TLE 検出
```

## 列の定義

| 列 | 必須 | 説明 |
|----|------|------|
| ID | ✓ | TC-001 形式。テストコードと 1:1 対応 |
| Category | ✓ | Happy / Boundary / Structural / Corner / Stress |
| Domain Tag | | tree-skewed, api-401 等 |
| Priority | ✓ | P0 / P1 / P2 |
| Input | ✓ | 具体値（JSON / 配列 / リクエスト） |
| Expected | ✓ | 期待出力（status + body 含む） |
| Rationale | ✓ | 1 行で検出目的 |
| Spec Ref | | 仕様節、制約行、問題文参照 |
