# System Specification — vsc-md-editor

VS Code 拡張 **vsc-md-editor** の振る舞い仕様（WHAT）。実装詳細・テストケース一覧は本書に含めない。

---

## 概要

チーム向け技術ドキュメントを Git 管理しながら、Word/Excel に近い WYSIWYG 体験で Markdown（`.md`）を編集する VS Code 拡張機能。MVP では本文 WYSIWYG、HTML 表編集、ファイル単位 Readonly 切替、Mermaid リアルタイム描画、Marp プレビュー、クリップボード画像のローカル保存を提供する。リッチ表現（拡張記法・HTML 混在）を Markdown 厳密互換より優先する（UD-001）。

**feature-slug:** `vsc-md-wysiwyg`

### アーキテクチャ方針（AD-* 要約）

| ID | 方針（WHAT） |
|----|-------------|
| AD-001 | TypeScript / VS Code Extension Host / npm / `@vscode/test-electron` |
| AD-002 | `*.md` を Custom Editor で開く。Document が dirty・undo/redo・save の正本 |
| AD-003 | Webview 内 WYSIWYG エディタ。見出し・太字・斜体・リスト・リンク・コードブロック等を MVP 対象ノードとする |
| AD-004 | 編集内容 ↔ ディスク `.md` は remark/unified パイプラインで変換。HTML 混在・拡張ブロックを許容。出力は決定的（AD-013） |
| AD-005 | 表は WYSIWYG 内部でリッチ編集、永続化は HTML `<table>` ブロックをデフォルトとする |
| AD-006 | Readonly はファイル単位。状態はワークスペースに永続化 |
| AD-007 | Mermaid はコードブロック + リアルタイム描画。編集はテキストのみ |
| AD-008 | Marp はプレビュー表示のみ。編集は WYSIWYG 本文側 |
| AD-009 | 画像 paste → 同階層 `img/image-NNNN.ext` に保存し相対パスを挿入 |
| AD-010 | Webview CSP + HTML サニタイズ。許可タグ・属性を限定 |
| AD-011 | Extension Host と Webview を別バンドルし `media/` に配置 |
| AD-012 | シリアライズ round-trip のユニットテスト + Custom Editor 統合テスト |
| AD-013 | 保存時の整形ルールを固定し Git diff 可読性を確保 |
| AD-014 | ビルトイン Markdown エディタとの共存（エディタ関連付けの切替可能） |
| AD-015 | Output チャンネルで障害ログ。ユーザー向けはエディタ内インライン表示を優先 |

---

## §1 Custom Editor 基盤

### 概要

`.md` ファイルを Custom Editor として開き、Extension Host 上の Document と Webview 上の WYSIWYG UI を同期する。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `documentUri` | `vscode.Uri` | はい | — | — | ワークスペース内 `.md` |
| `fileContent` | `string` (UTF-8) | はい | 0 B | 推奨 500 KB 未満 | 超過時は警告のみ（RK-004） |
| `extensionActivation` | イベント | はい | — | — | Custom Editor オープン時に限定起動（AD-002） |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功（オープン） | Custom Editor タブ表示、Webview ロード完了 | — |
| 成功（保存） | ディスク上 `.md` 更新、`dirty` 解除 | AD-013 整形後 |
| ファイル読込失敗 | エディタ未表示、通知 + Output | 権限・存在エラー |
| シリアライズ失敗 | 保存拒否、`dirty` 維持、通知 + Output | ソースは Webview 内に保持 |
| 大ファイル警告 | 編集継続可、Output に警告 | RK-004 |

### Preconditions

- VS Code が AD-001 で定める最小 `engines.vscode` を満たすこと
- 対象 URI がファイルシステム上の通常ファイルであること（リモート FS は未保証）
- Webview でスクリプト有効化が許可されること

### Behavior

#### 正常系

1. ユーザーが `.md` を開くと Custom Editor が起動し、ディスク内容をパースして Webview に表示する
2. Webview での編集は postMessage 経由で Document に反映され `dirty` となる
3. `save` / `saveAs` で Document 内容をシリアライズし UTF-8 で書き込む
4. undo/redo は Document 経由で一貫して動作する
5. エディタを閉じる際、未保存変更があれば VS Code 標準の確認ダイアログが表示される

