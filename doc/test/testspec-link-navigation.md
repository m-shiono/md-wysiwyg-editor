# テスト仕様書: link-navigation

対象: [doc/requirements/systemspec.md §19](../requirements/systemspec.md#19-リンクのクリック遷移およびミニポップオーバーlink-navigation-and-popover) / [doc/design/architecture.md AD-025](../design/architecture.md)

---

## Test Matrix

| TC ID | Priority | 対象 | 条件 / 入力 | 期待結果 |
|-------|----------|------|-------------|----------|
| TC-LINK-001 | P0 | `classifyLinkHref` | `https://example.com`, `http://...`, `mailto:user@example.com` | `{ kind: 'external', url }` を返す |
| TC-LINK-002 | P0 | `classifyLinkHref` | `#section-1`, `#日本語%20見出し` | `{ kind: 'anchor', slug }` を返す |
| TC-LINK-003 | P0 | `classifyLinkHref` | `./other.md`, `../doc.md#sec` | `{ kind: 'relative', path, fragment }` を返す |
| TC-LINK-004 | P0 | `classifyLinkHref` | `javascript:alert(1)`, `data:text/html,...`, `file:///etc/passwd`, `command:foo`, `//evil.com`, 制御文字 | `{ kind: 'unsafe', reason }` としてブロック |
| TC-LINK-005 | P0 | `resolveRelativeLinkTarget` | `file:` / `vscode-remote:` / `untitled:` | スキームと authority を保全して解決、`untitled:` は `null` |
| TC-LINK-006 | P0 | `MarkdownEditorProvider` `openLink` | 外部 URL / 存在する相対ファイル / 不存在相対ファイル / 危険スキーム | `openExternal` / `vscode.open` / Warning / ブロック＆`isDirty === false` 維持 |
| TC-LINK-007 | P0 | Preview モードリンククリック | Preview で `<a href="https://example.com">` クリック | `openLink` メッセージを Host へ送信 |
| TC-LINK-008 | P0 | Visual モード通常クリック | Visual（非 RO）でリンククリック | `#link-popover` が表示され、URL プレビューと Open/Edit/Unlink ボタンが利用可能 |
| TC-LINK-009 | P0 | Visual モード `Ctrl/Cmd+Click` | Visual（非 RO）で修飾キー付きクリック | ポップオーバーを出さず直接 `openLink` を送信 |
| TC-LINK-010 | P1 | `#link-popover` `Open` / `Escape` | `Open` ボタン押下で遷移、`Escape` で非表示 | `openLink` 送信後に非表示化、`Escape` で非表示 |
| TC-LINK-011 | P0 | 二重発火防止（回帰） | `<a href>` クリック（Visual 通常 / Preview） | `defaultPrevented === true` かつ `window` バブリングハンドラへ伝播しない |
