#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

rm -f ./*.vsix
npm run package:vsix