#### 例外系

1. パース不能な Markdown/HTML 混在は可能な範囲で表示し、保存時にシリアライズエラーを報告する
2. 外部プロセスによるファイル変更は VS Code の標準リロード/競合フローに従う

### Non-Goals

- Language Server との完全統合（RK-008 — backlog 検討）
- 仮想スクロールによる大ファイル最適化（RK-004 — backlog）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-001–009

---

## §2 WYSIWYG 本文編集

### 概要

Webview 内で Markdown 本文を WYSIWYG 編集する。MVP ノードは見出し（h1–h6）、太字、斜体、箇条書き、番号リスト、リンク、インラインコード、コードブロック。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `editOperation` | 編集コマンド / キー入力 | はい | — | — | RO 時は拒否（§5） |
| `documentSnapshot` | 内部ドキュメントモデル | はい | — | — | TipTap / ProseMirror 相当（AD-003） |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | UI 更新、Document dirty | — |
| RO 中の編集試行 | 操作無効、UI フィードバック | §5 |
| 未対応ノード | 読み取り表示または raw 保持 | データ損失を避ける |

### Preconditions

- Custom Editor が編集モード（非 RO）であること
- Webview がロード済みであること

### Behavior

#### 正常系

1. ツールバー・ショートカットで書式を適用できる
2. 編集内容はリアルタイムで内部モデルに反映される
3. 保存時に remark パイプラインで Markdown（+ 許可 HTML）へシリアライズされる（AD-004）
4. VS Code テーマ CSS 変数（`var(--vscode-*)`）で見た目を統合する

#### 例外系

1. 既存 `.md` に本拡張未対応の記法がある場合、可能な限り原文を保持する
2. シリアライズ不能な構造は保存をブロックしエラーを表示する（AD-015）

### Non-Goals

- CommonMark / GFM の厳密互換（UD-001 — リッチ優先）
- 全 Markdown 拡張記法の WYSIWYG 対応
- i18n（UI 文言の多言語化 — backlog）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-010–015

---

## §3 表編集

### 概要

Excel 的な表編集。セル直接編集、セル内改行・箇条書き・チェックボックスを WYSIWYG で表現し、永続化は HTML `<table>` ブロックとする（AD-005, UD-006）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `tableOperation` | 行/列/セル操作 | はい | 1 行 × 1 列 | ソフト上限 100 行 × 20 列 | 超過時 UI 警告、保存は許可 |
| `cellContent` | リッチテキスト | 任意 | 空 | — | 改行・リスト・チェックボックス可 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | 表 UI 更新、保存時 HTML `<table>` 出力 | AD-005 |
| ソフト上限超過 | UI 警告表示、編集・保存は継続可 | 100 行 × 20 列 |
| RO 中 | 操作無効 | §5 |
| サニタイズ拒否 | 危険タグ/属性を除去して表示 | AD-010, RK-003 |

### Preconditions

- 編集モードであること
- 表は WYSIWYG 内部の表モデルとして存在すること

### Behavior

#### 正常系

1. 表の挿入、行/列の追加・削除、セル編集ができる
2. セル内に複数行テキスト、箇条書き、チェックボックスを入力できる
3. 保存後の `.md` には HTML `<table>` として記録される
4. 既存 GFM パイプ表を開いた場合、初回は読み取り表示とし、**初回編集時**に HTML `<table>` モデルへ変換する（UD-001 リッチ優先）
5. 行数が 100 を超える、または列数が 20 を超える場合、エディタ内にソフト上限警告を表示する（保存は拒否しない）

#### 例外系

1. 外部 HTML 表の読込時、サニタイズ後に表示する（RK-003）
2. 手書き GFM 表と HTML 表が同一リポジトリに混在しうる（RK-006 — スタイルガイド推奨）

### Non-Goals

- GFM パイプ表形式での永続化（デフォルト非採用）
- 表内数式・ピボット等の Excel 高度機能

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-016–024, TC-065

---

## §4 Readonly モード

### 概要

