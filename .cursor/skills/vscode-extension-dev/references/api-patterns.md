# VS Code Extension API パターン

## Disposable 管理

```typescript
export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('MD Editor');
  context.subscriptions.push(output);

  context.subscriptions.push(
    vscode.commands.registerCommand('acme.mdEditor.hello', () => {
      output.appendLine('Hello');
    }),
  );
}
```

- `register*` の戻り値はすべて `context.subscriptions` に push
- `deactivate` では非同期処理を開始しない（未完了は activate 内で await 済みに）

## コマンド

```typescript
vscode.commands.registerCommand('acme.mdEditor.format', async (uri?: vscode.Uri) => {
  const doc = uri
    ? await vscode.workspace.openTextDocument(uri)
    : vscode.window.activeTextEditor?.document;
  if (!doc) {
    return;
  }
  // ...
});
```

- 引数は VS Code が渡す URI / 範囲を受け取れるようにする
- ユーザー向けエラーは `vscode.window.showErrorMessage`

## 設定の読み取り

```typescript
const config = vscode.workspace.getConfiguration('mdEditor');
const theme = config.get<string>('previewTheme', 'light');

context.subscriptions.push(
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('mdEditor')) {
      // 再読み込み
    }
  }),
);
```

## Webview

```typescript
const panel = vscode.window.createWebviewPanel(
  'mdPreview',
  'Preview',
  vscode.ViewColumn.Beside,
  {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
  },
);

const scriptUri = panel.webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, 'media', 'main.js'),
);

panel.webview.html = getWebviewContent(scriptUri);

panel.webview.onDidReceiveMessage((msg: unknown) => {
  // 型ガードしてから処理
});
```

- HTML 内 CSP: `default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'`
- 拡張機能 ↔ Webview メッセージは discriminated union で型定義

## Tree Data Provider

```typescript
class OutlineProvider implements vscode.TreeDataProvider<OutlineItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<OutlineItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: OutlineItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: OutlineItem): OutlineItem[] {
    return element ? element.children : this.roots;
  }
}
```

## Language Features（例: Completion）

```typescript
context.subscriptions.push(
  vscode.languages.registerCompletionItemProvider(
    { language: 'markdown', scheme: 'file' },
    {
      provideCompletionItems(document, position, token) {
        if (token.isCancellationRequested) {
          return [];
        }
        // ...
      },
    },
    '#', // trigger characters
  ),
);
```

## Custom Editor

`CustomTextEditorProvider` — テキストモデルと UI の同期:

- `resolveCustomTextEditor(document, webviewPanel, token)` で Webview を構築
- `onDidChangeTextDocument` で外部編集を Webview に反映
- Webview からの編集は `WorkspaceEdit` で document に適用

## ワークスペース状態

| API | 用途 |
|-----|------|
| `context.globalState` | マシン跨ぎでよい設定・フラグ |
| `context.workspaceState` | ワークスペース単位の状態 |
| `context.secrets` | トークン等（SecretStorage） |

シークレットは **globalState に平文保存しない**。

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-08-29 | 初版 |
