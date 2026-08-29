# Stack Profile

> **Status:** `template` — 本リポジトリは Cursor ワークフローテンプレート試作中。アプリスタックは未確定。

アプリ開発開始時:

1. [stack.md.example](./stack.md.example) を本ファイルにコピー
2. `status: active` とプロファイル値を確定
3. [templates/rules/](../templates/rules/) から該当 `.mdc` を `.cursor/rules/` にコピー（[templates/README.md](../templates/README.md) 参照）

## Status

```yaml
status: template
profile: none
```

## Languages & runtime

```yaml
languages: []          # 例: TypeScript, Python, Go
runtime: null
package_manager: null
```

## Source layout

```yaml
source_roots: []
test_roots: []
source_glob: null
test_file_glob: null
layout: |
  （アプリ開始時に stack.md.example から記載）
```

## Test runner

```yaml
test_runner: null
test_all: null
test_single: null      # {file} プレースホルダ可
```

## Quality commands

```yaml
typecheck: null
lint: null
format: null
```

## Secrets & config

```yaml
secrets_policy: |
  スタック確定後に stack.md.example を参照して記載
tracked_config_paths: []
forbidden_secret_paths: []
```

## Active Cursor rules

```yaml
cursor_rules: []       # 例: templates/rules/typescript-workers.mdc
```

## Stack-specific review notes

（未設定）

---

## 改訂履歴

| 日付 | 変更 |
|------|------|
| 2026-08-29 | テンプレート試作フェーズ用プレースホルダ |
