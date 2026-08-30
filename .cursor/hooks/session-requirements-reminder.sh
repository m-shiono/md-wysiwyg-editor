#!/usr/bin/env bash
# sessionStart — inject requirements workflow context for the main session.
set -euo pipefail

cat <<'EOF'
{
  "additional_context": "Requirements workflow (Middle+ triage): requirement-thinking Phase A → requirements-agent → requirement-thinking Phase C (or skip when UD=0) → init-workflow-state.py (before requirements-gate) → verifier (requirements-gate, gates.requirements: done on disk) → spec-agent → verifier (spec-gate) → test-agent (spec-test-design) → verifier (testspec-gate) → test-agent (testspec-implementation / Red tests, phases.tests: done) → build-agent → main (tdd-red-green-loop: Pass Phase 0 / Fail loop; sets phases.implementation: done) → review-agent → verifier (final pass → archive-workflow-state.py). Middle+ creates temporary/workflow-state-<task-id>.yaml before requirements-gate verifier; subagents MUST update workflow-state on disk via .cursor/hooks/update-workflow-state.py (handoff alone fails Hooks). build-agent does NOT set phases.implementation — main tdd-red-green-loop only (except project-refactoring bypass). Task prompts must include Task ID when multiple workflow-state files exist. Verifier mid-pipeline: Goal must include requirements-gate / spec-gate / testspec-gate (gate-verifier-workflow.py). Hooks (failClosed): gate-requirements-workflow.py, gate-specification-workflow.py, gate-verifier-workflow.py. Completed tasks: archive-workflow-state.py --task-id <slug> (preferred). See .cursor/skills/_shared/update-workflow-state.md and .cursor/hooks/README.md."
}
EOF
