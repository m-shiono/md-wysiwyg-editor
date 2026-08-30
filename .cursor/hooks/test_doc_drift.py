#!/usr/bin/env python3
"""Guard against stale workflow documentation patterns."""

from __future__ import annotations

import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_DIR = REPO_ROOT / ".cursor" / "hooks"

# Patterns that indicate outdated harness docs (must not appear).
FORBIDDEN: list[tuple[Path, str]] = [
    (REPO_ROOT / "AGENTS.md", "if tests fail"),
    (REPO_ROOT / "doc" / "development.md", "| `phases.implementation` | build-agent |"),
    (HOOKS_DIR / "session-requirements-reminder.sh", "delete temporary/workflow-state"),
    (REPO_ROOT / ".cursor" / "rules" / "orchestrator.mdc", "tests: fail を返したとき"),
]

# Patterns that must appear after harness updates.
REQUIRED: list[tuple[Path, str]] = [
    (REPO_ROOT / "AGENTS.md", "archive-workflow-state"),
    (HOOKS_DIR / "session-requirements-reminder.sh", "archive-workflow-state"),
    (REPO_ROOT / "doc" / "development.md", "Phase 0"),
    (REPO_ROOT / "doc" / "development.md", "tdd-red-green-loop"),
]


class DocDriftTests(unittest.TestCase):
    def test_forbidden_stale_patterns_absent(self) -> None:
        offenders: list[str] = []
        for path, needle in FORBIDDEN:
            if not path.is_file():
                continue
            if needle in path.read_text(encoding="utf-8"):
                offenders.append(f"{path.relative_to(REPO_ROOT)}: contains '{needle}'")
        self.assertEqual(offenders, [])

    def test_required_patterns_present(self) -> None:
        missing: list[str] = []
        for path, needle in REQUIRED:
            if not path.is_file():
                missing.append(f"{path.relative_to(REPO_ROOT)}: file missing")
                continue
            if needle not in path.read_text(encoding="utf-8"):
                missing.append(f"{path.relative_to(REPO_ROOT)}: missing '{needle}'")
        self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main()
