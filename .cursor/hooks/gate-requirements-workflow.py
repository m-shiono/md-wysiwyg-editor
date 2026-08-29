#!/usr/bin/env python3
"""Gate Task delegations for the requirements workflow (Phase 3 hooks)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path.cwd()
TEMP = ROOT / "temporary"


def load_input() -> dict:
    return json.load(sys.stdin)


def task_text(tool_input: dict) -> str:
    """Kept for tests; gate uses delegation_target instead of full prompt text."""
    parts: list[str] = []
    for key in ("prompt", "description", "subagent_type"):
        value = tool_input.get(key)
        if value:
            parts.append(str(value))
    return "\n".join(parts)


def find_briefs(pattern: str) -> list[Path]:
    if not TEMP.is_dir():
        return []
    return sorted(TEMP.glob(pattern))


def count_open_ud(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    open_by_status = len(re.findall(r"UD-\d+[^\n]*status:\s*open", text, re.IGNORECASE))
    if open_by_status:
        return open_by_status

    match = re.search(
        r"## User Decisions Required.*?(?=\n## |\Z)",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if not match:
        return 0

    section = match.group(0)
    if re.search(r"\bnone\b", section, re.IGNORECASE):
        return 0

    ud_ids = re.findall(r"UD-\d+", section)
    if not ud_ids:
        return 0

    resolved = len(re.findall(r"status:\s*resolved", section, re.IGNORECASE))
    return max(0, len(ud_ids) - resolved)


def deny(user_message: str, agent_message: str) -> None:
    print(
        json.dumps(
            {
                "permission": "deny",
                "user_message": user_message,
                "agent_message": agent_message,
            }
        )
    )
    sys.exit(0)


def allow() -> None:
    print(json.dumps({"permission": "allow"}))
    sys.exit(0)


def delegation_target(tool_input: dict) -> str | None:
    """Return gated agent name only when Task actually targets that subagent."""
    subagent = tool_input.get("subagent_type")
    if subagent:
        name = str(subagent).lower().strip()
        if name in {"spec-agent", "requirements-agent"}:
            return name
        return None

    # Fallback: short description only (not full prompt — avoids false positives)
    description = str(tool_input.get("description", "")).lower()
    for agent in ("spec-agent", "requirements-agent"):
        if agent in description:
            return agent
    return None


def main() -> None:
    payload = load_input()
    tool_input = payload.get("tool_input") or payload.get("input") or {}
    target = delegation_target(tool_input)

    intent_briefs = find_briefs("intent-brief-*.md")
    req_briefs = find_briefs("requirements-brief-*.md")

    if target == "spec-agent":
        if intent_briefs and not req_briefs:
            deny(
                "requirements-agent を先に実行してください（Intent Brief のみ存在します）。",
                "Workflow violation: intent-brief exists but requirements-brief is missing. "
                "Delegate to requirements-agent before spec-agent.",
            )
        for brief in req_briefs:
            open_count = count_open_ud(brief)
            if open_count > 0:
                deny(
                    f"未解決の UD-* が {open_count} 件あります（{brief.name}）。"
                    " requirement-thinking Phase C と verifier ゲートを完了してください。",
                    f"Requirements gate: {open_count} open UD item(s) in {brief.name}. "
                    "Complete requirement-thinking Phase C and verifier gate before spec-agent.",
                )

    if target == "requirements-agent":
        if not intent_briefs:
            deny(
                "requirement-thinking Phase A で Intent Brief を作成してから "
                "requirements-agent へ委譲してください。",
                "Workflow violation: requirements-agent requires "
                "temporary/intent-brief-*.md from Phase A.",
            )

    allow()


if __name__ == "__main__":
    main()
