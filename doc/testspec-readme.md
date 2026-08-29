# テスト仕様書（Test Specifications）

本ディレクトリには、機能・問題ごとの **テスト仕様書** を配置する。

## ファイル命名

```
doc/testspec-<feature-slug>.md
```

例: `doc/testspec-api-items.md`, `doc/testspec-markdown-parse.md`

`<feature-slug>` は `doc/systemspec.md` の Related Tests と一致させる。

## ドキュメント間の関係

| ファイル | 役割 |
|---------|------|
| `doc/systemspec.md` | システム要件・振る舞い（WHAT） |
| `doc/testspec-*.md` | 検証項目・期待値・境界値（HOW TO VERIFY） |
| テストコード | 実行可能な自動テスト（パスは [stack.md](./stack.md) の `test_file_glob`） |
| `doc/stack.md` | テストランナー・コマンド・パス規約 |

## スキルワークフロー

| 段階 | スキル | Subagent |
|------|--------|----------|
| 要件整理（Intent） | `requirement-thinking` Phase A/C | main |
| 技術アドバイザリ | `requirements-advisory` | requirements-agent |
| systemspec 執筆 | `project-systemspec-authoring` | spec-agent |
| テスト設計 + testspec | `spec-test-design` | test-agent |
| testspec → テストコード | `testspec-implementation` | test-agent |
| 仕様変更の波及 | `spec-change-propagation` | spec-agent |
| 四者整合監査 | `doc-consistency-audit` | review-agent |
| バグ回帰 TC | `bug-regression-test` | test-agent |
| デバッグ | `project-debugging` | build-agent |

### 新機能

```text
requirement-thinking (A) → requirements-agent → requirement-thinking (C) → verifier (gate) → spec-agent → test-agent → build-agent → review-agent → verifier
```

### バグ修正

```text
build-agent (debug) → test-agent (regression) → build-agent (fix) → review-agent → verifier
```

### 仕様変更

```text
spec-agent (propagation) → test-agent → build-agent → review-agent
```

## 改訂履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-08-29 | 初版。testspec 配置規約と spec-test-design スキル連携を定義 |
| 2026-08-29 | 5 スキルワークフロー（systemspec-authoring, testspec-implementation, 等）を追記 |
| 2026-08-29 | stack.md 参照、subagent 列、汎用テストパスに更新 |
| 2026-08-29 | requirements-agent / 2 層 requirement-thinking フローを追記 |
| 2026-08-29 | verifier requirements-gate、review-lifecycle を追記 |
