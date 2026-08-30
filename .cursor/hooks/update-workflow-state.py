#!/usr/bin/env python3
"""Update temporary/workflow-state-<task-id>.yaml on disk (stdlib only).

Subagents MUST use this script (or equivalent file write) — handoff YAML alone
does not satisfy Hook checks.

Examples:
  python3 .cursor/hooks/update-workflow-state.py --task-id my-feature \\
    --phase spec --phase-status done \\
    --artifact systemspec_section='§3.2 User API'

  python3 .cursor/hooks/update-workflow-state.py --task-id my-feature \\
    --gate spec --gate-status done
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parent
if str(HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(HOOKS_DIR))

from _workflow_state import parse_workflow_state  # noqa: E402


def _yaml_quote(value: str) -> str:
    if re.fullmatch(r"[A-Za-z0-9_.@/:-]+", value):
        return value
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _set_nested_key(text: str, block: str, key: str, value: str | None) -> str:
    rendered = "null" if value is None else _yaml_quote(value)
    block_pattern = rf"(^({re.escape(block)}):\s*\n)((?:  .+\n)*)"

    def repl(match: re.Match[str]) -> str:
        header = match.group(1)
        body = match.group(3)
        lines = body.splitlines(keepends=True)
        replaced = False
        new_lines: list[str] = []
        for line in lines:
            item = re.match(r"^(\s{2})(\w+):\s*(.*)$", line)
            if item and item.group(2) == key:
                new_lines.append(f"  {key}: {rendered}\n")
                replaced = True
            else:
                new_lines.append(line)
        if not replaced:
            new_lines.append(f"  {key}: {rendered}\n")
        return header + "".join(new_lines)

    if re.search(block_pattern, text, re.MULTILINE):
        return re.sub(block_pattern, repl, text, count=1, flags=re.MULTILINE)

    insertion = f"{block}:\n  {key}: {rendered}\n"
    if text.endswith("\n"):
        return text + insertion
    return text + "\n" + insertion


def update_file(
    path: Path,
    phase: str | None,
    phase_status: str | None,
    gate: str | None,
    gate_status: str | None,
    artifacts: dict[str, str | None],
    tdd: dict[str, str | None] | None = None,
) -> None:
    text = path.read_text(encoding="utf-8") if path.is_file() else ""

    if phase and phase_status:
        text = _set_nested_key(text, "phases", phase, phase_status)
    if gate and gate_status:
        text = _set_nested_key(text, "gates", gate, gate_status)
    for key, value in artifacts.items():
        text = _set_nested_key(text, "artifacts", key, value)
    if tdd:
        for key, value in tdd.items():
            text = _set_nested_key(text, "tdd_loop", key, value)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Update workflow-state YAML on disk.")
    parser.add_argument("--task-id", required=True, help="Task slug matching workflow-state file")
    parser.add_argument("--phase", help="Phase key (spec, testspec, tests, ...)")
    parser.add_argument("--phase-status", help="Phase status (done, pending, skipped)")
    parser.add_argument("--gate", help="Gate key (requirements, spec, testspec)")
    parser.add_argument("--gate-status", help="Gate status (done, pending, skipped)")
    parser.add_argument(
        "--artifact",
        action="append",
        default=[],
        help="Artifact key=value (repeatable), e.g. testspec=doc/testspec-foo.md",
    )
    parser.add_argument("--tdd-iteration", help="tdd_loop.iteration value")
    parser.add_argument("--tdd-status", help="tdd_loop.status: pending | green | blocked")
    parser.add_argument("--tdd-last-failure", help="tdd_loop.last_failure summary")
    args = parser.parse_args()

    artifacts: dict[str, str | None] = {}
    for item in args.artifact:
        if "=" not in item:
            print(f"Invalid --artifact (expected key=value): {item}", file=sys.stderr)
            sys.exit(1)
        key, value = item.split("=", 1)
        artifacts[key.strip()] = value.strip() or None

    path = Path.cwd() / "temporary" / f"workflow-state-{args.task_id}.yaml"
    if not path.is_file():
        print(f"workflow-state not found: {path}", file=sys.stderr)
        sys.exit(1)

    tdd: dict[str, str | None] = {}
    if args.tdd_iteration is not None:
        tdd["iteration"] = args.tdd_iteration
    if args.tdd_status is not None:
        tdd["status"] = args.tdd_status
    if args.tdd_last_failure is not None:
        tdd["last_failure"] = args.tdd_last_failure or None

    update_file(
        path,
        phase=args.phase,
        phase_status=args.phase_status,
        gate=args.gate,
        gate_status=args.gate_status,
        artifacts=artifacts,
        tdd=tdd or None,
    )

    # Sanity check parse after write
    parse_workflow_state(path)
    print(f"Updated {path}")


if __name__ == "__main__":
    main()
