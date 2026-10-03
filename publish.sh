#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

# vsce package の出力名は package.json の name に依存するため、生成された唯一の VSIX を拾う
shopt -s nullglob
vsix_files=(./*.vsix)
if [[ ${#vsix_files[@]} -ne 1 ]]; then
  echo "error: expected exactly one .vsix after package, found ${#vsix_files[@]}" >&2
  exit 1
fi
VSIX="${vsix_files[0]}"

npx @vscode/vsce publish --packagePath "$VSIX"