ファイル単位で編集可否を切り替える（UD-005）。状態はワークスペースに永続化する（AD-006）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `toggleReadonlyCommand` | コマンド実行 | はい | — | — | `Toggle Readonly Mode` |
| `targetUri` | `vscode.Uri` | はい | — | — | キー: `readonly:<uri>` |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功（RO ON） | 編集不可、バッジ表示 | Webview `editable: false` |
| 成功（RO OFF） | 編集可 | — |
| 未オープン URI | 次回オープン時に状態復元 | workspaceState |

### Preconditions

- 対象 `.md` が Custom Editor で開かれている、または URI が有効であること

### Behavior

#### 正常系

1. コマンド実行で当該ファイルの RO 状態がトグルされる
2. RO 状態は `workspaceState` に `readonly:<uri>` として保存される
3. RO 中は WYSIWYG 編集・表編集・画像 paste が無効化される
4. RO 中も Mermaid 描画・Marp プレビュー等の閲覧系機能は利用できる
5. 再オープン時に RO 状態が復元される

#### 例外系

1. ワークスペース未保存（Untitled Workspace）時は RO 状態をセッション内のみ保持し、VS Code 再起動後は復元しない
2. 保存済みワークスペースでは `workspaceState` キー `readonly:<uri>` により再起動後も RO 状態を復元する

### Non-Goals

- ワークスペース全体 RO（`mdEditor.workspaceReadonly` — Phase 2 / backlog）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-025–030

---

## §5 Mermaid 描画

### 概要

` ```mermaid ` フェンスブロックをリアルタイムに図として描画する。編集はテキストのみ（UD-004, AD-007）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `mermaidSource` | `string` | はい | 0 文字 | — | フェンス内テキスト |
| `debounceMs` | 数値 | いいえ | — | — | 目安 300 ms（AD-007） |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | ブロック内に SVG/図表示 | ソースは保持 |
| 構文エラー | ブロック内にエラーメッセージ | ソースは保持、Output に記録（AD-015） |
| レンダリングタイムアウト | エラー表示 | RK-004 |

### Preconditions

- Webview 内で Mermaid レンダラがロード済みであること

### Behavior

#### 正常系

1. Mermaid コードブロック内のテキスト変更を debounce 後に再描画する
2. 保存内容は ```mermaid フェンスとして .md に残る
3. RO 中も描画は更新される（ソース変更は不可）

#### 例外系

1. 悪意ある入力はサニタイズし、スクリプト実行を行わない（RK-003）
2. Mermaid パッケージ更新による見た目変化は許容（RK-007 — lockfile 固定推奨）

### Non-Goals

- Mermaid ビジュアルダイアグラムエディタ（backlog）
- オフライン以外での外部レンダリング API 呼び出し

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-031–037

---

## §6 Marp プレビュー

### 概要

Marp 形式スライドのプレビューをサイドまたはパネルに表示する。編集は WYSIWYG 本文のみ（UD-003, AD-008）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `documentContent` | `string` | はい | — | — | front matter + 本文 |
| `previewTrigger` | コマンド / 自動 | はい | — | — | ドキュメント変更で更新 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | スライド HTML プレビュー | テーマは front matter から |
| パース失敗 | プレビュー内エラー表示 | Output に記録 |
| 非 Marp 文書 | プレビュー内に「No Marp slides detected」ガイダンス表示 | Marp front matter / スライド区切り未検出時 |

### Preconditions

- プレビュー用 Webview / Panel が利用可能であること

### Behavior

#### 正常系

1. YAML front matter をパースし Marp テーマを適用する
2. 本文変更に追随してプレビューを更新する
3. RO / 編集モードいずれでもプレビューは表示できる

#### 例外系

1. レンダリング失敗時も `.md` ソースは変更しない
2. Marp スライドが検出されない文書では、プレビューパネルに **「No Marp slides detected」** とガイダンス（Marp front matter の追加方法等）を表示する

### Non-Goals

- Marp WYSIWYG 編集（backlog）
- スライド PDF / 画像エクスポート

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-038–042

---

## §7 画像貼付

### 概要

