#!/usr/bin/env python3
"""Create temporary/workflow-state-<task-id>.yaml from the project template."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parent
if str(HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(HOOKS_DIR))

from _workflow_state import parse_workflow_state  # noqa: E402

TEMPLATE = (
    Path(__file__).resolve().parents[1]
    / "skills"
    / "requirement-thinking"
    / "references"
    / "workflow-state-template.yaml"
)


def render_template(task_id: str, triage: str, feature_slug: str | None) -> str:
    slug = feature_slug or task_id
    text = TEMPLATE.read_text(encoding="utf-8")
    text = text.replace("<task-id>", task_id).replace("<slug>", slug)
    text = text.replace("triage: middle", f"triage: {triage}", 1)
    return text


def main() -> None:
    parser = argparse.ArgumentParser(description="Initialize workflow-state from template.")
    parser.add_argument("--task-id", required=True, help="Task slug")
    parser.add_argument(
        "--triage",
        default="middle",
        choices=("middle", "large"),
        help="Triage level (default: middle)",
    )
    parser.add_argument(
        "--feature-slug",
        help="Feature slug for doc/testspec-<slug>.md (default: task-id)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing workflow-state file",
    )
    args = parser.parse_args()

    if not TEMPLATE.is_file():
        print(f"Template not found: {TEMPLATE}", file=sys.stderr)
        sys.exit(1)

    out = Path.cwd() / "temporary" / f"workflow-state-{args.task_id}.yaml"
    if out.is_file() and not args.force:
        print(
            f"Already exists: {out} (use --force to overwrite, or "
            f"archive-workflow-state.py --task-id {args.task_id} first)",
            file=sys.stderr,
        )
        sys.exit(1)

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_template(args.task_id, args.triage, args.feature_slug), encoding="utf-8")
    parse_workflow_state(out)
    print(f"Created {out}")


if __name__ == "__main__":
    main()
