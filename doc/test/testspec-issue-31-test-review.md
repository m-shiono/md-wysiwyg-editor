# Test Specification: issue-31-test-review

## 概要

- **対象:** GitHub Issue #31 (`m-shiono/md-wysiwyg-editor#31`) に向けた 4 層テスト刷新（`readRepoFile` 静的検査の JSDOM / 実関数テスト置換・モック互換強化・偽陽性修正・`@vscode/test-electron` 完全ライフサイクル & Mermaid ESM チャンク実ロード検証）および互換性・セキュリティ・CSP バグ（`AD-001`–`AD-008`, `UD-001` Option A）の振る舞い検証仕様
- **feature-slug:** `issue-31-test-review`
- **対応仕様:** [doc/requirements/systemspec.md](../requirements/systemspec.md) §1, §4, §5, §6, §7, §8, §9, §10, §11, §13, §15, §16 / `temporary/requirements-brief-issue-31-test-review.md`（`AD-001`–`AD-008`, `UD-001` Option A）
- **テストコード（想定配置 — `testspec-implementation` で作成）:**
  - `src/test/mocks/vscode.ts`（強化版 VS Code モック）
  - `src/test/suite/unit/*.test.ts`（Mocha + JSDOM / Node 単体テスト）
  - `src/test/suite/integration/*.test.ts`（`@vscode/test-electron` 統合テスト）
- **作成日:** 2026-11-15

---

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|---|---|---|---|---|
| `documentUri` | `vscode.Uri` | — | — | `file:` / `vscode-remote:` / `untitled:` 各スキームの `.md`。`vscode.Uri.joinPath` と `vscode.workspace.fs` でスキーム/authority を保全（`AD-005`） |
| `openContext` | `vscode.CustomDocumentOpenContext` | — | — | `backupId?: string`（Hot Exit 復元用） |
| `webviewMessage` | `WebviewInboundMessage` | — | — | `ready`, `update`（`epoch: updateEpoch` 付き）, `pasteImage` 等 |
| `hostMessage` | `WebviewOutboundMessage` | — | — | `init`, `imageInserted`（`displaySrc` + `relativePath` 分離）, `themeUpdated`, `readonlyChanged`, `modeChanged` |
| `updateEpoch` | `number` | `0` | — | HTML→GFM 表変換等で Host `_minUpdateEpoch` が加算される。画像挿入後の `update` でも現在 `updateEpoch` を必須送信（`AD-004`） |
| `editorCommand` | コマンド ID | — | — | `toggleReadonly`, `showMarpPreview`, `showNativeMarkdownPreview`, `openWithWysiwyg`, `exportDocument`/`Html`/`Pdf`/`Docx`/`Pptx`, CSV/Backlog 5 種 |
| `activeEditorContext` | `TextEditor \| TabInputCustom` | — | — | CSV/Backlog 5 コマンドは Text Editor フォーカス専用（`UD-001` Option A） |
| `appProfile` | `vscode.env.appName` | — | — | VS Code / Cursor / Windsurf / Antigravity / VSCodium プロファイル |
| `timeoutMs` | `number` | `1` ms | `5000` ms+ | `PlantUmlRenderer` / Marp CLI のプロセス強制終了境界 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 仕様根拠 |
|---|---|---|
| `openCustomDocument` 読込失敗 | 例外を throw せず安全なフォールバック状態で生成 + 通知/Output | §1 Outputs, `C-2` |
| Webview `ready` → `init` | 実 DOM（`#editor .ProseMirror` 等）に描画、CSP 下で `mermaid-chunk.js` / `mermaid-layout-elk.js` 動的 `import()` 成功 | §1, §5, §9, `AD-002` |
| `save` / `saveAs` / `revert` / `backup` / `undo` / `redo` | Document 正本・ディスク・Webview 状態が一致。終了時 `ENOENT` 発生なし | §1, §8, `AD-002` |
| `imageInserted` + `update` | Webview は `displaySrc` で即時表示、`originalSrc` は相対パス `img/...`。`epoch` 付与により HTML→GFM 変換後も更新保持 | §7, §8, `AD-004` |
| Marp Preview パネル CSP | `enableScripts: false`、`localResourceRoots` は `media/` + 対象 `img/` のみ、`img-src ${webview.cspSource} data: https:` | §6, §9, `AD-004`, `RK-032` |
| `vscode-remote:` / `untitled:` | `vscode-remote:` はスキーム/authority 保持＋`isSafeImagePath` 防御。`untitled:` は画像 paste 拒否（`Save document first`）、`img/` ルート混入なし | §1, §7, §9, §13, `AD-005` |
| Export 5 コマンド Dirty Gate | `MarkdownDocument.isDirty` / `TextDocument.isDirty` 時に Save/Cancel 確認、Save 後のみ実行。バッファは `MarkdownDocument` 優先参照 | §8 正常系 14, §13, `AD-006`, `C-1` |
| `updateReadonlyBadge` | ON で ` (Readonly)` を 1 回付与、OFF で確実に除去、反復トグルで冪等 | §4 Outputs, `AD-006` |
| `isBuiltinSwitchToSameMdFile` | `vscode.markdown.preview.editor` 等のプレビュー/AI 差分 `TabInputCustom` は `false`（除外） | §10 正常系 4, `AD-006` |
| `activationEvents` | `contributes.commands` 全 16 コマンド（`toggleReadonly`, `showMarpPreview` 含む）を列挙 | §1 Inputs, `AD-006` |
| CSV/Backlog 5 コマンド（Custom Editor 上） | 無言終了せず案内通知を表示（`copyAsBacklog` のみ `MarkdownDocument` 全体フォールバック許容） | §16, `UD-001` Option A |
| 派生 IDE 非干渉 & 外部 CLI | `showNativeMarkdownPreview` 失敗時は Error + Output（`showPreviewToSide` 禁止）。ショートカットはフォーカス限定消費。Marp CLI はローカル優先＋`shell: false` | §10, §11, §13, §15, `AD-007` |

### Preconditions & Assumptions

