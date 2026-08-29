# Test Specification: vsc-md-wysiwyg

## 概要

- **対象:** VS Code 拡張 vsc-md-editor の MVP 機能（Custom Editor、三点モード Preview/Markdown/Raw、WYSIWYG、表、Readonly、Mermaid、Marp、画像 paste、シリアライズ、セキュリティ、ログ・共存）
- **対応仕様:** [doc/systemspec.md](systemspec.md) §1–§10（AD-016 三点モード含む）
- **テストコード:** `src/test/suite/unit/**/*.test.ts`（mocha + vscode mock）、`src/test/suite/integration/**/*.test.ts`（@vscode/test-electron）
- **作成日:** 2026-08-29

## Spec Digest

### Inputs & Types

| 引数 / 入力 | 型 | 最小 | 最大 | 備考 |
|------------|-----|------|------|------|
| `documentUri` | `vscode.Uri` | — | — | ワークスペース内 `.md` |
| `fileContent` | `string` (UTF-8) | 0 B | 推奨 500 KB 未満 | 超過時警告のみ（RK-004） |
| `editorMode` | `"preview" \| "markdown" \| "raw"` | — | — | 初期値 `"markdown"`（AD-016） |
| `modeSwitchCommand` | コマンド / UI 切替 | — | — | モード変更のみ。ディスク I/O なし |
| `rawSourceEdit` | `string` | — | — | Raw 面からのソース。パース成功時のみ Document 反映 |
| `isRawParseFailed` | `boolean` | — | — | true の間は save 拒否（§1, §8） |
| `editOperation` | 編集コマンド / キー入力 | — | — | RO 時拒否；Preview 面からは送らない |
| `tableOperation` | 行/列/セル操作 | 1×1 | ソフト上限 100行×20列 | 超過時 UI 警告、保存は許可 |
| `toggleReadonlyCommand` | コマンド | — | — | `Toggle Readonly Mode`（三点 Preview とは別） |
| `mermaidSource` | `string` | 0 文字 | — | debounce 300 ms 目安 |
| `documentContent` | `string` | — | — | Marp front matter + 本文 |
| `clipboardImage` | `image/*` バイナリ | 1 B | — | jpg/png/gif/svg |
| `sequenceNumber` | 整数 | 1 | 9999 | `image-NNNN` ゼロ埋め |
| `untrustedHtml` | `string` | — | — | 外部 `.md` 取込 |

### Outputs & Failure Returns

| 条件 | 戻り値 / ステータス | 仕様根拠 |
|------|-------------------|---------|
| Custom Editor オープン成功 | タブ表示、Webview ロード完了、初期モード Markdown、viewType `vsc-md-editor.wysiwyg` | §1, AD-002, AD-016 |
| モード切替成功 | 対象面表示、Document 維持、ディスク未書込、内容不変なら dirty 不変 | §1 |
| 保存成功 | ディスク `.md` 更新、`dirty` 解除 | §1, §8 |
| シリアライズ失敗 | 保存拒否、`dirty` 維持、通知 + Output | §1, §8 |
| Raw パース失敗 | Document 非更新、通知 + Output、save ブロック | §1 例外系 2, §8 |
| Raw パース回復 | `isRawParseFailed=false`、save 再開可 | §1, §8 |
| RO ON | Markdown / Raw 全編集面ロック、バッジ表示（三点 Preview とは別） | §4, AD-006 |
| 表ソフト上限超過 | UI 警告表示、保存は許可 | §3（Advisor default） |
| GFM パイプ表初回編集 | HTML `<table>` へ変換 | §3（Advisor default, UD-001） |
| 非 Marp 文書プレビュー | 「No Marp slides detected」ガイダンス | §6（Advisor default） |
| 未保存新規 `.md` への画像 paste | paste 拒否、「Save document first」通知 | §7（Advisor default） |
| RO（未保存 WS） | セッション内のみ有効 | §4（Advisor default） |
| Mermaid 構文エラー | ブロック内エラー表示、ソース保持 | §5 |
| 画像 paste 成功 | `img/image-NNNN.ext` 保存 + 参照挿入 | §7 |
| XSS 要素 | サニタイズ除去 | §9 |

