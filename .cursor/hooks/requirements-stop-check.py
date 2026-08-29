#!/usr/bin/env python3
"""On stop, nudge the agent if the requirements workflow is incomplete."""

from __future__ import annotations

import json
import sys
from pathlib import Path

TEMP = Path.cwd() / "temporary"


def find_briefs(pattern: str) -> list[Path]:
    if not TEMP.is_dir():
        return []
    return sorted(TEMP.glob(pattern))


def main() -> None:
    json.load(sys.stdin)

    intent_briefs = find_briefs("intent-brief-*.md")
    req_briefs = find_briefs("requirements-brief-*.md")

    if intent_briefs and not req_briefs:
        print(
            json.dumps(
                {
                    "followup_message": (
                        "Intent Brief exists but Requirements Brief is missing. "
                        "Delegate to requirements-agent to run the advisory panel, "
                        "then continue requirement-thinking Phase C."
                    )
                }
            )
        )
        sys.exit(0)

    print("{}")
    sys.exit(0)


if __name__ == "__main__":
    main()
