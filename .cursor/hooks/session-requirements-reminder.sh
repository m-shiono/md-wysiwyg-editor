#!/usr/bin/env bash
# sessionStart — inject requirements workflow context for the main session.
set -euo pipefail

cat <<'EOF'
{
  "additional_context": "Requirements workflow (Middle+ triage): requirement-thinking Phase A (Intent Brief, Class U only) → requirements-agent (Advisory Panel) → requirement-thinking Phase C (UD-* only) → verifier requirements-gate → spec-agent. Do not ask users Class A (advisor default) questions. Hooks enforce delegation order. See .cursor/skills/requirement-thinking/SKILL.md and .cursor/hooks/README.md."
}
EOF