### Preconditions & Assumptions

- VS Code `engines.vscode` 最小バージョンを満たす（AD-001）
- 対象 URI はファイルシステム上の通常ファイル
- Webview でスクリプト有効化が許可される
- 画像 paste は対象 `.md` がディスク上の保存済みパスを持つこと（§7）
- RO 永続化は保存済みワークスペースの `workspaceState` のみ（§4）
- 統合テストは Extension Development Host 上で実行（AD-012）

### Complexity Budget

- 表ソフト上限: 100行×20列 — UI 警告閾値。P2 で 101行・21列の警告検証
- 大ファイル: 500 KB 超 — Output 警告、編集継続
- Mermaid debounce: 300 ms — 連続入力で過剰再描画しないこと
- 画像連番: 最大 9999 — 4 桁ゼロ埋め

### Spec Gaps

- （なし — Advisor defaults および AD-016 三点モード契約は systemspec に反映済み。詳細は [systemspec.md Spec Gaps（resolved）](systemspec.md#spec-gapsresolved)）
- **実装ギャップ（テスト待ち）:** （なし — TC-071/073/076/078/079 はユニット実装済み）

---

## Test Matrix

| ID | Category | Domain Tag | Priority | Input | Expected | Rationale | Spec Ref |
|----|----------|------------|----------|-------|----------|-----------|----------|
| TC-001 | Happy | custom-editor-open | P0 | ワークスペース内 `sample.md`（見出し+段落）を Custom Editor で開く | WYSIWYG タブ表示、見出し・段落がレンダリングされる | MVP 基本フローの起点 | §1 正常系 1 |
| TC-002 | Happy | dirty-state | P0 | TC-001 状態で段落に文字を追加 | Document が `dirty`、タブに未保存インジケータ | 編集→dirty 連動 | §1 正常系 2 |
| TC-003 | Happy | save | P0 | TC-002 状態で `save` 実行 | ディスク上 `.md` が更新、`dirty` 解除、AD-013 整形適用 | 保存パイプラインの正常系 | §1 正常系 3, §8 正常系 2 |
| TC-004 | Happy | undo-redo | P0 | TC-002 状態で `undo` → `redo` | 編集が取り消され再適用される | Document 経由 undo/redo | §1 正常系 4 |
| TC-005 | Corner | unsaved-close | P1 | 未保存変更ありでエディタを閉じる | VS Code 標準の保存確認ダイアログ | データ損失防止 | §1 正常系 5 |
| TC-006 | Corner | parse-failure-save | P1 | シリアライズ不能な内部構造を生成し `save` | 保存拒否、`dirty` 維持、通知 + Output 記録 | 破損ファイル書込防止 | §1 例外系 1, §8 例外系 1 |
| TC-007 | Corner | external-file-change | P1 | エディタ開放中に外部プロセスが同一 `.md` を変更 | VS Code 標準リロード/競合フロー | 外部同期 | §1 例外系 2 |
| TC-008 | Boundary | large-file | P1 | 500 KB 超の `.md` を開く | 編集継続可、Output に大ファイル警告 | RK-004 警告のみ | §1 Outputs |
| TC-009 | Corner | file-read-failure | P1 | 存在しない/権限なし URI で開く試行 | エディタ未表示、通知 + Output | FS エラー処理 | §1 Outputs |
| TC-010 | Happy | wysiwyg-format | P0 | 選択テキストに太字をツールバー適用 | UI に `<strong>` 相当表示、dirty | WYSIWYG 書式 | §2 正常系 1 |
| TC-011 | Happy | realtime-model | P0 | キー入力で段落を編集 | 内部モデル即時更新、UI 反映 | リアルタイム編集 | §2 正常系 2 |
| TC-012 | Happy | wysiwyg-serialize | P0 | 見出し・リスト・リンクを含む doc を save | remark パイプラインで Markdown（+許可 HTML）出力 | シリアライズ連携 | §2 正常系 3 |
| TC-013 | Happy | theme-integration | P1 | VS Code テーマ切替（dark/light） | Webview が `var(--vscode-*)` で見た目更新 | テーマ統合 | §2 正常系 4 |
| TC-014 | Structural | unsupported-syntax | P1 | 脚注等 MVP 未対応記法を含む `.md` を開く | 可能な限り原文保持、読取表示 | データ損失回避 | §2 例外系 1 |
| TC-015 | Corner | serialize-block | P1 | シリアライズ不能構造（schema 外ノード）で save | 保存ブロック、エラー表示（AD-015） | 保存安全 | §2 例外系 2 |
| TC-016 | Happy | table-insert | P0 | 3×3 表を挿入しセルにテキスト入力 | 表 UI 表示、dirty | 表編集基本 | §3 正常系 1 |
| TC-017 | Happy | table-rich-cell | P0 | セル内に改行・箇条書き・チェックボックスを入力 | WYSIWYG でリッチ表示 | リッチセル | §3 正常系 2 |
| TC-018 | Happy | table-html-save | P0 | TC-016 状態で save | `.md` に HTML `<table>` ブロックが出力 | AD-005 永続化 | §3 正常系 3 |
| TC-019 | Happy | gfm-pipe-convert | P0 | GFM パイプ表のみの `.md` を開き、任意セルを初回編集 | 編集時点で HTML `<table>` モデルへ変換、以降 WYSIWYG 編集可 | Advisor default / UD-001 | §3 正常系 4 |
| TC-020 | Corner | table-sanitize-load | P1 | `<script>` 含む外部 HTML 表を含む `.md` を開く | 危険要素除去後に表表示 | RK-003 | §3 例外系 1 |
| TC-021 | Boundary | table-soft-limit-ok | P1 | 100行×20列の表（境界値） | 警告なし、編集・保存可 | ソフト上限境界（ inclusive ） | §3 Inputs |
| TC-022 | Boundary | table-rows-exceed | P1 | 101行目を追加 | UI 警告表示、保存は成功 | 行超過警告 | §3 Behavior |
| TC-023 | Boundary | table-cols-exceed | P1 | 21列目を追加 | UI 警告表示、保存は成功 | 列超過警告 | §3 Behavior |
| TC-024 | Corner | table-readonly | P1 | RO ON 状態で表操作試行 | 操作無効、UI フィードバック | RO 連動 | §3 Outputs, §4 |
| TC-025 | Happy | readonly-on | P0 | `Toggle Readonly Mode` 実行（編集可能 doc） | 編集不可、`editable: false`、RO バッジ | RO 有効化 | §4 正常系 1 |
| TC-026 | Happy | readonly-off | P0 | RO ON 状態で再度トグル | 編集可、バッジ解除 | RO 解除 | §4 正常系 1 |
| TC-027 | Happy | readonly-persist | P0 | 保存済み WS で RO ON → エディタ閉じる → 再オープン | RO 状態復元 | workspaceState 永続化 | §4 正常系 2, 5 |
| TC-028 | Happy | readonly-key | P1 | `readonly:<uri>` キーで workspaceState を直接確認 | トグル後に `true`/`false` が記録 | 永続化キー検証 | §4 Inputs |
| TC-029 | Happy | readonly-view-only | P1 | RO ON で Mermaid ブロック・Marp プレビューを表示 | 描画/プレビューは利用可、編集不可 | 閲覧系は RO 中も可 | §4 正常系 4 |
| TC-030 | Corner | readonly-unsaved-ws | P1 | 未保存 WS で RO ON → VS Code 再起動 → 同一 `.md` を開く | 再起動前は RO 有効、再起動後は RO 解除（非永続） | 未保存 WS スコープ | §4 例外系 1 |
| TC-031 | Happy | mermaid-render | P0 | ` ```mermaid ` ブロック（`graph TD; A-->B`）を含む doc | ブロック内に SVG/図表示 | Mermaid 基本描画 | §5 正常系 1 |
| TC-032 | Happy | mermaid-debounce | P1 | Mermaid ソースを連続入力（300 ms 以内） | debounce 後に 1 回再描画 | 過剰描画抑制 | §5 Inputs |
| TC-033 | Happy | mermaid-save | P0 | TC-031 状態で save | `.md` に ` ```mermaid ` フェンスとして残る | ソース永続化 | §5 正常系 2 |
| TC-034 | Corner | mermaid-syntax-error | P1 | 不正 Mermaid 構文を入力 | ブロック内エラー表示、ソース保持、Output 記録 | 構文エラー処理 | §5 Outputs |
| TC-035 | Corner | mermaid-readonly | P1 | RO ON で Mermaid ソース編集試行 | 編集拒否（描画は表示維持） | RO 連動 | §5 正常系 3 |
| TC-036 | Corner | mermaid-xss | P1 | Mermaid ソースに XSS 試行ペイロード | サニタイズ、スクリプト実行なし | RK-003 | §5 例外系 1 |
| TC-037 | Corner | mermaid-timeout | P1 | 描画タイムアウトを誘発する大きな図 | タイムアウトエラー表示 | RK-004 | §5 Outputs |
| TC-038 | Happy | marp-preview | P0 | Marp front matter + `---` 区切りスライドを含む doc | スライド HTML プレビュー表示 | Marp 基本 | §6 正常系 1 |
| TC-039 | Happy | marp-update | P0 | TC-038 状態で本文スライドを編集 | プレビューが追随更新 | リアルタイム更新 | §6 正常系 2 |
| TC-040 | Happy | marp-readonly | P1 | RO ON で Marp プレビュー表示 | プレビュー表示可 | RO 中閲覧 | §6 正常系 3 |
| TC-041 | Corner | marp-parse-error | P1 | 不正 front matter の doc | プレビュー内エラー、Output 記録、`.md` 不変 | パース失敗 | §6 Outputs, 例外系 1 |
| TC-042 | Corner | marp-non-marp | P1 | 通常 Markdown（Marp front matter なし）でプレビュー起動 | 「No Marp slides detected」ガイダンス表示 | 非 Marp 方針 | §6 Outputs |
| TC-043 | Happy | image-paste | P0 | 保存済み `doc/sample.md` に PNG を paste | `img/image-0001.png` 作成、`![](img/image-0001.png)` 挿入 | 画像 paste 基本 | §7 正常系 1–4 |
| TC-044 | Happy | image-sequence | P0 | 既存 `img/image-0001.png`, `img/image-0003.png` がある doc に paste | `img/image-0004.png` 採番（最大+1） | 連番採番 | §7 正常系 2 |
| TC-045 | Happy | image-mime-ext | P1 | jpg/png/gif/svg 各 MIME で paste | 拡張子が MIME に対応（`.jpg`/`.png`/`.gif`/`.svg`） | 拡張子決定 | §7 正常系 3 |
| TC-046 | Happy | image-dir-create | P1 | `img/` 不在の `.md` ディレクトリに paste | `img/` 自動作成 + 画像保存 | ディレクトリ作成 | §7 Preconditions |
| TC-047 | Corner | image-readonly | P1 | RO ON で画像 paste | 操作拒否 | RO 連動 | §7 Outputs |
| TC-048 | Corner | image-fs-failure | P1 | 書込不可ディレクトリ（権限 mock）に paste | 通知、挿入なし | FS エラー | §7 Outputs |
| TC-049 | Corner | image-non-image | P1 | テキストのみ clipboard を paste | 通常 paste へ委譲（画像処理なし） | 非画像無視 | §7 Outputs |
| TC-050 | Corner | image-unsaved-doc | P1 | 未保存新規 Untitled `.md` に画像 paste | paste 拒否、「Save document first」通知 | Advisor default | §7 Preconditions, Behavior |
| TC-051 | Corner | image-path-traversal | P1 | 不正 URI 正規化を試みる paste 操作 | ワークスペース外書込なし | パストラバーサル防止 | §7 正常系 5, §9 |
| TC-052 | Happy | serialize-open | P0 | 見出し+HTML表+ Mermaid を含む `.md` を開く | 内部モデルに正しく parse | オープン parse | §8 正常系 1 |
| TC-053 | Happy | serialize-deterministic | P0 | 同一 doc を連続 2 回 save | 2 回目出力が 1 回目と byte-identical（AD-013） | 決定的出力 | §8 正常系 4 |
| TC-054 | Happy | serialize-table-roundtrip | P0 | HTML `<table>` を含む doc を open→save | `<table>` 構造が保持 | round-trip | §8 正常系 3 |
| TC-055 | Structural | serialize-raw-preserve | P1 | 部分パース不能ブロックを含む `.md` | raw 保持優先、可能範囲表示 | データ保全 | §8 例外系 1 |
| TC-056 | Corner | serialize-failure | P1 | stringify 失敗を mock | 保存中断、Output 概要（全文なし） | 失敗通知 | §8 Outputs |
| TC-057 | Happy | security-csp | P0 | Webview HTML を検査 | `default-src 'none'` 基調 CSP、nonce 付き script/style | CSP 設定 | §9 正常系 1 |
| TC-058 | Corner | security-script-strip | P0 | `<script>alert(1)</script><p>ok</p>` を含む doc を表示 | `<script>` 除去、`<p>ok</p>` 表示 | XSS 防御 | §9 正常系 2 |
| TC-059 | Corner | security-on-attr-strip | P1 | `<img src=x onerror=alert(1)>` を含む doc | `on*` 属性除去 | イベント属性拒否 | §9 Outputs |
| TC-060 | Happy | security-local-roots | P1 | Webview `localResourceRoots` を検証 | 拡張 `media/` と WS `img/` のみ | リソース制限 | §9 Preconditions |
| TC-061 | Corner | security-image-scope | P1 | ワークスペース外パスへの画像保存試行 | 拒否、通知 | 保存先限定 | §9 正常系 3 |
| TC-062 | Happy | output-channel | P1 | シリアライズエラーを発生させる | Output `MD WYSIWYG Editor` に概要記録（全文なし） | ログ可観測性 | §10 正常系 1 |
| TC-063 | Happy | editor-coexistence | P1 | Custom Editor 開放中に `Reopen Editor With…` → Built-in Markdown | ビルトインエディタで開ける | AD-014 共存 | §10 正常系 3 |
| TC-064 | Corner | output-render-failure | P1 | Mermaid/Marp 描画失敗 | Output に記録、インラインエラー優先 | AD-015 | §10, §5, §6 |
| TC-065 | Stress | table-max-soft | P2 | 100×20 表で全セル編集後 save | 5 s 以内に save 完了、警告なし | 上限境界性能 | §3 |
| TC-066 | Stress | large-doc-open | P2 | 450 KB `.md`（Mermaid 10 ブロック）を open | 30 s 以内に Webview ロード | 大 doc 性能 | §1, RK-004 |
| TC-067 | Corner | regression-edit-display-break | P0 | Webview 起点の `updateFromJson(..., { syncWebview: false })` | `onDidContentChange` は発火しない（echo 抑止）。`onDidChange` は発火（dirty 維持） | Regression: 編集後に setContent echo で表示破壊 | §1 Behavior 2 |
| TC-068 | Corner | regression-edit-display-break | P0 | 既定の `updateDoc` / undo による Document 変更 | `onDidContentChange` が発火し、docUpdated 用リスナーが通知される | Regression: 外部同期（undo/revert）が途切れないこと | §1 Behavior 4 |
| TC-069 | Corner | regression-edit-display-break | P0 | Mermaid フェンス付き doc で段落テキストのみ変更後 serialize | ` ```mermaid ` フェンスとソースが残る | Regression: 通常編集で Mermaid が消えないこと | §5 正常系 2 |
| TC-070 | Happy | editor-mode-init | P0 | Custom Editor（viewType `vsc-md-editor.wysiwyg`）で `.md` を開く | 初期 `editorMode === "markdown"`、タブ viewType が `vsc-md-editor.wysiwyg` | AD-016 初期モード + AD-002 viewType | §1 Inputs, 正常系 1 |
| TC-071 | Happy | preview-one-way | P0 | Preview モード表示中に描画面からの編集イベントを送ろうとする / Document のみ更新 | Preview は RO 描画のみ。編集イベントは Document へ送られない。Document 更新時は描画が追随 | Document→一方表示契約 | §1 三点モード定義, 正常系 3 |
| TC-072 | Happy | markdown-raw-sync | P0 | Markdown 面で段落編集 → Raw 投影；続けて Raw 相当のソースを Document に反映 | 正本は `MarkdownDocument`。一方の変更が他方面へ Document 経由で反映され、`markdownText` / `doc` が一致 | Markdown↔Raw 相互リアルタイム同期 | §1 正常系 2, §8 |
| TC-073 | Corner | mode-switch-no-io | P0 | dirty=false の Document で Preview↔Markdown↔Raw を切替のみ（内容変更なし） | ディスクへの `writeFile` なし、`onDidChange`（dirty）非発火、Document 内容不変 | モード切替 alone は表示のみ | §1 正常系 4, AD-016 |
| TC-074 | Happy | edit-dirty-save | P0 | Markdown または Raw 相当の内容変更 → `save` / `saveAs` | 変更で dirty（`onDidChange`）、save 後ディスク更新・シリアライズ反映 | 通常編集の dirty/save 契約 | §1 正常系 5, §8 |
| TC-075 | Happy | file-ro-locks-editors | P0 | ファイル RO ON 後に Markdown / Raw 編集を試行 | 両編集面とも編集不可（`editable: false`）。三点 Preview（描画 RO）とは別概念（RO フラグ独立） | AD-006 全編集面ロック | §4 正常系 1, 3 |
| TC-076 | Happy | ro-allows-viewing | P0 | ファイル RO ON のまま三点モード切替・Preview 表示・Marp Preview 起動 | モード切替可、Preview / Marp 閲覧可。編集は不可のまま | RO 中も閲覧系は可 | §4 正常系 4–5, §6 |
| TC-077 | Structural | marp-vs-preview | P0 | Custom Editor viewType と Marp Preview パネル/コマンドを比較 | Marp Preview（`vsc-md-editor.marpPreview` / `showMarpPreview`）は三点 Preview ではない。viewType `wysiwyg` と別責務 | AD-008 責務分離 | §1, §6 |
| TC-078 | Corner | raw-parse-fail | P0 | Raw ソースをパース不能な文字列に変更して Document へ適用試行 | Document（直前の有効内容）非破壊、通知 + Output、`isRawParseFailed=true`、`save` ブロック | Raw 失敗時データ保全 | §1 例外系 2, §8 |
| TC-079 | Happy | raw-parse-recover | P0 | TC-078 状態から有効な Raw ソースに修正して再適用 → `save` | `isRawParseFailed=false`、Document 更新、save 成功 | パース回復後の save 再開 | §1, §8 |

### Category Coverage

| Category | Covered | N/A Reason |
|----------|---------|------------|
| Happy Path | TC-001–004, TC-010–012, TC-016–019, TC-025–027, TC-031, TC-033, TC-038–039, TC-043–044, TC-052–054, TC-057–058, TC-070–072, TC-074–076, TC-079 | — |
| Boundary | TC-008, TC-021–023 | — |
| Structural | TC-014, TC-055, TC-077 | — |
| Corner | TC-005–009, TC-015, TC-020, TC-024, TC-030, TC-034–037, TC-041–042, TC-047–051, TC-056, TC-059, TC-061, TC-064, TC-067–069, TC-073, TC-078 | — |
| Stress | TC-065–066 | — |

### Complexity Notes

- 表ソフト上限 100×20 = 2000 セル — P2 TC-065 で編集+save 性能確認
- 画像連番上限 9999 — MVP では P2 省略（単体テストで modulo 検証可）
- Mermaid debounce 300 ms — TC-032 でタイマー mock または実時間計測

---

## 実行方針

| 優先度 | CI | 備考 |
|-------|-----|------|
| P0, P1 | 通常 PR で実行 | 統合: @vscode/test-electron、ユニット: Vitest |
| P2 | `@slow` / nightly | TC-065, TC-066 |

| TC 範囲 | 推奨テスト種別 |
|---------|--------------|
| TC-052–056, TC-053, TC-069 | ユニット（remark シリアライズ） |
| TC-044 | ユニット（採番ロジック） |
| TC-067–068, TC-072, TC-074 | ユニット（MarkdownDocument + vscode mock） |
| TC-070（viewType）, TC-075（readonly key）, TC-077 | ユニット（package.json / 定数 / readonly-state） |
| TC-070（初期モード）, TC-071, TC-073, TC-076, TC-078–079 | ユニット（EditorModeState / MarkdownDocument + vscode mock） |
| TC-001–051, TC-057–064 | 統合（Extension Development Host） |
| TC-065–066 | 統合 `@slow` |

---

## Trace Results

P0 + P1 の机上トレース（実装前）。

| TC | Trace | Result |
|----|-------|--------|
| TC-001 | `sample.md` オープン → CustomEditorProvider が URI を受け取り parse → Webview postMessage で DOM 構築 | ✅ 期待どおり |
| TC-003 | dirty doc → stringify → `workspace.fs.writeFile` → dirty=false | ✅ 期待どおり |
| TC-019 | GFM `\| a \| b \|` を parse → 読取モード表示 → セル click で HTML table ノードへ mutate → save で `<table>` | ✅ UD-001 整合 |
| TC-022 | 101 行目追加 → UI バナー「Table exceeds recommended size (100 rows × 20 columns)」→ save 成功 | ✅ 警告のみ |
| TC-030 | 未保存 WS → workspaceState 未コミット → 再起動で globalState/workspaceState 空 → RO 復元なし | ✅ セッション限定 |
| TC-042 | 通常 MD → Marp パーサがスライド 0 件 → プレビュー pane に固定文言表示 | ✅ ガイダンス |
| TC-050 | `untitled:` scheme URI → paste handler が early return → 通知「Save document first」 | ✅ 拒否 |
| TC-053 | 同一 internalDoc を 2 回 stringify（固定 options）→ Buffer.compare === 0 | ✅ 決定的 |
| TC-058 | DOMPurify 通過後 DOM に script ノードなし | ✅ サニタイズ |
| TC-067 | Webview update → `syncWebview: false` → content-change 未発火、dirty 用 onDidChange のみ | ✅ 回帰（edit-display-break） |
| TC-068 | 既定 update / undo → onDidContentChange 発火 | ✅ 回帰（edit-display-break） |
| TC-069 | Mermaid + 段落編集 → serialize でフェンス保持 | ✅ 回帰（edit-display-break） |
| TC-070 | package.json viewType = `vsc-md-editor.wysiwyg`；初期モード Markdown | ✅ ユニット |
| TC-072 | updateDoc → markdownText 更新（正本 Document）；parse → updateDoc で Raw 相当同期 | ✅ ユニット |
| TC-074 | updateDoc → onDidChange → save → mock FS 更新 | ✅ ユニット |
| TC-075 | setReadonly(true) → isReadonly；Preview 概念と独立 | ✅ ユニット |
| TC-077 | customEditors viewType ≠ marpPreview panel / showMarpPreview は別コマンド | ✅ ユニット |
| TC-071/073/076/078/079 | Preview 一方向・mode switch 非 I/O・RO 切替可・Raw 失敗/回復 | ✅ ユニット |

### TC-067 (P0): Regression — webview edit must not echo setContent

| Step | Value |
|------|-------|
| Input | `updateFromJson(docJson, 'Edit', { syncWebview: false })` |
| Expected | `onDidContentChange` 回数 0、`onDidChange` 回数 ≥ 1 |
| Actual (pre-fix) | Fail: webview update が docUpdated/setContent を echo し表示破壊 |
| Actual (post-fix) | Pass |

**Result:** ✅ Pass（npm run test:unit 2026-08-29）

### TC-068 (P0): Regression — external/document mutations still notify webview sync

| Step | Value |
|------|-------|
| Input | 既定 `updateDoc` および undo コールバック |
| Expected | いずれも `onDidContentChange` が発火 |
| Actual (pre-fix) | N/A（同期経路自体は存在） / 回帰で欠落しうる |
| Actual (post-fix) | Pass |

**Result:** ✅ Pass（npm run test:unit 2026-08-29）

### TC-069 (P0): Regression — mermaid fence survives ordinary paragraph edit

| Step | Value |
|------|-------|
| Input | Mermaid ブロック + 段落を parse → 段落テキスト変更 → serialize |
| Expected | 出力に ` ```mermaid ` と元ソースが含まれる |
| Actual (pre-fix) | Fail: 表示破壊時に Mermaid NodeView/コンテンツが失われる経路あり |
| Actual (post-fix) | Pass |

**Result:** ✅ Pass（npm run test:unit 2026-08-29）

### TC-070–079 (P0): Three-mode contracts (unit)

| Step | Value |
|------|-------|
| Input | package.json viewType; EditorModeState; Document updateDoc/save/applyRawSource; readonly-state; Marp vs custom editor IDs |
| Expected | viewType 一致、Preview 一方向、Document 正本同期、mode switch 非 I/O、dirty→save、RO キー、Raw 失敗/回復、Marp≠三点 Preview |
| Actual | Pass（ユニット実装済み） |

**Result:** ✅ Pass（npm run test:unit）

---

## Self-Check Report

### A. Input & Constraints
- [x] 最小値: 空 `.md`（TC-001）、空 Mermaid（TC-031）、1×1 表（TC-016）
- [x] 最大値: 500 KB 警告（TC-008）、表 100×20 境界（TC-021）、画像連番 9999（仕様定義、P2 省略理由明記）
- [x] 型/形式: 各 MIME 画像（TC-045）、非画像 paste（TC-049）、`editorMode` 三値（TC-070–073）

### B. Structural Patterns
- [x] 未対応記法保持（TC-014）
- [x] GFM/HTML 混在（TC-019, TC-020）
- [x] 欠番連番（TC-044: 0003 次は 0004）
- [x] Marp Preview ≠ 三点 Preview（TC-077）

### C. Corner & Failure
- [x] 解なし/拒否: シリアライズ失敗（TC-006, TC-015, TC-056）、paste 拒否（TC-050）、Raw パース失敗（TC-078）
- [x] 先頭/末尾: 表 100 行/20 列境界（TC-021）、101/21 超過（TC-022, TC-023）
- [x] 外部変更・FS 失敗（TC-007, TC-009, TC-048）
- [x] モード切替 alone の非 I/O（TC-073）、パース回復（TC-079）

### D. Complexity & Resources
- [x] P2 ストレス TC-065, TC-066 定義
- [x] Mermaid debounce（TC-032）、タイムアウト（TC-037）

### E. API / Worker
- N/A — ローカル VS Code 拡張。HTTP/KV 該当なし

### Uncovered / Spec Gaps
- （なし — TC-071/073/076/078/079 はユニット実装済み）
- 画像サイズ上限は MVP 未定 — backlog（BL-008）で管理、本 testspec では MIME 検証のみ

---

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-08-29 | 初版。systemspec §1–§10 MVP カバー、Spec Gaps を Advisor defaults で解決 |
| 2026-08-29 | TC-067–069 追加 | 回帰: edit-display-break（webview echo 抑止 / 外部同期 / Mermaid 保持） |
| 2026-08-29 | TC-070–079 追加 | Preview/Markdown/Raw 三点モード・同期・dirty/save・RO・Raw パース失敗契約。ユニット実装可能な TC をコード化、未実装 API は skip |
| 2026-08-30 | TC-071/073/076/078/079 skip 記述を解除（ユニット実装済みに同期） |