- `@types/vscode` は `^1.85.0` を下限とし、1.86+ 限定 API を使用しない（`AD-007`）。
- Webview DOM / TipTap テストは `jsdom`（既存 `devDependencies`）上で実 DOM とイベント発火により実行し、JSDOM 非対応の CSP 強制・ESM `import()`・SVG 計測のみ `@vscode/test-electron` 実 Webview 統合テストで補完する（`RK-006`）。
- 派生 IDE（Cursor, Windsurf, Antigravity, VSCodium）固有挙動は強化版 `vscode` モック（`env.appName`, `TabInput*` 等）による単体検証と運用スモークチェックリスト（`doc/operations/operations.md`）で担保する（`RK-031`）。
- `src/test/suite/unit/` の `readRepoFile` 検査はランタイム不変条件（CSS セレクタ、`package.json` メタデータ等）に限定し、実行可能ロジック・DOM 振る舞いは実実行テストへ置換する（`AD-001`）。

### Complexity Budget

- テスト実行時間: `npm run test:unit` は Mocha + JSDOM で数秒以内、P2 `@slow` ライフサイクル反復テストのみ夜間/明示実行を許容。
- 統合テスト終了時クリーンアップは条件ベース待機（`waitFor`）を用い、固定 `setTimeout` に依存しない（`.cursor/rules/tests-vscode-extension.mdc`）。

### Spec Gaps

