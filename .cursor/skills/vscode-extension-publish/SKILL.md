---
name: vscode-extension-publish
description: >
  VS Code 拡張機能のパッケージングと Marketplace 公開 — vsce、.vscodeignore、
  バージョン管理、publisher 設定、pre-release、Open VSX。
  「vsce」「Marketplace に公開」「拡張機能をパッケージ」「.vsix」「publisher」
  「拡張機能のリリース」で使用。
---

# VS Code Extension Publish

**目的:** 拡張機能を `.vsix` としてパッケージし、Visual Studio Marketplace（または Open VSX）に安全に公開する。

**開始時:** [doc/stack.md](../../../doc/stack.md) · [doc/deployment.md](../../../doc/deployment.md) · [references/publish-checklist.md](references/publish-checklist.md)

## 他スキルとの関係

| 状況 | スキル |
|------|--------|
| 実装・manifest | `vscode-extension-dev` |
| 公開前テスト | `vscode-extension-test` |
| **パッケージ・公開** | **本スキル** |
| セキュリティレビュー | `project-security-review` |

---

## Phase 1: 公開前チェック

- [ ] `npm run compile` / `npm test` 成功
- [ ] `engines.vscode` が妥当
- [ ] README.md / CHANGELOG.md 更新（ユーザー向け）
- [ ] アイコン `icon` フィールド（128x128 PNG 推奨）
- [ ] ライセンス `license` フィールド
- [ ] シークレット・トークンがパッケージに含まれない

詳細: [references/publish-checklist.md](references/publish-checklist.md)

---

## Phase 2: .vscodeignore

パッケージに **含めない** もの:

```text
.vscode/**
.vscode-test/**
src/**
**/tsconfig.json
**/.eslintrc.json
**/*.map
node_modules/**
.git/**
```

- `out/` または `dist/` **は含める**（`main` が指すバンドル）
- Webview の `media/` は含める

---

## Phase 3: vsce

### ローカルパッケージ

```bash
npm install -g @vscode/vsce   # または npx @vscode/vsce
vsce package                  # .vsix 生成
vsce ls                       # パッケージ内容確認
```

### 公開

```bash
vsce publish                  # patch バump + publish
vsce publish minor
vsce publish 1.2.3            # 明示バージョン
```

- `publisher` フィールド必須 — [Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)
- Personal Access Token は **SecretStorage / CI secret** — git に含めない

### pre-release

```json
"version": "1.0.0"
```

```bash
vsce publish --pre-release
```

---

## Phase 4: バージョニング

[Semantic Versioning](https://semver.org/) に従う:

| 変更 | bump |
|------|------|
| 破壊的 API / 設定 key 変更 | major |
| 新機能（後方互換） | minor |
| バグ修正 | patch |

`CHANGELOG.md` にユーザー向け変更を記載 — commit message の Why と対応させる。

---

## Phase 5: CI/CD（任意）

```yaml
# 例: GitHub Actions
- run: npm ci && npm run compile && npm test
- run: npx @vscode/vsce package
- uses: actions/upload-artifact@v4
  with:
    name: vsix
    path: '*.vsix'
```

本番 publish は tag push または manual workflow_dispatch + protected secret。

---

## Open VSX（任意）

Enterprise / VSCodium 向け: [open-vsx.org](https://open-vsx.org/) に `ovsx publish`。

---

## 参照

| ファイル | いつ読むか |
|----------|------------|
| [publish-checklist.md](references/publish-checklist.md) | リリース前最終確認 |
