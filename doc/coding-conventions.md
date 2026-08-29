# コーディング規約

命名・スタイル・コメントの正本。言語非依存のセマンティクスと、スタック別ケース規則を定義する。

- **レイアウト・品質コマンド:** [stack.md](./stack.md)
- **執筆ルール（How / What / Why）:** [`.cursor/rules/project-conventions.mdc`](../.cursor/rules/project-conventions.mdc)
- **AI 向け要約:** [`.cursor/rules/naming-conventions.mdc`](../.cursor/rules/naming-conventions.mdc)
- **スタック別詳細:** [templates/rules/](../templates/rules/)（`doc/stack.md` の `cursor_rules` で有効化）

---

## 基本方針

1. **言語コミュニティの慣習をベースにする** — 日本独自のケーススタイルは作らない（Google Style / PEP 8 / Effective Go 等に準拠）
2. **識別子は英語** — ローマ字可。日本語識別子は使わない
3. **略語より明確さ** — 許可略語は [略語辞書](#略語辞書) に列挙したもののみ
4. **一貫性** — 同一概念は同一語彙・同一ケースで表す
5. **ツールで強制** — `doc/stack.md` の lint / format / typecheck で自動チェック（整備後）

---

## 言語非依存（全スタック共通）

### 識別子の言語

| 対象 | 言語 |
|------|------|
| 変数・関数・型・ファイル名 | **英語**（ローマ字） |
| インラインコメント・ブロックコメント | **日本語可** |
| 公開 API の JSDoc / docstring | **英語**（非自明な場合） |

### 意味の付け方

| ルール | 例 |
|--------|-----|
| 関数・メソッドは **動詞始まり** | `getUserById`, `validateInput`, `sendNotification` |
| boolean は **`is` / `has` / `can`** 接頭辞 | `isValid`, `hasError`, `canSubmit` |
| コレクションは **複数形** | `users`, `orderItems`, `errors` |
| 定数は **意味が分かる全称** | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT_MS` |
| 1 文字変数は **ループインデックス等の狭いスコープのみ** | `i`, `j`, `k` |
| 意味のない名前を避ける | ❌ `tmp`, `data`, `obj`, `val` |

### 禁止・非推奨

| 禁止 | 理由 |
|------|------|
| 型情報を名前に含める | `strName`, `userList`, `intCount` — 型は型システムが表す |
| Hungarian 記法 | `mName`, `s_name`, `opt_value` |
| interface に `I` 接頭辞（TypeScript） | `IUserRepository` → `UserRepository` |
| 先頭・末尾の `_` で private を表現（TS） | `#field` または `private` を使う |
| テスト名に実装手段（How）を書く | ❌ `calls kv.get` → ✅ `returns 404 when item missing` |

### コメント

[project-conventions.mdc](../.cursor/rules/project-conventions.mdc) の執筆ルールに従う。

| 対象 | 書く内容 |
|------|----------|
| コード | **How** |
| テスト | **What** |
| コミット | **Why** |
| コメント | **Why not** |

追加ルール:

- 自明なコードにコメントを付けない
- アノテーション: `TODO:`, `FIXME:`, `NOTE:`, `HACK:`, `WARNING:` の形式を使う
- コード変更時は関連コメントも更新する

### 略語辞書

プロジェクト全体で許可する略語。一覧にない略語は全称を使う。

| 略語 | 全称 |
|------|------|
| `id` | identifier |
| `url` | uniform resource locator |
| `api` | application programming interface |
| `http` / `https` | — |
| `json` | JavaScript object notation |
| `kv` | key-value |
| `env` | environment |
| `config` | configuration |
| `params` | parameters |
| `args` | arguments |
| `ctx` | context（Go / middleware 等、慣習的な短いスコープのみ） |
| `err` | error（Go の慣習的短名のみ） |

---

## スタック別ケース規則

`doc/stack.md` で採用スタックを確定後、該当 [templates/rules/](../templates/rules/) を `.cursor/rules/` にコピーして有効化する。

### TypeScript / JavaScript

| 対象 | ケース | 例 |
|------|--------|-----|
| 変数・関数・メソッド | lowerCamelCase | `userName`, `fetchOrder` |
| クラス・interface・type・enum | PascalCase | `UserService`, `OrderStatus` |
| 定数（モジュールスコープ） | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| enum メンバー | PascalCase | `OrderStatus.Pending` |
| 型パラメータ | 単一: `T`, 複数: 説明的 PascalCase | `T`, `TKey`, `TValue` |
| 一般モジュールファイル | kebab-case | `user-service.ts`, `order-utils.ts` |
| React コンポーネントファイル | PascalCase | `UserProfile.tsx` |
| テストファイル | kebab-case + `.test.ts` | `user-service.test.ts` |
| ディレクトリ | kebab-case | `src/core/`, `src/services/` |

詳細: [templates/rules/typescript-workers.mdc](../templates/rules/typescript-workers.mdc), [tests-typescript.mdc](../templates/rules/tests-typescript.mdc)

### Python

PEP 8 に準拠。

| 対象 | ケース | 例 |
|------|--------|-----|
| 変数・関数・メソッド | snake_case | `user_name`, `fetch_order` |
| クラス | PascalCase | `UserService` |
| 定数 | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| モジュール・パッケージ | snake_case | `user_service.py`, `my_package` |
| プライベート | 先頭 `_` | `_internal_state` |
| テスト関数 | `test_` + snake_case + TC ID | `test_tc_001_returns_404` |

詳細: [templates/rules/python.mdc](../templates/rules/python.mdc), [tests-python.mdc](../templates/rules/tests-python.mdc)

### Go

Effective Go + コミュニティ慣習。

| 対象 | ケース | 例 |
|------|--------|-----|
| 非公開識別子 | lowerCamelCase | `userName`, `fetchOrder` |
| 公開識別子 | PascalCase | `UserName`, `FetchOrder` |
| ファイル | snake_case | `user_service.go` |
| テスト関数 | `Test` + TC ID + 説明 | `TestTC001_Returns404WhenMissing` |
| テストパッケージ | ブラックボックス推奨 | `feature_test` |

詳細: [templates/rules/go.mdc](../templates/rules/go.mdc)

---

## テスト命名

testspec の TC ID と対応させる。名前は **What**（期待結果）を述べる。

| ランナー | 形式 | 例 |
|----------|------|-----|
| Vitest / Jest | `'TC-NNN: <what>'` | `'TC-001: returns 404 when item missing'` |
| pytest | `test_tc_NNN_<what>` | `test_tc_001_returns_404_when_item_missing` |
| go test | `TestTCNNN_<What>` | `TestTC001_Returns404WhenItemMissing` |

詳細: [testspec-readme.md](./testspec-readme.md), [test-code-patterns.md](../.cursor/skills/spec-test-design/references/test-code-patterns.md)

---

## コーディングスタイル（共通）

| 項目 | 方針 |
|------|------|
| インデント | TS/JS: 2 spaces、Python: 4 spaces、Go: tab（gofmt） |
| 行長 | 100〜120 文字（format ツール設定に従う） |
| 早期 return | ネストを浅く保つため推奨 |
| マジックナンバー | 定数化する |
| インポート | 標準 → 外部 → 内部の順（言語慣習に従う） |

---

## 関連ドキュメント

- [development.md](./development.md) — 開発フロー
- [stack.md](./stack.md) — スタック宣言・品質コマンド
- [testspec-readme.md](./testspec-readme.md) — テスト仕様レイアウト

---

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-08-29 | 初版。言語非依存セマンティクス、TS/Python/Go ケース規則、テスト命名 |
