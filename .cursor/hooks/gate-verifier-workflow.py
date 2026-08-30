#!/usr/bin/env python3
"""Gate Task delegations to verifier for mid-pipeline quality gates."""

from __future__ import annotations

import json
import sys
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parent
if str(HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(HOOKS_DIR))

from _workflow_state import (  # noqa: E402
    INIT_WORKFLOW_STATE_HINT,
    blocks_requirements_gate_verifier,
    blocks_verifier_final_acceptance,
    blocks_verifier_gate,
    delegation_prompt_text,
    detect_verifier_gate,
    extract_task_id_from_prompt,
    filter_states_for_task,
    find_workflow_states,
    parse_workflow_state,
)

TEMP = Path.cwd() / "temporary"
REPO_ROOT = Path.cwd()


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
        if name == "verifier":
            return "verifier"
        return None

    description = str(tool_input.get("description", "")).lower()
    if "verifier" in description:
        return "verifier"
    return None


def main() -> None:
    payload = load_input()
    tool_input = payload.get("tool_input") or payload.get("input") or {}

    if delegation_target(tool_input) != "verifier":
        allow()

    prompt_text = delegation_prompt_text(tool_input)
    gate_type = detect_verifier_gate(prompt_text)

    task_id = extract_task_id_from_prompt(tool_input)
    state_paths = find_workflow_states(TEMP)
    states = [parse_workflow_state(path) for path in state_paths]
    scoped, scope_error = filter_states_for_task(states, task_id)

    if scope_error:
        if gate_type == "requirements" and task_id:
            deny(
                f"{scope_error} {INIT_WORKFLOW_STATE_HINT}",
                f"{scope_error} {INIT_WORKFLOW_STATE_HINT}",
            )
        deny(scope_error, scope_error)

    # Final acceptance — require implementation + review when workflow-state exists
    if gate_type is None:
        if not scoped:
            allow()
        for state in scoped:
            should_deny, user_message = blocks_verifier_final_acceptance(state)
            if should_deny:
                deny(
                    user_message or "Final acceptance prerequisites not satisfied.",
                    user_message or "Final acceptance prerequisites not satisfied.",
                )
        allow()

    if gate_type == "requirements":
        should_deny, user_message = blocks_requirements_gate_verifier(TEMP, task_id, states)
        if should_deny:
            deny(
                user_message or "requirements-gate: workflow-state required.",
                user_message or "requirements-gate: workflow-state required.",
            )

    # Trivial / Small without workflow-state — gate-check skills skip
    if not scoped:
        allow()

    for state in scoped:
        should_deny, user_message = blocks_verifier_gate(state, gate_type, REPO_ROOT)
        if should_deny:
            deny(
                user_message or "Verifier gate prerequisites not satisfied.",
                user_message or "Verifier gate prerequisites not satisfied.",
            )

    allow()


if __name__ == "__main__":
    main()
