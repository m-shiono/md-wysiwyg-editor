# VS Code 拡張機能 公開チェックリスト

## package.json

| 項目 | 必須 | 備考 |
|------|------|------|
| `name` | ✓ | 小文字、ハイフン区切り |
| `displayName` | ✓ | Marketplace 表示名 |
| `description` | ✓ | 短い説明 |
| `version` | ✓ | semver |
| `publisher` | ✓ | Marketplace publisher ID |
| `engines.vscode` | ✓ | 最小 VS Code バージョン |
| `categories` | 推奨 | 例: Other, Formatters |
| `icon` | 推奨 | 128x128 PNG |
| `license` | 推奨 | MIT 等 |
| `repository` | 推奨 | GitHub URL |

## セキュリティ

- [ ] PAT / API key がソース・`.vsix` に含まれない
- [ ] `context.secrets` 利用時、ログに出力しない
- [ ] Webview CSP が適切
- [ ] 外部 URL fetch がある場合、許可リストまたはユーザー確認

## 品質

- [ ] `npm run compile` 成功
- [ ] `npm test`（統合テスト）成功
- [ ] Extension Development Host で smoke test
- [ ] CHANGELOG.md 更新
- [ ] README にスクリーンショット・使い方

## パッケージ内容

```bash
vsce ls --tree
```

- [ ] `src/` が含まれていない（.vscodeignore）
- [ ] `dist/` / `out/` が含まれている
- [ ] `node_modules` が含まれていない（dependencies は production のみバンドル or 同梱方針を確認）
- [ ] テスト fixture / dev 用ファイルが除外されている

## Marketplace メタ

- [ ] `galleryBanner.color` / `theme`（任意）
- [ ] `keywords` で検索されやすく
- [ ] `qna` / `bugs` URL

## リリース後

- [ ] Marketplace ページで install テスト
- [ ] バージョン tag を git に push
- [ ] systemspec / deployment doc にリリース記録

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-08-29 | 初版 |
