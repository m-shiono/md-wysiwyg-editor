#!/usr/bin/env python3
"""Verify markdown links to .cursor/hooks/ resolve correctly."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_DIR = REPO_ROOT / ".cursor" / "hooks"
SCAN_ROOTS = [
    REPO_ROOT / ".cursor" / "agents",
    REPO_ROOT / ".cursor" / "skills" / "_shared",
    REPO_ROOT / ".cursor" / "skills" / "requirement-thinking",
    REPO_ROOT / ".cursor" / "skills" / "tdd-red-green-loop",
    REPO_ROOT / ".cursor" / "skills" / "project-implementation",
    REPO_ROOT / ".cursor" / "skills" / "project-refactoring",
    REPO_ROOT / ".cursor" / "skills" / "project-systemspec-authoring",
    REPO_ROOT / ".cursor" / "skills" / "spec-test-design",
    REPO_ROOT / ".cursor" / "skills" / "testspec-implementation",
    REPO_ROOT / "doc",
]

SCAN_FILES = [
    REPO_ROOT / "AGENTS.md",
    REPO_ROOT / ".cursor" / "rules" / "orchestrator.mdc",
]

LINK_RE = re.compile(r"\]\(([^)#]+)(?:#[^)]*)?\)")
WRONG_ROOT = REPO_ROOT / "hooks"


def hook_links_in_file(path: Path) -> list[tuple[str, Path]]:
    text = path.read_text(encoding="utf-8")
    found: list[tuple[str, Path]] = []
    for match in LINK_RE.finditer(text):
        raw = match.group(1).strip()
        if raw.startswith("http://") or raw.startswith("https://"):
            continue
        if "hooks/" not in raw and raw.endswith("hooks.json"):
            resolved = (path.parent / raw).resolve()
            found.append((raw, resolved))
            continue
        if "hooks/" not in raw:
            continue
        resolved = (path.parent / raw).resolve()
        found.append((raw, resolved))
    return found


def iter_markdown_files() -> list[Path]:
    files: list[Path] = []
    for root in SCAN_ROOTS:
        if not root.is_dir():
            continue
        files.extend(sorted(root.rglob("*.md")))
    for path in SCAN_FILES:
        if path.is_file():
            files.append(path)
    return sorted(set(files))


class DocLinkTests(unittest.TestCase):
    def test_no_links_point_to_repo_root_hooks(self) -> None:
        offenders: list[str] = []
        for md in iter_markdown_files():
            for raw, resolved in hook_links_in_file(md):
                if WRONG_ROOT in resolved.parents or resolved.parent == WRONG_ROOT:
                    offenders.append(f"{md.relative_to(REPO_ROOT)}: {raw} -> {resolved}")
        self.assertEqual(offenders, [])

    def test_hook_links_resolve_to_existing_files(self) -> None:
        missing: list[str] = []
        for md in iter_markdown_files():
            for raw, resolved in hook_links_in_file(md):
                if not resolved.is_file():
                    missing.append(f"{md.relative_to(REPO_ROOT)}: {raw} -> {resolved}")
        self.assertEqual(missing, [])

    def test_hooks_directory_exists(self) -> None:
        self.assertTrue(HOOKS_DIR.is_dir())


if __name__ == "__main__":
    unittest.main()
