# Consistency Audit Checklist

## systemspec

- [ ] 対象機能の節が存在する
- [ ] Inputs / Outputs / Failure Returns が表形式
- [ ] Related Tests リンクが有効
- [ ] 改訂履歴が最新変更を反映

## testspec

- [ ] `doc/testspec-<slug>.md` が存在（または「不要」の理由）
- [ ] Test Matrix に TC ID・Priority・Expected
- [ ] systemspec の節へのリンク
- [ ] Self-Check Report がある
- [ ] Trace Results が P0/P1 で更新されている

## tests/

- [ ] testspec 記載パスにファイルがある
- [ ] P0/P1 TC ID が 1:1
- [ ] vitest run が通る（可能なら実行）
- [ ] 仕様外テストがない

## src/（実装）

- [ ] systemspec にない公開 API がない
- [ ] エラーコード・戻り値が Failure Returns と一致
- [ ] undocumented 分岐がない（あれば Warning）

## ドキュメント横断

- [ ] feature-slug が systemspec / testspec / ファイル名で一致
- [ ] 用語（エンドポイント名、型名）が統一
- [ ] Spec Gaps ⚠️ が三層で矛盾していない