- なし（`AD-001`–`AD-008` および `UD-001` Option A により確定済み。`systemspec.md` §1, §4, §6, §7, §8, §9, §10, §11, §13, §15, §16 に反映済み）。

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|---|---|---|---|---|---|---|---|
| `TC-I31-001` | Corner | provider-safe-open | P0 | 存在しない/読込エラーを返す URI で `MarkdownEditorProvider.openCustomDocument` を呼出 | 例外を throw せず、安全なフォールバック状態（空ドキュメント等）の `MarkdownDocument` を返し、通知 + Output ログを記録する（`testspec-vsc-md-wysiwyg.md` `TC-184` と連携） | `openCustomDocument` 安全初期化契約（`C-2`） | §1 Outputs, `AD-008` |
| `TC-I31-002` | Happy | integration-webview-handshake | P0 | `@vscode/test-electron` 上でサンプル `.md` を `md-wysiwyg-editor.wysiwyg` で開く（`deliverWebviewMessageForTest` 不使用） | 実 Webview が `ready` を送信し、Host が `init`（`docJson`, `mode`, `theme`）を返信、Webview DOM（`#editor .ProseMirror` / `body[data-mode]`）が描画・モード切替できる | Webview 実起動ハンドシェイク検証（`AD-002`） | §1 正常系, `AD-002` |
| `TC-I31-003` | Happy | integration-save-saveas | P0 | Custom Editor 上でドキュメント編集（dirty 化）後、`saveCustomDocument`（`workbench.action.files.save`）および `saveCustomDocumentAs` を実行 | `save` で元ファイルが更新され `isDirty === false` になる。`saveAs` で新 URI に出力され、`MarkdownDocument` 内容が一致する | 保存・別名保存ライフサイクル検証（`AD-002`） | §1, §8, `AD-002` |
| `TC-I31-004` | Happy | integration-revert | P0 | Custom Editor 上で編集（dirty 化）後、ディスク上の元内容へ `revertCustomDocument`（`workbench.action.files.revert`）を実行 | `MarkdownDocument` がディスク内容へ復元され、`isDirty === false` になり、Webview へ最新 `docJson` が同期される | Revert ライフサイクル検証（`AD-002`） | §1, §8, `AD-002` |
| `TC-I31-005` | Happy | integration-backup-hotexit | P0 | dirty な `MarkdownDocument` に対して `backupCustomDocument` を実行し、返却されたバックアップ情報（`backupId`）で `openCustomDocument(..., { backupId })` を呼出 | バックアップファイルが生成・削除され、`backupId` 付き再オープン時に未保存テキストが復元される | Hot Exit / Backup 復元検証（`AD-002`） | §1 Outputs, `AD-002` |
| `TC-I31-006` | Happy | integration-undo-redo | P0 | `MarkdownEditorProvider` 経由で `update` 編集を行い、`onDidChangeCustomDocument` に通知された edit の `undo()` → `redo()` を実行 | `undo()` で編集前の `MarkdownDocument` 状態に戻り Webview へ通知され、`redo()` で再適用される | Custom Editor Undo/Redo スタック検証（`AD-002`） | §1, `AD-002` |
| `TC-I31-007` | Happy | integration-config-theme-listener | P1 | Custom Editor 開放中に `workspace.onDidChangeConfiguration`（`defaultMode` 等）および `window.onDidChangeActiveColorTheme` を発火 | 設定変更時は `syncDocumentModeWithConfig` 等で反映され、テーマ変更時は `themeUpdated` が Webview へ送信される | 設定・テーマ動的追随検証（`AD-002`） | §1, §5, `AD-002` |
| `TC-I31-008` | Corner | integration-dispose-no-enoent | P1 | Custom Editor を dirty 状態にした後、明示 save または revert 完了を待機してからエディタを閉鎖し `fs.rmSync(tmpDir)` を実行 | `webviewPanel.onDidDispose` で `_openPanels` / `_openDocuments` / `editorSwitchGuard` が解放され、終了ログに `revertCustomDocument` の `ENOENT` スタックトレースが出力されない | `ENOENT` 競合根絶とリソース解放（`AD-002`） | §1, `AD-002` |
| `TC-I31-009` | Happy | integration-mermaid-esm-csp | P0 | `@vscode/test-electron` 実 Webview で ` ```mermaid ` ブロックを含む `.md` を開く | Host `getHtml()` の厳格 CSP（`script-src 'nonce-...' ${webview.cspSource}`, `'unsafe-inline'` なし）下で `media/mermaid-chunk.js` の動的 `import()` が成功し `.mermaid-preview svg` が描画される | Mermaid ESM チャンク実 CSP 通過確認（`AD-002`） | §5, §9, `AD-002` |
| `TC-I31-010` | Happy | integration-mermaid-elk-csp | P0 | `@vscode/test-electron` 実 Webview で `layout: elk` frontmatter 付き Mermaid ブロックを含む `.md` を開く | 厳格 CSP 下で `media/mermaid-layout-elk.js` の動的 `import()` および ELK ローダ登録が成功し、エラーなく SVG が描画される | ELK 遅延チャンク実 CSP 通過確認（`AD-002`） | §5 正常系 12, §9, `AD-002` |
| `TC-I31-011` | Happy | cmd-toggle-readonly | P0 | Custom Editor アクティブ状態で `vscode.commands.executeCommand('md-wysiwyg-editor.toggleReadonly')` を実行 | `workspaceState` が反転し、Webview へ `readonlyChanged` が送信され、`panel.title` に ` (Readonly)` が付与/解除される | `toggleReadonly` コマンド実実行検証（`AD-002`） | §4, `AD-002` |
| `TC-I31-012` | Happy | cmd-show-marp-preview | P0 | Marp 文書（および非 Marp 文書）の Custom Editor アクティブ状態で `vscode.commands.executeCommand('md-wysiwyg-editor.showMarpPreview')` を実行 | Marp Preview WebviewPanel が生成され、Marp 文書ではスライド HTML、非 Marp 文書では `'No Marp slides detected'` が表示される | `showMarpPreview` コマンド実実行検証（`AD-002`） | §6, `AD-002` |
| `TC-I31-013` | Happy | cmd-show-native-preview | P0 | Custom Editor アクティブ状態で `md-wysiwyg-editor.showNativeMarkdownPreview`（および別名 `...ToSide`）を実行 | `markdown.showPreview` が呼ばれ、同一 editor group に標準 Preview が開き、`showPreviewToSide` へフォールバックしない | `showNativeMarkdownPreview` 実実行検証（`AD-002`） | §1, §10, `AD-002` |
| `TC-I31-014` | Happy | cmd-open-with-wysiwyg | P1 | Text Editor で `.md` を開いた状態で `vscode.commands.executeCommand('md-wysiwyg-editor.openWithWysiwyg', uri)` を実行 | `vscode.openWith` により `md-wysiwyg-editor.wysiwyg` Custom Editor タブが開く | `openWithWysiwyg` コマンド実実行検証（`AD-002`） | §10 正常系 5, `AD-002` |
| `TC-I31-015` | Happy | unit-register-export-commands | P0 | 強化版モック下で `registerExportCommands` を登録し、`exportDocument`（QuickPick）/ `exportHtml` / `exportPdf` / `exportDocx` / `exportPptx` ハンドラを実行 | SaveDialog・QuickPick・非 Marp PPTX 拒否・Pandoc/Marp CLI 未導入通知・HTML ファイル出力まで実コード経路が動作する | `registerExportCommands` 静的検査からの実実行置換（`AD-001`） | §13, `AD-001` |
| `TC-I31-016` | Happy | unit-register-csv-backlog-commands | P0 | 強化版モックで `activeTextEditor` を設定し `registerTableCsvBacklogCommands` 登録済み 5 コマンドを実行 | `convertCsvToMarkdownTable`, `convertMarkdownTableToCsv`, `copyTableAsCsv`, `copyAsBacklog`, `pasteBacklogAsMarkdown` がエディタ置換・クリップボード書込を正しく実行する | `registerTableCsvBacklogCommands` 実実行置換（`AD-001`） | §16, `AD-001` |
| `TC-I31-017` | Corner | ud001-csv-backlog-custom-editor-notice | P0 | Custom Editor がアクティブ（`activeTextEditor === undefined`）状態で CSV/Backlog 5 コマンドをコマンドパレット等から実行 | 無言終了（silent no-op）せず、Text Editor 専用である旨の案内通知（`InformationMessage` / `WarningMessage`）を表示する（`copyAsBacklog` のみ `MarkdownDocument` 全体コピーフォールバック可） | `UD-001` Option A 契約の担保 | §16, `UD-001` |
| `TC-I31-018` | Happy | jsdom-find-widget-runtime | P0 | JSDOM 上に `FindWidget`（`media/find-widget.ts`）と TipTap/Raw/Marp アダプタをマウントし、検索・前後移動・単一/全置換・Case/Word/Regex・不正 Regex・Preview/RO ガードを発火 | 各アダプタでハイライト/選択範囲移動・置換・件数表示が動作し、不正 Regex でクラッシュせず、Preview/RO では置換 UI が隠れる | `FindWidget` `readRepoFile` 検査の JSDOM 実実行置換（`AD-001`） | §11, `AD-001` |
| `TC-I31-019` | Happy | jsdom-table-context-menu-runtime | P0 | JSDOM + TipTap 上で表セル（`td`/`th`）に `contextmenu` イベントを発火し、各操作クリック・`Escape`/外部クリック・RO/Preview/Raw ガードを実行 | Visual 非 RO 時のみ `#table-context-menu` が表示され、行/列操作・移動・複製・アライメント・表削除が実ドキュメントを更新し、`Escape`/外部クリックで閉じる | `table-context-menu` 静的検査の JSDOM 実実行置換（`AD-001`） | §3, `AD-001` |
| `TC-I31-020` | Happy | jsdom-gfm-format-toolbar-runtime | P0 | JSDOM + TipTap 上で `#toolbar` 各ボタン（Strike, H3–H6, Inline Code, Task List, Blockquote, HR, Link）をクリックし、RO / Preview / Raw ガードを確認 | TipTap ノード/マークが更新され `aria-pressed` が同期し、RO / Preview / Raw では編集が発火しない | `gfm-format-toolbar` DOM 操作の JSDOM 実実行置換（`AD-001`） | §2, §4, `AD-001` |
| `TC-I31-021` | Happy | jsdom-math-block-runtime | P0 | JSDOM 上で `MathBlock` NodeView（`math` / `latex`）をマウントし、有効 LaTeX・構文不正 LaTeX・XSS 入力・Preview モード CSS を検証 | `.math-block`（`.math-preview` + `.math-source`）が構築され、KaTeX HTML が DOMPurify サニタイズ後に描画され、不正構文は `.katex-error`（非クラッシュ）になる | `MathBlock` `readRepoFile` 検査の JSDOM 実実行置換（`AD-001`） | §14, `AD-001` |
| `TC-I31-022` | Happy | jsdom-sanitize-mermaid-svg-direct | P0 | 切り出した `sanitizeMermaidSvg` 関数を JSDOM 上で直接呼び出し、`<foreignObject><div>Cause A</div></foreignObject>` + `<script>` + `onload` を渡す | `foreignObject` と子 HTML ラベルが保持され、`<script>` / `on*` / `javascript:` が除去される（正規表現 + `new Function` 抽出テストを廃止） | `sanitizeMermaidSvg` 直接関数実行への置換（`AD-001`） | §5, §9, `AD-001` |
| `TC-I31-023` | Happy | unit-marp-preview-manager | P1 | 強化版モック上で `MarpPreviewManager` の `showPreview` / `update` / `dispose` / 非 Marp 時の動作を実行 | パネルが生成・再利用され、ドキュメント更新に追随し、`dispose` 時に参照がクリアされる | `MarpPreviewManager` クラス単体テスト追加（`AD-001`） | §6, `AD-001` |
| `TC-I31-024` | Structural | mock-vscode-class-parity | P0 | `src/test/mocks/vscode.ts` の `TabInputCustom` / `TabInputWebview` / `TabInputText`、`workspace.getConfiguration`/`fs`/`textDocuments`、`window.activeColorTheme`/`showQuickPick`/`showSaveDialog`/`createWebviewPanel`、`env.appName`/`remoteName`/`clipboard` を検査 | すべて `instanceof` 判定可能な実クラス・実イベントエミッタとして機能し、テスト内のアドホックなグローバルモンキーパッチと条件付きスキップを不要にする | モック形状不一致・スキップ撲滅（`AD-003`, `B-4`） | `AD-003` |
| `TC-I31-025` | Corner | puml-timeout-real-wait | P0 | `PlantUmlRenderer.renderSvg(source, { timeoutMs: 100 })` に 100ms 超待機する（早期終了しない）モック/Node プロセスを渡す | 確実に `100ms` タイムアウト経路へ到達してプロセスを kill し、タイムアウトエラー例外（または指定のタイムアウト処理）のアサーションが必ず実行される | `TC-PUML-006` 偽陽性テスト修正（`AD-003`, `B-2`） | §12, `AD-003` |
| `TC-I31-026` | Structural | integration-vs-unit-separation | P1 | `src/test/suite/integration/extension.test.ts` とユニットスイートの責務を検証 | 純粋定数/関数チェック（`TC-028` `getReadonlyKey`, `TC-057` ダミー文字列 CSP, `TC-062` 定数, `TC-042` 定数）はユニット層へ移設され、`extension.test.ts` は実 `provider.getHtml()` CSP 等の実 Host 結合のみを実行する | 統合テストの形骸化解消（`AD-001`, `B-5`） | `AD-001` |
| `TC-I31-027` | Happy | image-inserted-display-src-separation | P0 | `handleImagePaste` で PNG 画像を保存し、送信される `imageInserted` メッセージと Webview TipTap ノード属性・保存時 Markdown 出力を検査 | `imageInserted` に `displaySrc`（`asWebviewUri` 済み）と `relativePath`（`img/image-0001.png`）が含まれ、Webview は `src=displaySrc` で即時表示しつつ `originalSrc=relativePath` を保持し、serialize 出力は `img/image-0001.png` になる | 画像貼付の即時表示と Webview URI 漏洩防止（`AD-004`, `D-2`, `RK-026`） | §7, §8, `AD-004` |
| `TC-I31-028` | Corner | image-inserted-update-epoch | P0 | 同一セッション内で HTML→GFM 表変換を実行（`updateEpoch >= 1`）した後、画像を貼付/ドロップして Webview → Host の `update` メッセージを検証 | `media/editor.ts` の `imageInserted` 後 `vscode.postMessage({ type: 'update', docJson, epoch })` に現在の `epoch: updateEpoch` が付与され、Host の `shouldAcceptWebviewUpdate` が受理して Document が更新される | `epoch` 欠落による画像更新ドロップバグ修正（`AD-004`, `D-2`） | §7, §8, `AD-004` |
| `TC-I31-029` | Structural | marp-preview-csp-img-roots | P0 | `MarpPreviewManager` でローカル画像 `![alt](img/slide.png)` を含む Marp 文書を表示し、`WebviewOptions.localResourceRoots` と `wrapPreviewHtml` の CSP を検査 | `enableScripts: false`、`localResourceRoots` は拡張 `media/` と対象親ディレクトリ配下 `img/` のみ（ワークスペース全体/親ディレクトリ除外）、CSP は `img-src ${webview.cspSource} data: https:`（`script-src` なし）となり、`<img src>` が `asWebviewUri` に解決される | Marp パネル画像描画と最小権限 CSP 両立（`AD-004`, `D-5`, `RK-032`） | §6, §9, `AD-004` |
| `TC-I31-030` | Happy | vscode-remote-uri-preservation | P0 | `vscode-remote://ssh-remote+myhost/workspace/docs/note.md` 等を対象に `getWorkspaceImgRoots`、`webviewUriResolver`、`image-uri-rewrite`、`marp-preview`、`native-markdown-preview`（`showNativeMarkdownPreview` / `resolvePreviewUri`）、`export-document`（デフォルト出力 URI・不正 `%` エンコード `<img src>`）、`editor-switch-guard`（`getActiveMarkdownUri` 非 `file` URI）、`MarkdownEditorProvider.onDidReceiveMessage`（不正ペイロード・不正 `tableOperation` `docJson`）を実行 | すべての URI 演算で `scheme === 'vscode-remote'` と `authority` が保持され、`file://` へのスキーム脱落が発生せず、不正 `%` エンコード `<img src>` および不正 `postMessage` / `tableOperation` `docJson` が例外を throw せず安全に無視・ログ記録される | Remote-SSH / Dev Containers 互換性およびレビュー修正ガードの回帰担保（`AD-005`, `D-1`） | §1, §6, §7, §10, §13, `AD-005` |
| `TC-I31-031` | Corner | vscode-remote-path-traversal | P0 | `vscode-remote://ssh-remote+host/ws/doc.md` に対し、`img/ok.png`、`../secret.png`、`img/%2e%2e/evil.png`、`img\..\evil.png`、`file:///etc/passwd`、`.env` を `isSafeImagePath` と Host rewrite に通す | `img/ok.png` のみ許可・rewrite され、トラバーサル・エンコード迂回・バックスラッシュ・別スキーム・非画像拡張子はすべて拒否される | Remote 環境でのパストラバーサル防御（`AD-005`, §9） | §7, §9, `AD-005` |
| `TC-I31-032` | Boundary | untitled-uri-safe-handling | P0 | `untitled:Untitled-1.md` を対象に `getWorkspaceImgRoots`、画像 paste/D&D、`showMarpPreview`、`exportHtml`、`exportDocx`（外部 CLI）を実行 | `getWorkspaceImgRoots` に無効 URI が混入せず、画像 paste/D&D は `'Save document first'` 通知で拒否され、Marp Preview / HTML Export はメモリバッファから動作し、外部 CLI Export は保存案内で安全中断する | `untitled:` スキーム境界の安全処理（`AD-005`, `D-1`） | §1, §6, §7, §13, `AD-005` |
| `TC-I31-033` | Happy | export-dirty-gate-all-5-commands | P0 | `MarkdownDocument.isDirty === true`（および `TextDocument.isDirty === true`）状態で `exportDocument`, `exportHtml`, `exportPdf`（通常 & Marp）, `exportDocx`, `exportPptx` を実行（Save 選択 vs Cancel 選択） | 全 5 コマンドでエクスポート前に Save/Cancel 確認ダイアログが表示され、Save 選択時は `save()` 成功後のみ出力し、Cancel または save 失敗時は出力ファイルを生成せず中断する | Export Dirty Gate 契約（`TC-EXP-008` / `C-1` / `AD-006`） | §8 正常系 14, §13, `AD-006` |
| `TC-I31-034` | Happy | export-and-marp-read-custom-doc-buffer | P0 | ディスク内容 `"# Old"`、Custom Editor 内未保存 `MarkdownDocument.markdownText === "# Updated\n---\nSlide"`（`activeTextEditor === undefined`）で `exportHtml` / `getDocumentText` / `showMarpPreview` を実行 | ディスク上の旧内容ではなく `MarkdownDocument.markdownText`（`"# Updated..."`）が参照・出力される | Custom Editor 正本バッファ優先参照（`AD-006`, `D-3`） | §6, §13, `AD-006` |
| `TC-I31-035` | Boundary | readonly-badge-idempotent | P0 | `panel.title === "note.md"` に対し、`updateReadonlyBadge` を ON → ON → OFF → OFF → ON → OFF と連続実行 | 1 回目 ON で `"note.md (Readonly)"`、2 回目 ON でも重複せず `"note.md (Readonly)"`、OFF で確実に `"note.md"` へ戻る | `updateReadonlyBadge` 多重付与/解除漏れバグ修正（`AD-006`, `D-5`） | §4 Outputs, `AD-006` |
| `TC-I31-036` | Corner | switch-guard-tabinputcustom-exclusion | P0 | `isBuiltinSwitchToSameMdFile` に同一 `.md` の (a) `TabInputCustom(uri, 'vscode.markdown.preview.editor')`、(b) `TabInputCustom(uri, 'markdown.preview.editor')`、(c) `TabInputWebview('markdown.preview')`、(d) `TabInputText(uri)` を渡す | (a)(b)(c) は `false`（Pattern A 非誤検知）、(d) は `true` を返す | 到達不能コードバグ修正とプレビュー除外（`AD-006`, `D-5`） | §10 正常系 4, `AD-006` |
| `TC-I31-037` | Structural | manifest-activation-events-complete | P0 | `package.json` の `contributes.commands` と `activationEvents` を突合 | 全 16 コマンド（`md-wysiwyg-editor.toggleReadonly` および `md-wysiwyg-editor.showMarpPreview` を含む）に対応する `onCommand:<id>` が `activationEvents` に存在する | `activationEvents` 欠落解消（`AD-006`, `D-4`） | §1 Inputs, `AD-006` |
| `TC-I31-038` | Boundary | vscode-api-min-version-1-85 | P1 | `package.json` `engines.vscode`（`^1.85.0`）、`devDependencies['@types/vscode']`、および `tsc --noEmit` 型チェック結果を検証 | `@types/vscode` が `^1.85.0` 互換範囲であり、`src/` 内に 1.86+ 限定 API 呼び出しが存在せず型チェックが通る | API 下限バージョン互換性担保（`AD-007`, `D-4`） | §1 Preconditions, `AD-007` |
| `TC-I31-039` | Corner | derivative-ide-native-preview-no-fallback | P1 | `vscode.env.appName` を `'Cursor'` / `'Windsurf'` / `'Antigravity'` / `'VSCodium'` に設定し、`markdown.showPreview` 欠如または `moveActiveEditor` 失敗をモックして `showNativeMarkdownPreview` を実行 | クラッシュせず `ErrorMessage` + Output ログを出力し、`markdown.showPreviewToSide` は一切呼ばれない | 派生 IDE でのコマンド欠如時安全失敗（`AD-007`, `RK-031`） | §10 正常系 7, `AD-007` |
| `TC-I31-040` | Happy | derivative-ide-focus-scoped-shortcuts | P0 | JSDOM Webview で (a) `document.body` フォーカス時に `Cmd+K` / `Cmd+F` / `Cmd+H` を発火、(b) `#raw-editor` フォーカス時に `Cmd+K` を発火、(c) `#editor` または `#find-widget` フォーカス時に `Cmd+F` / `Cmd+H` を発火 | (a) では `defaultPrevented === false`（ワークベンチ/派生 IDE ショートカットを横取りしない）。(b)(c) では期待機能（リンク挿入 / FindWidget 表示）が動作し消費される | 派生 IDE（Cursor `Cmd+K` 等）ショートカット衝突防止（`AD-007`） | §10, §11, §15, `AD-007` |
| `TC-I31-041` | Corner | marp-cli-local-priority-offline-shell-false | P1 | ワークスペース `node_modules/.bin/marp` 存在時 vs 不在・オフライン時で Marp PDF / PPTX エクスポートを実行（ファイル名にシェルメタ文字 `a;rm -rf.md` を含むケース含む） | ローカル `marp` を `npx -y` より優先探索し、プロセス起動はすべて `shell: false` で実行され、CLI 未導入/オフライン/タイムアウト時は明瞭なエラー通知を出してハングしない | オフライン耐性・CLI 優先探索・コマンドインジェクション防止（`AD-007`, `RK-030`） | §9 正常系 10, §13, `AD-007` |
| `TC-I31-042` | Stress | lifecycle-repeated-open-close-stress | P2 | `@vscode/test-electron` 上で Custom Editor のオープン → 編集 → 保存/リバート → 閉鎖サイクルを 10 回連続実行（`@slow`） | 全サイクルがタイムアウト内で完了し、終了時 `ENOENT` が 0 件かつリスナ/タイマーリークによる誤発火がない | ライフサイクル反復耐性とクリーンアップ安定性 | §1, `AD-002` |

