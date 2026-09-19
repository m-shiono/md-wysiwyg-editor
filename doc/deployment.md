# VS Code Marketplace 公開手順

読者: 拡張作者本人（`mshiono`）。本ドキュメントは Marketplace への手動公開ランブック。振る舞い仕様は [systemspec.md](./systemspec.md)、秘密情報方針は [stack.md](./stack.md) を正本とする。

公式参考: [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

---

## 1. 前提（このリポジトリの確定値）

`package.json` と Marketplace の対応は次のとおり。公開前に乖離がないことを確認する。

| 項目 | 値 |
|------|-----|
| Publisher ID（`publisher`） | `mshiono` |
| Extension name（`name`） | `vsc-md-editor` |
| Extension ID | `mshiono.vsc-md-editor` |
| 表示名（`displayName`） | `MD WYSIWYG Editor` |
| Repository | https://github.com/m-shiono/vsc-md-editor.git |

補足:

- Marketplace 上の **Publisher 表示名**（例: `m.shiono`）と **Publisher ID**（`mshiono`）は別物。`vsce` / `package.json` が参照するのは **ID**。
- GitHub ユーザー / リポジトリパス（`m-shiono`）も Publisher ID とは独立。混同しない。

---

## 2. Azure DevOps 組織 ≠ Marketplace Publisher

| 概念 | 例（本アカウント） | 役割 |
|------|-------------------|------|
| Azure DevOps 組織 | `mshiono.visualstudio.com` など | PAT 発行・組織スコープの認証基盤 |
| Marketplace Publisher | ID `mshiono` | 拡張の公開名義。**作成後 ID は変更不可** |

組織 URL や組織名を変えても、Publisher ID は自動では変わらない。逆に Publisher を作り直しても Azure DevOps 組織名は連動しない。`vsce login` の失敗原因を組織リネームで直そうとしないこと。

---

## 3. Publisher の作成

1. [Visual Studio Marketplace Manage Publishers](https://marketplace.visualstudio.com/manage) にサインインする。
2. Create Publisher で **Publisher ID** を決める（本リポジトリでは `mshiono`）。
3. 表示名は後から変えられるが、**ID は変更できない**。GitHub ハンドルや Azure DevOps 組織名と揃えたくなっても、既に作成済みの ID を正とする。

過去の失敗例: `package.json` の `publisher` を GitHub 風の `m-shiono` に合わせると、Marketplace 上の実 Publisher（`mshiono`）と不一致となり `vsce` が Access Denied になる。

---

## 4. PAT の発行と秘密情報

### 発行

1. Azure DevOps で Personal Access Token を作成する。
2. スコープ: **Marketplace** → **Manage**（公開に必要な最小権限）。
3. 組織: **All accessible organizations**（Marketplace 連携で推奨されることが多い）。
4. 有効期限を設定し、表示されたトークンを安全な場所に控える（再表示できない）。

### 秘密情報ポリシー（[stack.md](./stack.md) と整合）

- PAT / 公開用トークンは **git に含めない**。
- CI シークレットまたはローカル環境変数のみ。禁止パス例: `.env`、`*.vsix.publish.token`。
- チャット・スクリーンショット・コミットメッセージにトークン実値を貼らない。

---

## 5. `vsce login` と Access Denied の切り分け

```bash
npx @vscode/vsce login mshiono
```

プロンプトで PAT を入力する。Publisher ID は **Marketplace の ID**（`mshiono`）と一致させる。

### よくある Access Denied

| 症状 | 想定原因 | 対処 |
|------|----------|------|
| `/m-shiono` など別 ID への Access Denied | `login` 引数または `package.json` の `publisher` が Marketplace ID と不一致 | 両方を `mshiono` に揃えて再 login |
| PAT 拒否 | スコープ不足・期限切れ・誤トークン | Marketplace Manage 付き PAT を再発行 |
| Publisher 未作成 / 別アカウント | サインイン先と Publisher 所有者が違う | Manage Publishers で所有を確認 |

`package.json` の `publisher` を直したら、古い login キャッシュと食い違っていないか再 login する。

---

## 6. パッケージ（VSIX）

ローカルで VSIX を作る:

```bash
npm run package:vsix
```

同等の直接呼び出し:

```bash
npx @vscode/vsce package
```

`package:vsix` はコンパイル後に sourcemap を除いてから `vsce package` する（本リポジトリのスクリプト定義）。生成された `.vsix` を Marketplace に手動アップロードしてもよいが、通常は次節の `publish` で十分。

---

## 7. 公開

初回およびバージョン更新後:

```bash
npx @vscode/vsce publish
```

- 公開前に `package.json` の `version` を bump する（セマンティックバージョニング）。
- 既に同じバージョンが公開済みだと失敗する。
- 公開後、Marketplace 上で `mshiono.vsc-md-editor` として検索・インストールできるまで数分かかることがある。

---

## 8. 公開前チェックリスト

- [ ] `LICENSE`（本リポジトリは MIT）がリポジトリ根にあり、`package.json` の `license` と一致
- [ ] `icon`（`media/icon.png`）が有効で Marketplace 要件を満たす
- [ ] `README.md` がインストール後の説明として十分（機能・使い方）
- [ ] `version` が前回公開より新しい
- [ ] `engines.vscode` が意図した最小バージョン（現状 `^1.85.0`）
- [ ] `publisher` / `name` が上記確定値と一致（Extension ID = `mshiono.vsc-md-editor`）
- [ ] repository URL が正しい
- [ ] PAT やローカルトークンファイルがステージングされていない（`git status`）

---

## 9. Open VSX（任意・別系統）

[Open VSX](https://open-vsx.org/) は VS Code Marketplace とは **別アカウント・別トークン・別公開手順**。Cursor 等で Open VSX 経由の配布が必要な場合のみ別途対応する。本ランブックの `vsce publish` だけでは Open VSX には載らない。

---

## 10. 将来: PAT 以外の公開（短い注記）

Microsoft は Marketplace 向け PAT の扱いを段階的に見直しており、**2026-12 頃を目安に PAT 廃止・代替（Entra ID / Trusted Publishing 等）へ移行**する計画が案内されている。CI 自動化や Trusted Publishing の詳細手順は、公式ドキュメント更新後に本ファイルへ追記する。現状は手動 `vsce login` + `vsce publish` でよい。

---

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-09-19 | 初版。Marketplace 手動公開ランブック（publisher `mshiono` / Extension ID `mshiono.vsc-md-editor`）。Azure DevOps 組織と Publisher の区別、PAT 方針、Access Denied 切り分け、Open VSX・PAT 将来廃止の注記 |
