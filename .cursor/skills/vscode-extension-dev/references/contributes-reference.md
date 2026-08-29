# package.json contributes リファレンス

拡張機能 manifest の `contributes` セクション早見表。

## 命名規則

- コマンド ID: `<publisher>.<extensionName>.<commandName>`（例: `acme.mdEditor.formatDocument`）
- 設定 key: `<extensionName>.<settingName>`（例: `mdEditor.previewTheme`）
- View ID: 一意かつ安定 — 変更するとユーザー設定が壊れる

## activationEvents（最小化）

| Event | 用途 |
|-------|------|
| `onCommand:<id>` | 特定コマンド実行時 |
| `onLanguage:<lang>` | 言語ファイル open 時 |
| `onView:<id>` | Tree View 表示時 |
| `onCustomEditor:<viewType>` | カスタムエディタ open 時 |
| `workspaceContains:**/.foo` | ワークスペースに特定ファイルがある時 |
| `onStartupFinished` | 起動直後（**最終手段** — 起動性能に影響） |

## contributes 主要フィールド

### commands

```json
{
  "command": "acme.mdEditor.format",
  "title": "Format Document",
  "category": "MD Editor",
  "icon": "$(symbol-keyword)"
}
```

- `title` は UI 表示用（ローカライズは `package.nls.json`）
- `enablement` / menus の `when` で表示条件を制御

### menus

| location | 用途 |
|----------|------|
| `commandPalette` | コマンドパレット |
| `editor/context` | エディタ右クリック |
| `explorer/context` | エクスプローラー |
| `view/title` | Tree View タイトルバー |
| `view/item/context` | Tree アイテム |

`when` 句は [when clause contexts](https://code.visualstudio.com/api/references/when-clause-contexts) に従う。

### configuration

```json
{
  "mdEditor.previewTheme": {
    "type": "string",
    "default": "light",
    "enum": ["light", "dark"],
    "description": "Preview theme for markdown"
  }
}
```

- `scope`: `window` / `resource` / `machine` を適切に設定
- 破壊的変更時は設定 key の rename と migration を systemspec に記載

### views / viewsContainers

```json
"viewsContainers": {
  "activitybar": [{ "id": "mdEditor", "title": "MD Editor", "icon": "media/icon.svg" }]
},
"views": {
  "mdEditor": [{ "id": "mdEditor.outline", "name": "Outline" }]
}
```

Tree View は `TreeDataProvider` + `registerTreeDataProvider` で紐付け。

### customEditors

```json
{
  "viewType": "acme.mdEditor.preview",
  "displayName": "MD Preview",
  "selector": [{ "filenamePattern": "*.md" }],
  "priority": "default"
}
```

`CustomTextEditorProvider` または `CustomReadonlyEditorProvider` / `CustomEditorProvider` を選択。

## engines

```json
"engines": {
  "vscode": "^1.85.0"
}
```

- 利用する API の `@since` バージョン以上を指定
- `@types/vscode` のバージョンと整合させる

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-08-29 | 初版 |