### Category Coverage

| Category | Covered | N/A Reason |
|---|---|---|
| Happy Path | `TC-I31-002`–`007`, `009`–`016`, `018`–`023`, `027`, `029`, `030`, `033`, `034`, `040` | — |
| Boundary | `TC-I31-032`, `035`, `038` | — |
| Structural | `TC-I31-024`, `026`, `029`, `037` | — |
| Corner | `TC-I31-001`, `008`, `017`, `025`, `028`, `031`, `036`, `039`, `041` | — |
| Stress | `TC-I31-042` (`@slow`) | 大規模ドキュメント・100×20 表の Stress は既存 `TC-065` / `TC-066` でカバー |

### Complexity Notes

- アルゴリズム計算量制約は該当なし（Extension Host / Webview DOM / プロセス制御契約）。
- P2 `TC-I31-042` は `@slow` タグ付きとし、通常 PR の高速単体チェックと分離実行可能にする。

---

## 実行方針

| 優先度 | CI / 実行コマンド | 備考 |
|---|---|---|
| P0, P1（ユニット） | `npm run test:unit` | Mocha + 強化版 `vscode` モック + JSDOM（`test_single`: `npm run test:unit -- --grep 'TC-I31-'`） |
| P0, P1（統合） | `npm run test:integration` | `@vscode/test-electron`（Linux CI 上は `xvfb-run -a npm run test:integration`） |
| P2 | `npm run test:integration -- --grep '@slow'` | `TC-I31-042`（nightly / リリース前） |
| 品質ゲート | `npm run typecheck && npm run lint && npm run test` | `.cursor/stack.md` Quality コマンド |

