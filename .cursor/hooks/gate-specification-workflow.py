#!/usr/bin/env python3
"""Gate Task delegations for the specification workflow (SDD downstream)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parent
if str(HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(HOOKS_DIR))

from _workflow_state import (  # noqa: E402
    blocks_build_agent,
    blocks_test_agent,
    extract_task_id_from_prompt,
    filter_states_for_task,
    find_workflow_states,
    parse_workflow_state,
)

TEMP = Path.cwd() / "temporary"
REPO_ROOT = Path.cwd()

GATE_RULES: dict[str, tuple] = {
    "test-agent": (
        blocks_test_agent,
        "Specification workflow gate: spec phase / spec-gate / artifacts not satisfied. "
        "Complete spec-agent, verifier (spec-gate), and update workflow-state on disk "
        "before delegating to test-agent.",
    ),
    "build-agent": (
        blocks_build_agent,
        "Specification workflow gate: testspec / tests phase / testspec-gate not satisfied. "
        "Complete test-agent (testspec + Red tests), verifier (testspec-gate), and update "
        "workflow-state on disk before delegating to build-agent.",
    ),
}


def load_input() -> dict:
    return json.load(sys.stdin)


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
    subagent = tool_input.get("subagent_type")
    if subagent:
        name = str(subagent).lower().strip()
        if name in GATE_RULES:
            return name
        return None

    description = str(tool_input.get("description", "")).lower()
    for agent in GATE_RULES:
        if agent in description:
            return agent
    return None


def main() -> None:
    payload = load_input()
    tool_input = payload.get("tool_input") or payload.get("input") or {}
    target = delegation_target(tool_input)

    if target is None:
        allow()

    state_paths = find_workflow_states(TEMP)
    if not state_paths:
        allow()

    all_states = [parse_workflow_state(path) for path in state_paths]
    task_id = extract_task_id_from_prompt(tool_input)
    states, scope_error = filter_states_for_task(all_states, task_id)
    if scope_error:
        deny(scope_error, scope_error)

    block_fn, agent_message = GATE_RULES[target]
    should_deny, user_message = block_fn(states, REPO_ROOT)
    if should_deny:
        deny(user_message or f"{target} 委譲が workflow-state に阻まれています。", agent_message)

    allow()


if __name__ == "__main__":
    main()