クリップボードから画像を貼り付け、`.md` と同階層の `img/` に保存し、相対パス参照を挿入する（AD-009, UD-007）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `clipboardImage` | `image/*` バイナリ | はい | 1 バイト | 実用上限未定（backlog） | jpg/png/gif/svg |
| `sequenceNumber` | 整数 | 自動 | 1 | 9999 | `image-NNNN` ゼロ埋め 4 桁 |
| `targetMdUri` | `vscode.Uri` | はい | — | — | 同階層 `img/` 基準 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | `img/image-NNNN.ext` 保存 + Markdown 画像参照挿入 | 上書きなし（UD-007） |
| 未保存新規 doc | paste 拒否、「Save document first」通知 | URI 未確定 |
| RO 中 | 操作拒否 | §5 |
| FS 書込失敗 | 通知、挿入なし | 権限・ディスク容量 |
| 非画像 paste | 無視（通常 paste へ委譲） | — |

### Preconditions

- 編集モードであること
- 対象 `.md` がディスク上の保存済みパスを持つこと（未保存新規 Untitled doc への paste は拒否）
- `img/` が無ければ作成する

### Behavior

#### 正常系

1. paste イベントで clipboard の image/* を検出する
2. 既存 `img/image-*.ext` の最大連番 + 1 でファイル名を採番する（欠番があっても重複しない）
3. 拡張子は MIME から決定（jpg/png/gif/svg）
4. Markdown に `img/image-NNNN.ext` 形式の相対パスを挿入する
5. URI は `vscode.Uri` で正規化しパストラバーサルを防ぐ

#### 例外系

1. 未保存新規 `.md`（`untitled:` scheme 等）への paste は拒否し、**「Save document first」** を通知する
2. ファイル移動時のパス自動更新は行わない（UD-007）
3. 参照されなくなった画像（孤児）は削除しない（RK-005 — backlog）

### Non-Goals

- 画像のリサイズ・圧縮の自動最適化
- 外部 URL への自動アップロード
- 孤児画像の自動削除（backlog）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-043–051

---

## §8 シリアライズ・保存

### 概要

内部モデルとディスク `.md` の双方向変換。決定的出力で Git diff 可読性を確保する（AD-004, AD-013）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `internalDoc` | ドキュメントモデル | はい | — | — | §2–§7 の統合 |
| `stringifyOptions` | 設定オブジェクト | はい | — | — | 行長・インデント・空行規則を固定 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | 決定的な UTF-8 Markdown 文字列 | round-trip 可能が望ましい |
| 変換失敗 | エラー、保存中断 | Output に概要（全文は出さない） |

### Preconditions

- normalize パスは保存前の単一経路に集約されること（AD-013）

### Behavior

#### 正常系

1. オープン時: `.md` → parse → 内部モデル
2. 保存時: 内部モデル → stringify（固定オプション）→ `.md`
3. HTML 表・許可 HTML は raw HTML ノードまたは同等手段で保持する
4. 同一内容に対し、連続保存で byte-identical 出力を目指す（AD-013）

#### 例外系

1. パース不能部分は raw 保持を優先し、失敗時はユーザーに通知する

### Non-Goals

- 他エディタとの完全な Markdown 相互変換（RK-002）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-052–056

---

## §9 セキュリティ

### 概要

信頼できない `.md` / HTML / Mermaid ソースに対する防御（AD-010, RK-003）。

### Inputs & Types

| 入力 | 型 | 必須 | 最小 | 最大 | 備考 |
|------|-----|------|------|------|------|
| `untrustedHtml` | `string` | 任意 | — | — | 外部ファイル取込 |
| `webviewCsp` | CSP 文字列 | はい | — | — | `default-src 'none'` 基調 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 備考 |
|------|-------------------|------|
| 成功 | サニタイズ済み HTML / SVG 表示 | 許可タグリスト適用 |
| 拒否 | 危険要素除去 | `<script>`, `on*` 属性等 |

### Preconditions

- `localResourceRoots` は拡張 `media/` とワークスペース `img/` に限定（AD-010）
- Extension Host 上で HTML を実行しない

### Behavior

#### 正常系

1. Webview に格 CSP を設定する（nonce 付き script/style）
2. 表示前に HTML をサニタイズする（表・画像・基本書式・Mermaid SVG を許可）
3. 画像保存先はワークスペース内に限定する

#### 例外系

1. サニタイズによりレイアウトが変わる場合がある（許容 — RK-002 とトレードオフ）

### Non-Goals

- ネットワーク経由のリモートコンテンツ取得
- 秘密情報の収集・外部送信

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-057–061

---

## §10 ログ・共存・配布

### 概要

障害可観測性と VS Code 標準 Markdown エディタとの共存（AD-014, AD-015）。

### Behavior

#### 正常系

1. Output チャンネル `MD WYSIWYG Editor` にシリアライズエラー・描画失敗を記録する（ファイル全文は含めない）
2. README に `workbench.editorAssociations` 設定例を記載し、本拡張を `.md` デフォルトにする手順を示す
3. `Reopen Editor With…` でビルトイン Markdown エディタへ切替可能とする

### Non-Goals

- Marketplace 公開手順の詳細（`vscode-extension-publish` スキル / deployment.md で扱う）

### Related Tests

- [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) — TC-062–064

---

## 共通 Non-Goals（MVP）

| 項目 | 参照 |
|------|------|
| Marp WYSIWYG 編集 | Intent Out / [backlog](backlog-vsc-md-wysiwyg.md) |
| Mermaid ビジュアルエディタ | 同上 |
| ワークスペース全体 Readonly | UD-005 Phase 2 / backlog |
| 画像パス自動更新（ファイル移動時） | UD-007 |
| 孤児画像の自動削除 | RK-005 / backlog |
| 大ファイル仮想スクロール | RK-004 / backlog |
| UI i18n（英語以外） | backlog |
| Markdown LSP 完全連携 | RK-008 / backlog |

---

## リスク・制約（RK-*）

| ID | 内容 | 本仕様での扱い |
|----|------|---------------|
| RK-001 | HTML 混在による Git diff 可読性低下 | AD-013 で緩和。レビューはプレビュー推奨 |
| RK-002 | 非標準 MD のポータビリティ | UD-001 承知のトレードオフ |
| RK-003 | XSS / 悪意ある HTML | §9 必須 |
| RK-004 | 大規模ファイル・多数 Mermaid の性能 | 500 KB 警告、最適化は backlog |
| RK-005 | 孤児画像蓄積 | UD-007、自動削除は backlog |
| RK-006 | GFM 表と HTML 表の混在 | スタイルガイド推奨 |
| RK-007 | Mermaid/Marp バージョン差異 | lockfile 固定推奨 |
| RK-008 | Custom Editor と LSP 競合 | MVP 非対応、backlog |
| RK-009 | stack 未確定時の CI 不明確 | AD-001 完了（`doc/stack.md` active 化） |

---

## Related Tests

| ドキュメント | 状態 |
|-------------|------|
| [doc/testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) | **作成済** — TC-001–066（P0/P1/P2） |
| MVP 外項目 | [doc/backlog-vsc-md-wysiwyg.md](backlog-vsc-md-wysiwyg.md) |

---

## Spec Gaps（resolved）

以下は Advisor defaults により解決済み。詳細は各 § および [testspec-vsc-md-wysiwyg.md](testspec-vsc-md-wysiwyg.md) を参照。

| 項目 | 解決内容 | 参照 TC |
|------|---------|---------|
| 表の行/列数上限 | ソフト上限 **100 行 × 20 列**。超過時 UI 警告、保存は許可 | TC-021–023 |
| 未保存新規 `.md` への画像 paste | paste 拒否 + **「Save document first」** 通知 | TC-050 |
| GFM パイプ表オープン時変換 | 初回編集時に HTML `<table>` へ変換（UD-001 整合） | TC-019 |
| 非 Marp 文書の Marp プレビュー | **「No Marp slides detected」** ガイダンス表示 | TC-042 |
| RO 未保存ワークスペース | 保存済み WS は `workspaceState` 永続化；未保存 WS はセッション内のみ | TC-027, TC-030 |

---

## 改訂履歴

| 日付 | 節 | 変更内容 |
|------|-----|---------|
| 2026-08-29 | 全体 | 初版。Requirements Brief `vsc-md-wysiwyg` に基づく MVP 仕様 |
| 2026-08-29 | §3, §4, §6, §7, Spec Gaps | Advisor defaults で Spec Gaps 解決。testspec-vsc-md-wysiwyg 連携 |