---

## Trace Results

P0–P2 テストケースの検証結果（2026-11-15 実測 Green）。

### TC-I31-001 (P0): `openCustomDocument` 安全読込

| Step | State / Action | Value |
|---|---|---|
| Input | 不正/存在しない URI で `provider.openCustomDocument(uri, {}, token)` | `ENOENT` を返す FS |
| 1 | `MarkdownDocument.create` / `openCustomDocument` | エラーを捕捉し Output + 通知 |
| Output | 例外を throw せずフォールバック `MarkdownDocument` を返却 | VS Code 予期せぬエラーダイアログなし |

**Result:** ✅ Pass（2026-11-15 実測）

---

### TC-I31-002–008 (P0/P1): Provider 完全ライフサイクル & `ENOENT` 解消（統合）

| Step | State / Action | Value |
|---|---|---|
| Input | `@vscode/test-electron` で `.md` を `md-wysiwyg-editor.wysiwyg` で開く | `deliverWebviewMessageForTest` バイパスなし |
| 1 | Webview `ready` → Host `init` | 実 DOM 描画 + モード切替 |
| 2 | `save` / `saveAs` / `revert` / `backup` (`backupId`) / `undo` / `redo` | Document・ディスク・Webview 一致 |
| 3 | `onDidChangeConfiguration` / `onDidChangeActiveColorTheme` | 動的追随 + `themeUpdated` |
| 4 | 保存/リバート完了待機 → Close → `fs.rmSync` | `dispose` 完了、終了時 `ENOENT` 0 件 |

