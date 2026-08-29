# Stack profile（スキル共通）

実装・テスト・レビュー・デバッグスキルは、スタック固有の判断の前に **必ず** [doc/stack.md](../../../doc/stack.md) を読む。

## 読む項目

| 項目 | 用途 |
|------|------|
| `status` | `template` ならランタイムを仮定しない |
| `languages`, `runtime` | レビュー・デバッグの文脈 |
| `layout`, `source_glob`, `test_file_glob` | ファイル配置・レビュー |
| `test_runner`, `test_all`, `test_single` | 検証コマンド |
| `typecheck`, `lint` | 品質ゲート |
| `secrets_policy`, `forbidden_secret_paths` | セキュリティレビュー |
| `stack-specific review notes` | 追加チェック |
| review lifecycle | [_shared/review-lifecycle.md](./review-lifecycle.md) — 要件段階と実装後レビューの対応 |

## スタック rules

`doc/stack.md` の `cursor_rules` に列挙された `.mdc` が `.cursor/rules/` にコピーされていること。未コピーなら handoff で `blocked` とし、テンプレート README を参照。

## 例プロファイル

[doc/stack.md.example](../../../doc/stack.md.example) — TypeScript/Workers, Python, Go
