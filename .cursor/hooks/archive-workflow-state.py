#!/usr/bin/env python3
"""Archive or delete temporary/workflow-state-<task-id>.yaml after task completion."""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Archive workflow-state after verifier final acceptance."
    )
    parser.add_argument("--task-id", required=True, help="Task slug")
    parser.add_argument(
        "--delete",
        action="store_true",
        help="Delete the file instead of archiving (audit trail is lost)",
    )
    args = parser.parse_args()

    src = Path.cwd() / "temporary" / f"workflow-state-{args.task_id}.yaml"
    if not src.is_file():
        print(f"workflow-state not found: {src}", file=sys.stderr)
        sys.exit(1)

    if args.delete:
        src.unlink()
        print(f"Deleted {src}")
        return

    archive_dir = Path.cwd() / "temporary" / "archive"
    archive_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest = archive_dir / f"workflow-state-{args.task_id}-{stamp}.yaml"
    src.rename(dest)
    print(f"Archived to {dest}")


if __name__ == "__main__":
    main()