**Result:** ✅ Pass（2026-11-15 実測）

---

### TC-I31-009–010 (P0): 実 Webview Mermaid / ELK ESM チャンク動的 `import()`

| Step | State / Action | Value |
|---|---|---|
| Input | Mermaid 図 / `layout: elk` 図を含む `.md` を実 Webview で表示 | `getHtml()` 厳格 CSP |
| 1 | `import(/* webpackIgnore: true */ ...)` | `mermaid-chunk.js` / `mermaid-layout-elk.js` ロード |
| Output | `.mermaid-preview svg` 描画成功 | CSP 違反エラーなし |

**Result:** ✅ Pass（2026-11-15 実測）

---

### TC-I31-011–017 (P0/P1): コマンド実実行 & `UD-001` Option A

| Step | State / Action | Value |
|---|---|---|
| 1 | `executeCommand`: `toggleReadonly`, `showMarpPreview`, `showNativeMarkdownPreview`, `openWithWysiwyg` | 実拡張コマンド経路が動作 |
| 2 | `registerExportCommands` 5 コマンド（Mock + QuickPick/SaveDialog） | 全 5 形式ルーティング検証 |
| 3 | `registerTableCsvBacklogCommands` 5 コマンド（Text Editor vs Custom Editor） | Text Editor で変換成功、Custom Editor では案内通知表示（`UD-001` Option A） |

**Result:** ✅ Pass（2026-11-15 実測）

---

### TC-I31-018–023 (P0/P1): JSDOM 実 DOM / 関数テスト置換

| Step | State / Action | Value |
|---|---|---|
| 1 | `FindWidget` / Table Context Menu / Format Toolbar / `MathBlock` | JSDOM 上でイベント発火・DOM 検証 |
| 2 | `sanitizeMermaidSvg` / `MarpPreviewManager` | エクスポート関数・クラスの直接実行検証 |
| Output | `readRepoFile` + 正規表現マッチへの過度な依存を解消 | リファクタ耐性と実バグ検出力を両立 |

**Result:** ✅ Pass（2026-11-15 実測）

---

### TC-I31-024–026 (P0/P1): Mock 互換・`TC-PUML-006` 偽陽性解消・統合/単体分離

| Step | State / Action | Value |
|---|---|---|
| 1 | `src/test/mocks/vscode.ts` に実クラス `TabInput*`・`fs`・`env` 等を実装 | `instanceof` 整合、スキップ廃止 |
| 2 | `TC-PUML-006` に実際待機プロセスを指定 | `timeoutMs: 100` 到達し kill・タイムアウト検証実行 |
| 3 | `extension.test.ts` の定数確認を単体へ移設 | 統合テストは実 `getHtml()` CSP 等に集中 |

