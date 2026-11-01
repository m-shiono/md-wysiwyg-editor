# Testspec: image-rich-editing（画像リッチ編集）

| 項目 | 値 |
|------|-----|
| Task ID | `image-rich-editing` |
| 対象仕様 | [systemspec.md](../requirements/systemspec.md) §7 画像貼付・リッチ画像編集 / §8 / §9 セキュリティ・CSP |
| 要件 | `temporary/requirements-brief-image-rich-editing.md`（AD-001〜AD-005, RK-001〜RK-004） |
| ランナー | `.cursor/stack.md` の `test_runner` に従う |

## 方針

- 単体テストは純関数（`src/serializers/` の画像シリアライズ / パース、`src/utils/` の width/align/alt ヘルパ・D&D 判定・Lightbox 判定）を優先対象とする。
- DOM / Webview 依存部分はソース静的検証（CSP・CSS セレクタ・`preventDefault` ガード）で補完する。
- 属性順序の正本: `src` → `alt` → `title`（存在時）→ `width`（存在時）→ `align`（存在時）、自己閉じ ` />`。

## Test Matrix

| TC ID | 種別 | 観点 | 優先度 | 入力 / 手順 | 期待結果 | 目的 | 仕様参照 |
|-------|------|------|--------|-------------|----------|------|----------|
| TC-IRE-001 | Happy | serialize-markdown-default | P0 | image ノード `{src: webviewURI, originalSrc: "img/image-0001.png", alt: "diagram", width: null, align: null}` をシリアライズ | `![diagram](img/image-0001.png)` を出力（HTML 化しない） | width/align 未指定時の標準 Markdown 維持 | §7, AD-002 |
| TC-IRE-002 | Happy | serialize-html-attr-order | P0 | `{originalSrc:"img/image-0001.png", alt:"diagram", title:"t", width:"50%", align:"center"}` をシリアライズ | `<img src="img/image-0001.png" alt="diagram" title="t" width="50%" align="center" />`（順序固定）。title/width/align 欠落時は該当属性のみ省略 | 決定的出力 | §7, AD-002 |
| TC-IRE-003 | Happy | round-trip-idempotent | P0 | ① `![a](img/x.png)` ② `<img src="img/x.png" alt="a" width="320" align="right" />` を parse → serialize を 2 回繰り返す | 両ケースとも 1 回目と 2 回目が byte-identical、かつ入力と同一 | 往復の冪等性 | §7, AD-002 |
| TC-IRE-004 | Corner | html-escaping | P0 | alt=`a"b<c>&d`, title=`"x"` を HTML 形式でシリアライズし再パース | 属性値が `&quot;` `&lt;` `&gt;` `&amp;` にエスケープされ、再パースで元文字列に復元 | 属性破壊・注入防止 | §9, AD-002 |
| TC-IRE-005 | Corner | empty-alt | P1 | alt=`""`、width=`"25%"` | `alt=""` を省略せず出力 | alt 保持 | §7, AD-002 |
| TC-IRE-006 | Error | no-webview-uri-leak | P0 | `src` に `https://file+.vscode-resource.vscode-cdn.net/...` / `vscode-webview://...` を持ち `originalSrc="img/image-0002.png"`（Markdown・HTML 両形式） | 出力に webview URI を含まず `img/image-0002.png` に復元。`originalSrc` 欠落時も Host 逆変換で相対パスへ正規化（不能なら webview URI を書かない） | RK-002 文書破損防止 | §7, §9, RK-002 |
| TC-IRE-007 | Happy | relative-path-preserved | P0 | `<img src="img/sub/a.png">`、外部 `https://example.com/a.png` | 相対パス・外部 URL がそのまま保持。`isSafeImagePath` 不通過（`../a.png`, 絶対パス）は Host 解決されず、src は改変しない | 相対パス保護 | §7, §9, AD-002 |
| TC-IRE-008 | Error | sanitizer-allowlist-xss | P0 | `<img src="img/a.png" alt="x" width="50%" height="10" align="left" data-align="left" onerror="alert(1)" onload="x" style="width:9px" class="c">`、および `src="javascript:alert(1)"` | `src`,`alt`,`title`,`width`,`height`,`align`,`data-align` のみ残存。`on*`・`style` 等は除去、`javascript:` src は無効化 | XSS 防御 | §9, AD-002 |
| TC-IRE-009 | Corner | invalid-attr-values | P1 | `align="middle"`, `width="abc"`, `width="-5"` をパース | 不正 align → `null`、不正 width → `null`（クラッシュしない） | 異常値耐性 | §7, AD-001 |
| TC-IRE-010 | Happy | csp-safe-render | P0 | `renderHTML` / NodeView の属性出力、`media/editor.css`、Webview CSP を静的検証 | width/align は `width` / `data-width` / `data-align` / `align` 属性で出力し `style` 属性を生成しない。CSS に `img[data-align="left/center/right"]` セレクタが存在。CSP `style-src` に `'unsafe-inline'` なし。ドラッグ中も `element.style` 書き込みなし | CSP 違反回避 | §9, AD-001, RK-001 |
| TC-IRE-011 | Happy | resize-preset-helper | P0 | プリセット helper に `25%`/`50%`/`75%`/`100%` | `'25%'`/`'50%'`/`'75%'`/`null`（100%=Reset） | プリセット仕様 | §7, AD-003 |
| TC-IRE-012 | Boundary | drag-resize-clamp | P0 | ドラッグ幅正規化 helper に 31, 32, 320.6, 親幅+10（親幅 800） | 32（最小クランプ）, 32, `'321'`, `'800'`（上限クランプ）。px は整数文字列 | 境界値 | §7, AD-003 |
| TC-IRE-013 | Happy | align-toggle-helper | P0 | 現在値 × クリック値: `null×center`, `center×center`, `left×right` | `center`, `null`（同一再クリック解除）, `right` | 配置トグル | §7, AD-003 |
| TC-IRE-014 | Happy | alt-update-helper | P1 | alt 更新 helper に `"  new alt "`, `""` | 属性が更新値に置換（空文字可）、他属性不変、1 トランザクション | Alt 編集 | §7, AD-003 |
| TC-IRE-015 | Happy | dnd-single-webp | P0 | 保存済み `.md` に `image/webp` ファイル 1 件ドロップ | `img/image-NNNN.webp` に保存、ドロップ位置に相対参照挿入、既存ファイル上書きなし | webp 拡張 | §7, AD-004 |
| TC-IRE-016 | Happy | dnd-multiple-ordered | P0 | png, jpg, gif 3 件同時ドロップ（既存最大 0003） | リスト順に 0004/0005/0006 として順次保存・挿入 | 順次採番 | §7, AD-004 |
| TC-IRE-017 | Error | dnd-reject | P0 | ① untitled ドキュメントへドロップ ② `text/plain` / `application/pdf` ファイル ③ png+pdf 混在 | ① 保存せずエラー通知 ② 無視 ③ png のみ処理 | 不正入力拒否 | §7, AD-004 |
| TC-IRE-018 | Error | dnd-mode-suppression | P0 | Readonly モード / Preview モード / Source モード外での画像ドロップ判定 helper | Readonly・Preview では挿入・保存を行わない（既定遷移も抑止） | モードガード | §4, §7, AD-004 |
| TC-IRE-019 | Corner | dnd-non-file-ignored | P0 | `dataTransfer.types` が `text/plain` / `text/html` のみ（エディタ内テキスト D&D） | 画像ハンドラは介入せず TipTap 既定挙動へ委譲 | 誤介入防止 | §7, AD-004 |
| TC-IRE-020 | Error | dnd-navigation-guard | P0 | エディタルートの `dragover` / `drop`（Files 含む）を静的・DOM 検証 | `preventDefault()` が呼ばれ Webview が画像へ画面遷移しない | RK-003 | §7, RK-003 |
| TC-IRE-021 | Happy | lightbox-open-conditions | P0 | Lightbox 判定 helper: Preview×click, Visual×click, Visual×dblclick, Visual×Zoom, Readonly×click | Preview→open, Visual click→open しない（選択のみ）, dblclick/Zoom→open, Readonly→open | 操作競合回避 | §7, AD-005, RK-004 |
| TC-IRE-022 | Happy | lightbox-close | P0 | Lightbox 表示中に Escape / 背景クリック / 画像本体クリック | Escape・背景で閉じフォーカス復帰、画像本体クリックでは閉じない | 閉操作 | §7, AD-005 |
| TC-IRE-023 | Corner | lightbox-no-dirty | P0 | Lightbox 開閉を繰り返す | ドキュメント変更・dirty・Undo 履歴が発生しない。CSP 違反（inline style）なし | 副作用なし | §7, §9, AD-005 |
| TC-IRE-024 | Happy | popover-ui-strings | P1 | ミニポップオーバー静的検証 | プリセット 4 種・配置 3 種・Alt 入力・Zoom ボタンが英語ラベルで存在、Readonly 時は非表示 | UI 契約 | §7, AD-003 |

