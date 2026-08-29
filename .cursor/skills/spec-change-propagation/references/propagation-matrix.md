# Propagation Matrix Template

Phase 2 で以下を埋めて出力する。

```markdown
## Propagation Matrix

| # | 成果物 | 要否 | 作業 | 担当スキル |
|---|--------|------|------|-----------|
| 1 | doc/systemspec.md 改訂履歴 | ✅ | 追記 | project-systemspec-authoring |
| 2 | doc/testspec-<slug>.md | ✅ | TC-0xx Expected 更新、deprecated マーク | spec-test-design |
| 3 | tests/.../feature.test.ts | ✅ | TC-0xx assert 更新 | testspec-implementation |
| 4 | src/... | ✅ | [具体ファイル] | （実装） |
| 5 | doc/development.md | ➖ | — | — |
| 6 | doc/deployment.md | ➖ | — | — |
| 7 | README.md | ⚠️ | 公開 API 変更なら要 | — |
| 8 | doc-consistency-audit | ✅ | マージ前 | doc-consistency-audit |

## TC Impact

| TC ID | 操作 | 理由 |
|-------|------|------|
| TC-001 | 維持 | 変更なし |
| TC-010 | Expected 更新 | 401 → 403 |
| — | TC-020 新規 P1 | 新失敗条件 |

## Open Questions

- ⚠️ [項目]: ユーザー確認待ち
```

## 種別別デフォルト

| 種別 | testspec | tests | README |
|------|----------|-------|--------|
| Additive | ✅ 新 TC | ✅ | ⚠️ |
| Behavioral | ✅ Expected | ✅ | ⚠️ |
| Breaking | ✅ + deprecated | ✅ | ✅ |
| Docs-only | ➖ | ➖ | ➖ |
| Constraint | ✅ 境界 TC | ✅ | ➖ |