**Result:** ✅ Pass（2026-11-15 実測）

---

### TC-I31-027–041 (P0/P1): バグ修正 & 派生 IDE 互換性

| Step | State / Action | Value |
|---|---|---|
| `TC-I31-027–028` | `imageInserted` の `displaySrc`/`relativePath` 分離 + `epoch` 付与 | 即時表示かつ HTML→GFM 後も保存維持、相対パスのみ永続化 |
| `TC-I31-029` | `MarpPreviewManager` `localResourceRoots` (`media/` + `img/`) + `${cspSource}` | スライド内ローカル画像表示 + 最小権限維持 |
| `TC-I31-030–032` | `vscode-remote:` スキーム保全/トラバーサル防御（`native-markdown-preview`, `export-document` defaultUri + 不正 `%` `<img src>`, `editor-switch-guard` `getActiveMarkdownUri`, `onDidReceiveMessage` / `tableOperation` ガード含む）+ `untitled:` 安全拒否 | `Uri.joinPath` + `workspace.fs` 統一・不正入力安全処理 |
| `TC-I31-033–034` | Export 全 5 コマンド Dirty Gate + `MarkdownDocument` 優先参照 | 未保存内容漏落・未確認出力なし |
| `TC-I31-035–037` | `updateReadonlyBadge` 冪等化、`TabInputCustom` プレビュー除外、`activationEvents` 16 件完備 | 多重バッジ・誤検知・初回起動漏れ解消 |
| `TC-I31-038–041` | `^1.85.0` API、派生 IDE 失敗時非フォールバック、フォーカス限定ショートカット、ローカル `marp` 優先 + `shell: false` | 派生 IDE・オフライン・セキュリティ互換 |

**Result:** ✅ Pass（2026-11-15 実測）

### Summary

| ID | Priority | Result | Notes |
|---|---|---|---|
| `TC-I31-001`–`TC-I31-041` | P0 / P1 | ✅ Pass（2026-11-15） | unit 455 passing + integration 20 passing（`ENOENT` 0 件） |
| `TC-I31-042` | P2 (`@slow`) | ✅ Pass（2026-11-15） | `issue-31-lifecycle.integration.test.ts` で 10-cycle stress 通過 |

---

## Self-Check Report

### A. Input & Constraints
- [x] **最小値 / 空の入力:** 空/読込失敗 URI（`TC-I31-001`）、`untitled:` 未保存ドキュメント（`TC-I31-032`）
- [x] **最大値 / オーバーフロー:** タイムアウト上限（`TC-I31-025`, `TC-I31-041`）、反復ライフサイクル負荷（`TC-I31-042`）
- [x] **符号・型:** URI スキーム 3 種（`file`, `vscode-remote`, `untitled`）、`TabInput*` 実クラス `instanceof`（`TC-I31-024`, `TC-I31-036`）、`updateEpoch` 数値整合（`TC-I31-028`）

### B. Structural Patterns
- [x] **全要素同一 / 偏り:** ON/OFF 反復トグル冪等性（`TC-I31-035`）、連続 open/close（`TC-I31-042`）
- [x] **順序・ソート:** ローカル `marp` → PATH → `npx -y` 探索優先順（`TC-I31-041`）、`MarkdownDocument` → `TextDocument` → FS 参照優先順（`TC-I31-034`）
- [x] **非連結・サイクル:** N/A — グラフ構造なし（代わりに 4 層テストピラミッド分離 `TC-I31-026` と `dispose` 解放 `TC-I31-008` を検証）

### C. Corner & Failure
- [x] **解が存在しない場合:** `openCustomDocument` 読込失敗（`TC-I31-001`）、CLI 未導入/オフライン（`TC-I31-015`, `TC-I31-041`）、派生 IDE コマンド欠如（`TC-I31-039`）、Custom Editor 上での Text Editor 専用コマンド実行（`TC-I31-017`）
- [x] **先頭・末尾のアクセス:** パストラバーサル境界（`TC-I31-031`）、`epoch` 境界（`TC-I31-028`）、フォーカス有無境界（`TC-I31-040`）

### D. Complexity & Resources
- [x] **時間計算量:** `TC-PUML-006` タイムアウト強制終了（`TC-I31-025`）、Marp CLI タイムアウト（`TC-I31-041`）、`@slow` 分離（`TC-I31-042`）
- [x] **スタック深度:** N/A — 非再帰イベント駆動アーキテクチャ

### E. API / Worker（該当なし — ローカル VS Code 拡張）
- [x] **HTTP ステータス / 認証・認可:** N/A — ローカル拡張（Webview CSP / `localResourceRoots` 最小権限境界は `TC-I31-009`, `TC-I31-010`, `TC-I31-029`, `TC-I31-031` で検証）
- [x] **外部依存失敗:** `markdown.showPreview` 欠如（`TC-I31-039`）、PlantUML タイムアウト（`TC-I31-025`）、Pandoc/Marp CLI 未導入/オフライン（`TC-I31-015`, `TC-I31-041`）

### Uncovered / Spec Gaps
- 派生 IDE（Cursor, Windsurf, Antigravity, VSCodium）実機上での GUI 起動は `@vscode/test-electron` の対象外のため、モックプロファイル単体テスト（`TC-I31-039`, `TC-I31-040`）＋リリース前手動スモークテスト（`doc/operations/operations.md`）で補完する（`RK-031`）。

### AD-* / UD-* Traceability

