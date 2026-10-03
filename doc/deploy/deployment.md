# VS Code Marketplace 公開手順

本ドキュメントは Marketplace への手動公開ランブック。振る舞い仕様は [systemspec.md](../requirements/systemspec.md)、秘密情報方針は [stack.md](../../.cursor/stack.md) を正本とする。

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
| Repository | https://github.com/m-shiono/md-wysiwyg-editor.git |

> [!IMPORTANT]
> **Extension ID (`vsc-md-editor`) と表示名・内部コードの分離について**
> Marketplace に初版登録した際の Extension ID は `mshiono.vsc-md-editor` です。VS Code Marketplace の仕様上、一度登録された Extension ID（`name`）は変更できません。
> `package.json` の `name` を書き換えると `vsce publish` 時に別拡張機能扱いとなり CLI 公開に失敗します。そのため、**`package.json` の `name` は必ず `vsc-md-editor` を維持してください**。
> なお、ユーザーに見える拡張機能の表示名は `displayName`（`MD WYSIWYG Editor`）で制御されるため外見上の問題はありません。また、内部コード（viewType やコマンド ID、設定キー `md-wysiwyg-editor.*`）は `name` と独立して動作します。

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

### 秘密情報ポリシー（[stack.md](../../.cursor/stack.md) と整合）

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

ローカル検証用（バージョンは変更しない）:

```bash
./build.sh
```

同等の npm 直接呼び出し:

```bash
npm run package:vsix
```

`build.sh` / `package:vsix` はコンパイル後に sourcemap を除いてから `vsce package` する。実行前にリポジトリ直下の古い `*.vsix` を削除する（`build.sh`）。生成された `.vsix` を Marketplace に手動アップロードしてもよいが、通常は次節の `publish` で十分。

---

## 7. 公開

通常の公開（推奨）:

```bash
./build_publish.sh
```

`build_publish.sh` は次を順に行う。

1. リポジトリ直下の古い `*.vsix` を削除
2. `npm version patch --no-git-tag-version` で SemVer **patch** を自動 bump（`package.json` / `package-lock.json`。git commit/tag は作らない）
3. `npm run package:vsix` で VSIX を生成
4. 生成された唯一の `.vsix` を `vsce publish --packagePath` で公開

補足:

- 既に同じバージョンが公開済みだと失敗する（自動 bump により通常は回避される）。
- 公開成功後、`package.json` / `package-lock.json` の version 変更をユーザーが commit する。
- 公開後、Marketplace 上で `mshiono.md-wysiwyg-editor` として検索・インストールできるまで数分かかることがある。

手動で公開する場合のみ:

```bash
npx @vscode/vsce publish --packagePath <生成済み.vsix>
```

---

## 8. 公開前チェックリスト

- [ ] `LICENSE`（本リポジトリは MIT）がリポジトリ根にあり、`package.json` の `license` と一致
- [ ] `icon`（`media/icon.png`）が有効で Marketplace 要件を満たす
- [ ] `README.md` がインストール後の説明として十分（機能・使い方）
- [ ] `./build_publish.sh` 実行で version が自動 bump されること（公開後に `package.json` / `package-lock.json` を commit）
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
| 2026-10-03 | `./build_publish.sh` の自動 bump を minor から patch に変更 |
| 2026-10-03 | CLI Publish 互換性のため Extension name / ID を `vsc-md-editor` / `mshiono.vsc-md-editor` に固定。`displayName`（`MD WYSIWYG Editor`）および内部貢献 ID（`md-wysiwyg-editor.*`）は維持 |
| 2026-09-29 | Breaking / 利用者再設定案内セクションを削除（初期製品のため migration messaging 不要）。§1 の現行 Extension ID / name / repo は維持 |
| 2026-09-29 | 製品リネーム（`rename-md-wysiwyg`）: Extension name / ID / repository を `md-wysiwyg-editor` / `mshiono.md-wysiwyg-editor` / `https://github.com/m-shiono/md-wysiwyg-editor.git` に同期 |
| 2026-09-19 | 初版。Marketplace 手動公開ランブック（publisher `mshiono` / Extension ID `mshiono.vsc-md-editor`）。Azure DevOps 組織と Publisher の区別、PAT 方針、Access Denied 切り分け、Open VSX・PAT 将来廃止の注記 |
| 2026-09-19 | パス移設（`doc/deploy/`）。契約内容不変 |
| 2026-09-29 | `./build_publish.sh` で minor 自動 bump・旧 VSIX 削除・`--packagePath` 公開に更新。`./build.sh` はローカル検証用 |
