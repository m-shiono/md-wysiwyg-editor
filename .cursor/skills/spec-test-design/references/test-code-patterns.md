# Test Code Patterns

Phase 3 でテストコードを書くときの共通規約。ドメイン固有例は各 `domain-patterns/*.md` を参照。

**ランナー・パス・実行コマンドの正本:** [doc/stack.md](../../../../doc/stack.md)（`test_runner`, `test_file_glob`, `test_single`, `test_all`）

## ファイル配置

`doc/stack.md` の `test_file_glob` / `layout` に従う。例:

| 文脈 | パス例 |
|------|--------|
| TS/JS アプリ | `tests/<module>/<feature>.test.ts` |
| Python | `tests/unit/test_<feature>.py` |
| Go | `internal/<pkg>/<feature>_test.go` |
| アルゴリズム単体 | `tests/<feature>.test.ts` 等 |
| 競プロ verify のみ | `scripts/verify-<feature>.ts` |

## TC ID と testspec の対応

- `doc/testspec-<slug>.md` の Test Matrix が **正**
- 各テストケースに TC ID を含める（ランナー別の書き方は下記）
- testspec にないテストを追加しない（追加するなら testspec を先に更新）

---

## Vitest / Jest（TypeScript / JavaScript）

`test_runner: vitest` または `jest` のとき。

### 基本構成

```typescript
import { describe, it, expect } from 'vitest';
import { solve } from '../src/solve';

describe('FeatureName', () => {
  // TC-001 (P0): official sample
  it('TC-001: matches problem sample', () => {
    expect(solve(/* input */)).toBe(/* expected */);
  });

  // TC-010 (P1): boundary
  it('TC-010: handles empty input', () => {
    expect(solve([])).toBe(0);
  });
});
```

Jest の場合は import を `@jest/globals` またはグローバル `describe` / `it` / `expect` に読み替える。

### P2 / @slow の分離

```typescript
describe('FeatureName stress', () => {
  it.skip('TC-100: worst-case N=1e5 @slow', () => {
    // 制約上限。CI では skip、ローカル/nightly で実行
  });
});
```

testspec の「実行方針」節に skip 理由と実行方法を記載。

### API / Worker テスト（Vitest）

```typescript
import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index';

describe('POST /api/items', () => {
  it('TC-001: returns 201 with valid body', async () => {
    const res = await worker.fetch(
      new Request('https://example/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'x' }),
      }),
      mockEnv,
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ name: 'x' });
  });
});
```

- status + body + 必要 header をセットで assert
- KV / fetch 外部依存は `vi.fn()` で mock
- 副作用は「呼ばれたか」「引数は何か」を別 TC で検証

### 実行

```bash
# doc/stack.md の test_single 例
npx vitest run tests/module/feature.test.ts
```

---

## pytest（Python）

`test_runner: pytest` のとき。

### 基本構成

```python
import pytest

from mypackage.feature import solve


class TestFeatureName:
    """TCs for feature-slug — names describe What, not How."""

    def test_tc_001_matches_problem_sample(self):
        # TC-001 (P0): official sample
        assert solve(/* input */) == /* expected */

    def test_tc_010_handles_empty_input(self):
        # TC-010 (P1): boundary
        assert solve([]) == 0
```

関数名に TC ID を含める（`test_tc_001_...`）。docstring またはコメントで TC ID と Priority を明示してもよい。

### パラメータ化（同型の境界値）

```python
@pytest.mark.parametrize(
    "input_value,expected",
    [
        pytest.param(0, 0, id="TC-011-empty"),
        pytest.param(1, 1, id="TC-012-min"),
    ],
)
def test_tc_011_012_boundary_values(input_value, expected):
    assert solve(input_value) == expected
```

`id=` に TC ID を入れると失敗時の特定が容易。

### P2 / @slow の分離

```python
@pytest.mark.slow
@pytest.mark.skip(reason="TC-100: N=1e5 — run locally or nightly only")
def test_tc_100_worst_case():
    ...
```

testspec に `@slow` の実行方針を記載。CI では `pytest -m "not slow"` 等。

### モック・フィクスチャ

```python
from unittest.mock import patch


def test_tc_020_calls_external_api_with_expected_args():
    # TC-020 (P1): side effect / contract
    with patch("mypackage.feature.fetch_data") as mock_fetch:
        mock_fetch.return_value = {"ok": True}
        result = run_job()
        mock_fetch.assert_called_once_with("https://example/api")
        assert result == "done"
```

- ネットワーク・DB・時刻は mock / `pytest` フィクスチャで固定
- I/O は `tmp_path` フィクスチャを使う

### 実行

```bash
# doc/stack.md の test_single 例
uv run pytest tests/unit/test_feature.py
uv run pytest tests/unit/test_feature.py::TestFeatureName::test_tc_001_matches_problem_sample
```

---

## go test（Go）

`test_runner: go test` のとき。

### 基本構成

```go
package feature_test

import (
	"testing"

	"example.com/myapp/internal/feature"
)

func TestTC001_MatchesProblemSample(t *testing.T) {
	// TC-001 (P0): official sample
	got := feature.Solve(/* input */)
	want := /* expected */
	if got != want {
		t.Fatalf("TC-001: got %v, want %v", got, want)
	}
}

func TestTC010_HandlesEmptyInput(t *testing.T) {
	// TC-010 (P1): boundary
	got := feature.Solve(nil)
	if got != 0 {
		t.Fatalf("TC-010: got %d, want 0", got)
	}
}
```

- テスト関数は `Test` + TC ID（`TestTC001_...`）+ `_` + 説明
- 外部パッケージからテストする場合は `feature_test` パッケージ（ブラックボックス）を推奨
- 表形式の境界値は `t.Run` でサブテスト化

### サブテスト（表形式）

```go
func TestTC011_TC012_BoundaryValues(t *testing.T) {
	cases := []struct {
		name  string
		input int
		want  int
	}{
		{"TC-011-empty", 0, 0},
		{"TC-012-min", 1, 1},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := feature.Solve(tc.input); got != tc.want {
				t.Fatalf("%s: got %d, want %d", tc.name, got, tc.want)
			}
		})
	}
}
```

### P2 / 長時間

```go
func TestTC100_WorstCase(t *testing.T) {
	if testing.Short() {
		t.Skip("TC-100: @slow — run without -short")
	}
	// ...
}
```

CI では `go test -short ./...`。testspec に `-short` 方針を記載。

### モック

- インターフェース + フェイク実装を `_test.go` または `internal/.../mock` に置く
- `httptest.Server` で HTTP 依存を置き換える
- 副作用は「呼ばれたか」を別 TC で検証

### 実行

```bash
# doc/stack.md の test_single / test_all 例
go test ./internal/feature/...
go test ./internal/feature/ -run TestTC001_MatchesProblemSample
go test -short ./...
```

---

## テストデータ（全ランナー共通）

| 方式 | 使うとき |
|------|---------|
| インラインリテラル | P0/P1、読みやすさ優先 |
| `fixtures/` | 同じ入力を複数 TC で再利用 |
| 生成関数 `makeTree(n)` 等 | P2、構造パターン（skewed/star） |

## 命名（What not How）

| ✅ | ❌ |
|----|-----|
| `returns 404 when item missing` | `calls kv.get` |
| `rejects invalid JSON with 400` | `uses JSON.parse` |

## 実行と testspec への記録

`doc/stack.md` の `test_single` / `test_all` を使う。

Trace Results に実行日と Pass/Fail を記録。失敗時は expected vs actual を testspec に追記。
