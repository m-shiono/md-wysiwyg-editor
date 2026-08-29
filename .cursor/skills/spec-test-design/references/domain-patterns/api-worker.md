# API & Worker Patterns

**適用条件:** HTTP API、Cloudflare Workers、KV/R2/D1、Webhook、認証付きエンドポイント

## 必須パターン

### 正常系（Happy Path）

| パターン | 例 |
|---------|-----|
| 典型リクエスト | 仕様どおりの method / path / body |
| 最小有効入力 | 必須フィールドのみ |
| 最大許容入力 | 文字数上限、配列長上限 |

### 境界・入力検証

| パターン | 期待 |
|---------|------|
| 空 body | 400 or 仕様どおりのデフォルト |
| 不正 JSON | 400 + エラーボディ |
| 必須フィールド欠落 | 400 |
| 型不一致 | 400 |
| 範囲外値 | 400 or 422 |

### 認証・認可

| パターン | 期待 |
|---------|------|
| 未認証 | 401 |
| 権限不足 | 403 |
| 期限切れトークン | 401 |

### リソース状態

| パターン | 期待 |
|---------|------|
| 存在しない ID | 404 |
| 競合（重複作成） | 409 |
| 削除済み | 404 or 410 |

### 外部依存・障害

| パターン | 期待 |
|---------|------|
| KV キー未存在 | 404 or デフォルト |
| upstream タイムアウト | 502/504 + ログ |
| rate limit | 429 |

### Worker 固有

| パターン | 検出目的 |
|---------|---------|
| scheduled vs fetch | ハンドラ分岐 |
| env 未設定 | 起動時 / 実行時エラー |
| CORS preflight | OPTIONS 応答 |

## テスト設計のヒント

- Vitest + `fetch` mock または `wrangler` の test ユーティリティ
- レスポンス: status + body + 必要な header をセットで検証
- 副作用（KV write）: mock で呼び出し引数を assert

## テストコード例（Vitest）

```typescript
describe('POST /api/items', () => {
  it('TC-001: creates item with valid body', async () => {
    const res = await SUT.fetch(new Request('https://x/api/items', {
      method: 'POST',
      body: JSON.stringify({ name: 'a' }),
    }));
    expect(res.status).toBe(201);
  });

  it('TC-010: returns 400 when body is invalid JSON', async () => {
    const res = await SUT.fetch(new Request('https://x/api/items', {
      method: 'POST',
      body: '{',
    }));
    expect(res.status).toBe(400);
  });
});
```