| 要件 ID | 対応 TC |
|---|---|
| `AD-001` (4層テスト & `readRepoFile` 置換) | `TC-I31-015`, `TC-I31-016`, `TC-I31-018`–`023`, `TC-I31-026` |
| `AD-002` (統合ライフサイクル / CSP ESM / `ENOENT` 解消) | `TC-I31-002`–`014`, `TC-I31-042` |
| `AD-003` (Mock クラス互換 & `TC-PUML-006` 修正) | `TC-I31-024`, `TC-I31-025` |
| `AD-004` (`imageInserted` `displaySrc`+`epoch`, Marp CSP/`img/`) | `TC-I31-027`, `TC-I31-028`, `TC-I31-029` |
| `AD-005` (`vscode-remote:`/`untitled:` スキーム保全 & 防御) | `TC-I31-030`, `TC-I31-031`, `TC-I31-032` |
| `AD-006` (バッファ優先・Dirty Gate・Badge・Switch Guard・Manifest) | `TC-I31-033`, `TC-I31-034`, `TC-I31-035`, `TC-I31-036`, `TC-I31-037` |
| `AD-007` (`^1.85.0`・派生 IDE 非干渉・Marp CLI・`shell: false`) | `TC-I31-038`, `TC-I31-039`, `TC-I31-040`, `TC-I31-041` |
| `AD-008` (三者整合 `C-2` `openCustomDocument` 安全読込) | `TC-I31-001`（および既存 testspec 4 ファイル修正） |
| `UD-001` Option A (CSV/Backlog Text Editor 専用 + Custom Editor 通知) | `TC-I31-016`, `TC-I31-017` |

---

## Trace Results（Green 実測 — 2026-11-15）

| TC ID | テストファイル | 状態 | 実行結果 / 備考 |
|---|---|---|---|
| `TC-I31-001` | `src/test/suite/unit/issue-31-compat-and-security.test.ts` | ✅ Pass | `openCustomDocument` が `ENOENT` 時に throw せずフォールバック `MarkdownDocument` を返却（2026-11-15） |
| `TC-I31-002`–`014`, `026`, `042` | `src/test/suite/integration/issue-31-lifecycle.integration.test.ts` | ✅ Pass | `@vscode/test-electron` 実 Extension Host / 実 Webview（Mermaid ESM & ELK 動的 `import()`、CSP、保存/復元/Undo/Redo、10-cycle stress）通過・`ENOENT` 0 件（2026-11-15） |
| `TC-I31-015`–`017` | `src/test/suite/unit/document-export.test.ts`, `table-csv-backlog-commands.test.ts` | ✅ Pass | Export 5 コマンド & CSV/Backlog 5 コマンド実実行、Custom Editor 上案内通知（`UD-001` Option A）通過（2026-11-15） |
| `TC-I31-018`–`021` | `find-replace-widget.test.ts`, `table-context-menu.test.ts`, `gfm-format-toolbar.test.ts`, `katex-math.test.ts` | ✅ Pass | JSDOM 実ランタイムで通過（2026-11-15） |
| `TC-I31-022` | `mermaid-contrast-readable.test.ts`, `fix-mermaid-edge-styles.test.ts`, `mermaid-redux-elk-fidelity.test.ts`, `mermaid-readable-viewport.test.ts` | ✅ Pass | `src/utils/mermaid-sanitize.ts` の `sanitizeMermaidSvg` 直接インポート・JSDOM 呼び出しへ置換し通過（2026-11-15） |
| `TC-I31-023`–`025` | `marp-preview-manager.test.ts`, `issue-31-compat-and-security.test.ts`, `plantuml-support.test.ts` | ✅ Pass | 強化モック・`TC-PUML-006` 実待機タイムアウト検証通過（2026-11-15） |
| `TC-I31-027`–`029`, `031`–`038`, `040`, `041` | `issue-31-compat-and-security.test.ts`, `document-export.test.ts`, `editor-switch-guard.test.ts`, `native-preview-side-and-default-raw.test.ts`, `marp-preview-manager.test.ts` | ✅ Pass | `TC-I31-027` `#editor img:not(.ProseMirror-separator)` 修正・`TC-124` `AD-004` 整合後、全件通過（2026-11-15） |
| `TC-I31-030` | `src/test/suite/unit/issue-31-compat-and-security.test.ts` | ✅ Pass | `native-markdown-preview`・`export-document`（`vscode-remote:` defaultUri & 不正 `%` エンコード `<img src>`）・`editor-switch-guard`（`getActiveMarkdownUri` 非 `file` URI）・`MarkdownEditorProvider` `onDidReceiveMessage` 不正ペイロード & `tableOperation` `docJson` ガードを含めて全件通過（2026-11-15 再実測） |
| `TC-I31-039` | `src/test/suite/unit/issue-31-compat-and-security.test.ts` | ✅ Pass | 4 派生 IDE プロファイルで `markdown.showPreview` / `moveActiveEditor` 失敗時に `markdown.showPreviewToSide` へフォールバックせず ErrorMessage + OutputChannel ログ出力を確認（2026-11-15） |

集計（2026-11-15 最終実行）: `npm run typecheck` Pass / `npm run lint` Pass / `npm run test:unit` 455 passing (0 failing) / `npm run test:integration` 20 passing (0 failing, `ENOENT` 0 件)

### 参考: 初回 Red Baseline（2026-11-15 `testspec-implementation` 時点）

- `npm run test:unit`: 433 passing, 22 failing / `npm run test:integration`: 16 passing, 4 failing（本番実装およびテスト側矛盾 4 件解消前の記録）

---

## 改訂履歴

| 日付 | 変更内容 |
|---|---|
| 2026-11-15 | 初版作成。`temporary/requirements-brief-issue-31-test-review.md`（`AD-001`–`AD-008`, `UD-001` Option A）および `doc/requirements/systemspec.md` に基づき `TC-I31-001`–`042` を設計 |
| 2026-11-15 | `testspec-implementation` 実行。全 42 TC を unit/integration/JSDOM に実装し Red ベースラインを記録 |
| 2026-11-15 | テスト側矛盾 4 件解消（`TC-I31-039` 非フォールバック+Error/Output 検証、`TC-124` `AD-004` 整合、Mermaid 3 スイート `sanitizeMermaidSvg` 直接呼び出し化、`TC-I31-027` `.ProseMirror-separator` 除外）後、`typecheck`/`lint`/`test:unit` (455 passing)/`test:integration` (20 passing, `ENOENT` 0 件) の Green 実測結果を Trace Results に記録 |
| 2026-11-15 | レビュー修正回帰検証として `TC-I31-030` を強化（`native-markdown-preview` / `export-document` defaultUri & 不正 `%` `<img src>` / `editor-switch-guard` `getActiveMarkdownUri` / `MarkdownEditorProvider` `onDidReceiveMessage` ガード）し、`typecheck`/`lint`/`test:unit` (455 passing)/`test:integration` (20 passing, `ENOENT` 0 件) の再実測結果を Trace Results に記録 |
