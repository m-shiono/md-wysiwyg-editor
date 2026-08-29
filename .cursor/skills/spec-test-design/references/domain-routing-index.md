# Domain Routing Index

Phase 1 で仕様・問題文を読んだ後、この索引で追加参照ファイルを決める。
**該当するファイルはすべて読む。** 複数該当はよくある。

## 判定フロー

```text
1. 必須: agent-check-matrix.md + category-catalog.md
2. 下表でキーワードマッチ → domain-patterns/*.md
3. Phase 3 前: test-code-patterns.md
4. 出力形式: output-templates/*
```

## キーワード → 参照ファイル

| キーワード / 文脈 | 参照ファイル |
|-----------------|------------|
| graph, tree, edge, 頂点, 辺, 連結, 最短経路 | [domain-patterns/tree-graph.md](domain-patterns/tree-graph.md) |
| dp, knapsack, 動的計画法, 状態遷移, メモ化 | [domain-patterns/dynamic-programming.md](domain-patterns/dynamic-programming.md) |
| binary search, lower bound, upper bound, ソート済み探索 | [domain-patterns/binary-search.md](domain-patterns/binary-search.md) |
| prefix sum, sliding window, 部分配列, 区間和, 尺取り | [domain-patterns/prefix-sum-window.md](domain-patterns/prefix-sum-window.md) |
| sort, ソート, hash, マップ, 辞書, カウント | [domain-patterns/sorting-hash.md](domain-patterns/sorting-hash.md) |
| string, 文字列, パース, 正規表現, 部分一致 | [domain-patterns/string-text.md](domain-patterns/string-text.md) |
| grid, マス目, 2D, 行列, 迷路, 上下左右 | [domain-patterns/grid-matrix.md](domain-patterns/grid-matrix.md) |
| overflow, mod, 剰余, 大きい数, 10^18, GCD | [domain-patterns/integer-math.md](domain-patterns/integer-math.md) |
| API, HTTP, Worker, KV, エンドポイント, REST | [domain-patterns/api-worker.md](domain-patterns/api-worker.md) |
| async, 非同期, 冪等, idempotent, リトライ, webhook | [domain-patterns/async-idempotency.md](domain-patterns/async-idempotency.md) |

## 組み合わせ例

| 問題タイプ | 読むファイル |
|-----------|-------------|
| グリッド上の BFS 最短経路 | grid-matrix, tree-graph |
| 文字列 + ハッシュで Anagram | string-text, sorting-hash |
| ナップサック + 大きな値 | dynamic-programming, integer-math |
| POST API + 二重送信防止 | api-worker, async-idempotency |
| ソート配列 + 二分探索 | binary-search, sorting-hash |

## N/A の記録

該当ドメインがない場合、テストマトリクスの Category Coverage に理由を書く。
例: `Structural | N/A | HTTP CRUD のみでグラフ非該当`
