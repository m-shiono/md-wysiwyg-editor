# Backlog — md-wysiwyg-editor（MVP 外）

MVP（Phase 1）スコープ外の機能・改善項目。正本の振る舞い仕様は [systemspec.md](./systemspec.md)。本書は優先度未確定の積み残しリスト。

---

## エディタ・編集

| ID | 項目 | 概要 | 参照 |
|----|------|------|------|
| BL-001 | Marp WYSIWYG 編集 | スライドのビジュアル編集 | UD-003, Intent Out |
| BL-002 | Mermaid ビジュアルエディタ | ダイアグラムの GUI 編集 | UD-004, Intent Out |
| BL-003 | ワークスペース全体 Readonly | 設定 `md-wysiwyg-editor.workspaceReadonly` + 開いている Editor へ一括適用 | AD-006, UD-005 |
| BL-004 | UI i18n | メッセージ外部化・多言語 UI（MVP は英語） | Requirements Frontend |
| BL-005 | 追加 Markdown ノード | 脚注、定義リスト、タスクリスト以外の拡張記法 WYSIWYG | §2 Non-Goals |

## 画像・ファイル

| ID | 項目 | 概要 | 参照 |
|----|------|------|------|
| BL-006 | 画像パス自動更新 | `.md` 移動時に `img/` 参照を書き換え | UD-007 |
| BL-007 | 孤児画像の自動削除 | 未参照 `img/*` の検出・削除 UI または保存時 GC | RK-005, UD-007 |
| BL-008 | 画像最適化 | paste 時のリサイズ・圧縮 | §7 Non-Goals |

## 性能・スケール

| ID | 項目 | 概要 | 参照 |
|----|------|------|------|
| BL-009 | 大ファイル仮想スクロール | 100 KB 超 MD の Webview 仮想化 | RK-004 |
| BL-010 | Mermaid 描画最適化 | ブロック単位の遅延ロード・キャンセル | RK-004 |
| BL-011 | 表サイズ上限の明文化 | ~~行/列の推奨上限と UI 警告~~ → **resolved**: 100行×20列ソフト上限（systemspec §3） | systemspec §3 |

## 相互運用・ツール連携

| ID | 項目 | 概要 | 参照 |
|----|------|------|------|
| BL-012 | Markdown LSP 連携 | リンク検証等を Custom Editor 上で利用 | RK-008 |
| BL-013 | GFM 表との統一ポリシー | オープン時変換ルール・チームスタイルガイド自動化 | RK-006, Spec Gaps |
| BL-014 | Marp エクスポート | PDF / PPTX 出力 | §6 Non-Goals |

## 配布・運用

| ID | 項目 | 概要 | 参照 |
|----|------|------|------|
| BL-016 | CHANGELOG 自動化 | Mermaid/Marp 依存更新の影響記載 | RK-007 |

---

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-08-29 | BL-011 を resolved に更新（表ソフト上限確定） |
| 2026-09-19 | パス移設（`doc/requirements/`）。内容不変 |
| 2026-10-03 | doc 整理: `backlog.md` へリネーム、リンク・設定キーを現行製品名に同期 |
| 2026-10-03 | doc 整理: Marketplace 関連項目（BL-015）を削除 |