## カバレッジ

| 要件 | TC |
|------|----|
| AD-001 / RK-001 | 009, 010 |
| AD-002 / RK-002 | 001–008 |
| AD-003 | 011–014, 024 |
| AD-004 / RK-003 | 015–020 |
| AD-005 / RK-004 | 021–023 |

## Trace Results

| ID | Priority | Result | Notes |
|----|----------|--------|-------|
| TC-IRE-001〜004, 006〜008, 010〜013, 015〜023 | P0 | 🟢 Pass | `npm run test:unit -- --grep "TC-IRE-"` (20 passing) / `npm run test:unit` (446 passing) |
| TC-IRE-005, 009, 014, 024 | P1 | 🟢 Pass | `npm run test:unit -- --grep "TC-IRE-"` (4 passing) / `npm run test:unit` (446 passing) |

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-11-01 | 初版（test-agent / spec-test-design） |
| 2026-11-01 | testspec-implementation: `src/test/suite/unit/image-rich-editing.test.ts` に TC-IRE-001〜024（24件）を実装、`src/test/unit-entry.ts` に登録し TDD Red 動作を確認 |
| 2026-11-01 | build-agent / review-agent: build 実装完了および Green 確定に伴い Trace Results を Pass に更新。4者整合（systemspec §7/§8/§9、testspec、tests、src/media）を確認 |
