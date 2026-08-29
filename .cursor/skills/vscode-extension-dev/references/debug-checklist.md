# VS Code 拡張機能デバッグチェックリスト

## 起動・activate

| チェック | 確認方法 |
|----------|----------|
| activationEvents がトリガーと一致 | Extension Host の「Log (Extension Host)」 |
| `main` パスが compile 出力と一致 | `dist/extension.js` の存在 |
| compile エラーで activate 失敗 | 「Problems」パネル / `npm run compile` |
| 二重 activate 防止 | activate 内の singleton チェック |

## コマンド

| チェック | 確認方法 |
|----------|----------|
| contributes.command ID === registerCommand ID | package.json と extension.ts を diff |
| メニューの `when` 句が false | Command Palette から直接実行して切り分け |
| コマンドが enablement で無効 | contributes.commands[].enablement |

## Webview / Custom Editor

| チェック | 確認方法 |
|----------|----------|
| CSP で script/style ブロック | DevTools Console の CSP エラー |
| `asWebviewUri` 未使用の file:// | Network タブで 404 |
| `localResourceRoots` 不足 | リソース読み込み拒否 |
| postMessage の型不一致 | Extension Host 側 console.log |

## 性能

| チェック | 対策 |
|----------|------|
| activate が重い | lazy init / `onStartupFinished` 回避 |
| Provider が全ファイルで発火 | document selector を狭める |
| 大量 Diagnostic | debounce / 差分更新 |

## テストへの引き渡し

再現手順が固まったら:

1. Repro Digest（project-debugging 形式）を作成
2. `vscode-extension-test` で統合テスト化
3. 回帰 TC を testspec に追記

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-08-29 | 初版 |
