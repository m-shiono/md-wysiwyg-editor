"""Shared helpers for temporary/workflow-state-*.yaml (stdlib only)."""

from __future__ import annotations

import re
from pathlib import Path

INIT_WORKFLOW_STATE_HINT = (
    "init-workflow-state.py で workflow-state を作成してください"
    "（要件フェーズ完了時 — Phase C 完了、または Phase C スキップ後の"
    " Advisor Defaults 確認後）。"
)


def find_workflow_states(temp_dir: Path) -> list[Path]:
    if not temp_dir.is_dir():
        return []
    return sorted(temp_dir.glob("workflow-state-*.yaml"))


def _strip_scalar(raw: str) -> str | None:
    value = raw.strip()
    if value in {"null", "~", '""', "''", ""}:
        return None
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        return value[1:-1]
    return value


def _parse_nested_block(text: str, key: str) -> dict[str, str | None]:
    """Parse a simple nested mapping under ``key:`` (2-space indent)."""
    match = re.search(rf"^{re.escape(key)}:\s*\n((?:  .+\n)*)", text, re.MULTILINE)
    if not match:
        return {}
    block = match.group(1)
    result: dict[str, str | None] = {}
    for line in block.splitlines():
        item = re.match(r"^\s{2}(\w+):\s*(.*)$", line)
        if item:
            result[item.group(1)] = _strip_scalar(item.group(2))
    return result


def parse_workflow_state(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    phases = _parse_nested_block(text, "phases")
    artifacts = _parse_nested_block(text, "artifacts")
    gates = _parse_nested_block(text, "gates")
    bypass_block = _parse_nested_block(text, "bypass")

    task_id_line = re.search(r"^task_id:\s*(.+)$", text, re.MULTILINE)
    triage_line = re.search(r"^triage:\s*(.+)$", text, re.MULTILINE)
    feature_slug_line = re.search(r"^feature_slug:\s*(.+)$", text, re.MULTILINE)

    return {
        "path": path,
        "task_id": _strip_scalar(task_id_line.group(1)) if task_id_line else None,
        "triage": (_strip_scalar(triage_line.group(1)) if triage_line else "") or "",
        "feature_slug": _strip_scalar(feature_slug_line.group(1)) if feature_slug_line else None,
        "bypass_reason": bypass_block.get("reason"),
        "phases": {
            "requirements": (phases.get("requirements") or "").lower() or None,
            "spec": (phases.get("spec") or "").lower() or None,
            "testspec": (phases.get("testspec") or "").lower() or None,
            "tests": (phases.get("tests") or "").lower() or None,
            "implementation": (phases.get("implementation") or "").lower() or None,
            "review": (phases.get("review") or "").lower() or None,
        },
        "artifacts": {
            "intent_brief": artifacts.get("intent_brief"),
            "requirements_brief": artifacts.get("requirements_brief"),
            "systemspec_section": artifacts.get("systemspec_section"),
            "testspec": artifacts.get("testspec"),
        },
        "gates": {
            "requirements": (gates.get("requirements") or "").lower() or None,
            "spec": (gates.get("spec") or "").lower() or None,
            "testspec": (gates.get("testspec") or "").lower() or None,
        },
    }


def task_id_from_state(state: dict) -> str:
    if state.get("task_id"):
        return str(state["task_id"])
    path = state.get("path")
    if path:
        return Path(path).stem.replace("workflow-state-", "")
    return "unknown"


def extract_task_id_from_prompt(tool_input: dict) -> str | None:
    """Extract task slug from Task delegation prompt or explicit field."""
    for key in ("task_id", "taskId"):
        value = tool_input.get(key)
        if value:
            return str(value).strip()

    parts: list[str] = []
    for key in ("prompt", "description"):
        value = tool_input.get(key)
        if value:
            parts.append(str(value))

    text = "\n".join(parts)
    patterns = [
        r"(?im)^task\s*id:\s*([a-z0-9][a-z0-9-]*)",
        r"(?im)^-\s*\*\*task\s*id\*\*:\s*([a-z0-9][a-z0-9-]*)",
        r"(?im)task_id:\s*([a-z0-9][a-z0-9-]*)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()
    return None


def filter_states_for_task(states: list[dict], task_id: str | None) -> tuple[list[dict], str | None]:
    """Return states scoped to task_id. Error message when ambiguous."""
    if not states:
        return [], None

    if task_id:
        matched = [s for s in states if task_id_from_state(s) == task_id]
        if matched:
            return matched, None
        return [], f"task_id '{task_id}' に一致する workflow-state がありません。"

    if len(states) == 1:
        return states, None

    ids = ", ".join(sorted(task_id_from_state(s) for s in states))
    return (
        [],
        "複数の workflow-state があります。委譲プロンプトに Task ID を含めてください"
        f"（対象: {ids}）。",
    )


def _is_gated_triage(state: dict) -> bool:
    if state["triage"] not in {"middle", "large"}:
        return False
    return not state["bypass_reason"]


def _phase_incomplete(state: dict, phase_name: str) -> bool:
    phase = state["phases"].get(phase_name)
    return phase not in {"done", "skipped"}


def _gate_incomplete(state: dict, gate_name: str) -> bool:
    gate = state["gates"].get(gate_name)
    return gate not in {"done", "skipped"}


def validate_spec_artifacts(state: dict, repo_root: Path) -> str | None:
    """Return user-facing error when spec phase claims done but artifacts are missing."""
    if _phase_incomplete(state, "spec"):
        return None

    section = state["artifacts"].get("systemspec_section")
    systemspec = repo_root / "doc" / "systemspec.md"
    if not systemspec.is_file():
        return "phases.spec は done ですが doc/systemspec.md がありません。"

    if section:
        if section not in systemspec.read_text(encoding="utf-8"):
            return (
                f"phases.spec は done ですが systemspec に {section} 節が見つかりません。"
                " spec-agent が doc/systemspec.md を更新したか確認してください。"
            )
        return None

    return (
        "phases.spec は done ですが artifacts.systemspec_section が未設定です。"
        " update-workflow-state.py で artifacts を更新してください。"
    )


def validate_testspec_artifacts(state: dict, repo_root: Path) -> str | None:
    """Return user-facing error when testspec phase claims done but file is missing."""
    if _phase_incomplete(state, "testspec"):
        return None

    testspec_path = state["artifacts"].get("testspec")
    if not testspec_path:
        return (
            "phases.testspec は done ですが artifacts.testspec が未設定です。"
            " test-agent が testspec パスを workflow-state に記録してください。"
        )

    if not (repo_root / testspec_path).is_file():
        return f"phases.testspec は done ですが {testspec_path} が存在しません。"

    return None


def _test_search_roots(repo_root: Path) -> list[Path]:
    """Return directories to scan for TC IDs (stack.md test_roots or tests/)."""
    stack = repo_root / "doc" / "stack.md"
    roots: list[Path] = []
    if stack.is_file():
        text = stack.read_text(encoding="utf-8")
        for match in re.finditer(r"^\s*-\s*(tests/\S+|\S+tests?\S*)\s*$", text, re.MULTILINE):
            candidate = repo_root / match.group(1).strip().strip('"').strip("'")
            if candidate.is_dir():
                roots.append(candidate)
    default = repo_root / "tests"
    if default.is_dir() and default not in roots:
        roots.append(default)
    return roots


def extract_p0_tc_ids(testspec_path: Path) -> list[str]:
    """Parse P0 TC IDs from testspec Test Matrix table rows."""
    if not testspec_path.is_file():
        return []
    text = testspec_path.read_text(encoding="utf-8")
    ids: list[str] = []
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            continue
        cols = [c.strip() for c in line.split("|")]
        if len(cols) < 5:
            continue
        tc_match = re.match(r"TC-\d+", cols[1])
        if not tc_match:
            continue
        if re.search(r"\bP0\b", line.upper()):
            ids.append(tc_match.group(0))
    return ids


def _read_stack_scalar(repo_root: Path, key: str) -> str | None:
    """Read a simple scalar from doc/stack.md yaml blocks."""
    stack = repo_root / "doc" / "stack.md"
    if not stack.is_file():
        return None
    text = stack.read_text(encoding="utf-8")
    match = re.search(rf"^{re.escape(key)}:\s*(.+)$", text, re.MULTILINE)
    if not match:
        return None
    return _strip_scalar(match.group(1))


def _test_file_glob_patterns(repo_root: Path) -> list[str]:
    glob_value = _read_stack_scalar(repo_root, "test_file_glob")
    if glob_value and glob_value.lower() != "null":
        return [glob_value]
    return [
        "tests/**/*.test.ts",
        "tests/**/*.test.js",
        "tests/**/*.test.tsx",
        "tests/**/*.spec.ts",
        "tests/**/test_*.py",
        "tests/**/*_test.py",
        "tests/**/*_test.go",
    ]


def _tc_id_variants(tc_id: str) -> list[str]:
    """Common test-name forms for a testspec TC ID (Hook P0 detection)."""
    variants = [tc_id]
    lower = tc_id.lower()
    variants.append(lower)
    variants.append(lower.replace("-", "_"))
    variants.append(lower.replace("-", ""))
    return list(dict.fromkeys(variants))


def tc_present_in_test_sources(tc_id: str, combined: str, repo_root: Path) -> bool:
    """Return True when TC ID (or stack-normalized variant) appears in test sources."""
    if any(variant in combined for variant in _tc_id_variants(tc_id)):
        return True

    pattern_raw = _read_stack_scalar(repo_root, "test_tc_id_pattern")
    if pattern_raw:
        try:
            pattern = re.compile(pattern_raw)
        except re.error:
            return False
        return bool(pattern.search(combined)) and (
            tc_id in combined or tc_id.lower() in combined.lower()
        )

    return False


def _test_files_under(roots: list[Path], repo_root: Path) -> list[Path]:
    files: list[Path] = []
    for pattern in _test_file_glob_patterns(repo_root):
        files.extend(p for p in repo_root.glob(pattern) if p.is_file())
    if files:
        return sorted(set(files))

    legacy_patterns = ("*.test.ts", "*.test.js", "*.test.tsx", "*_test.go", "test_*.py", "*_test.py", "*.spec.ts")
    for root in roots:
        for pattern in legacy_patterns:
            files.extend(root.rglob(pattern))
    return sorted(set(files))


def missing_red_test_tcs(state: dict, repo_root: Path) -> list[str]:
    """Return P0 TC IDs from testspec that are absent from test files."""
    if _phase_incomplete(state, "tests"):
        return []

    testspec_rel = state["artifacts"].get("testspec")
    if not testspec_rel:
        return []

    p0_ids = extract_p0_tc_ids(repo_root / testspec_rel)
    if not p0_ids:
        return []

    roots = _test_search_roots(repo_root)
    test_files = _test_files_under(roots, repo_root) if roots else []
    if not test_files:
        return p0_ids

    require_in_name = _read_stack_scalar(repo_root, "test_tc_id_in_name")
    if require_in_name is not None and require_in_name.lower() in {"false", "no", "0"}:
        return []

    combined = ""
    for path in test_files:
        try:
            combined += path.read_text(encoding="utf-8", errors="replace") + "\n"
        except OSError:
            continue

    return [tc for tc in p0_ids if not tc_present_in_test_sources(tc, combined, repo_root)]


def validate_red_tests(state: dict, repo_root: Path) -> str | None:
    """Return error when phases.tests is done but P0 TC code is missing on disk."""
    if _phase_incomplete(state, "tests"):
        return None

    missing = missing_red_test_tcs(state, repo_root)
    if not missing:
        return None

    joined = ", ".join(missing[:5])
    suffix = " ..." if len(missing) > 5 else ""
    return (
        f"phases.tests は done ですが P0 テストコードが見つかりません: {joined}{suffix}。"
        " test-agent（testspec-implementation）で tests/ に TC ID を含むテストを実装してください。"
    )


def blocks_test_agent(states: list[dict], repo_root: Path) -> tuple[bool, str | None]:
    """Return (should_deny, user_message)."""
    for state in states:
        if not _is_gated_triage(state):
            continue

        task_id = task_id_from_state(state)

        if _phase_incomplete(state, "spec"):
            return (
                True,
                f"spec フェーズが未完了です（task: {task_id}）。"
                " spec-agent で systemspec を確定し、workflow-state ファイルを更新してから"
                " test-agent へ委譲してください。",
            )

        artifact_error = validate_spec_artifacts(state, repo_root)
        if artifact_error:
            return True, f"{artifact_error}（task: {task_id}）"

        if _gate_incomplete(state, "spec"):
            return (
                True,
                f"spec-gate（verifier）が未完了です（task: {task_id}）。"
                " verifier（spec-gate-check）を実行し、gates.spec: done を"
                " workflow-state に記録してから test-agent へ委譲してください。",
            )

    return False, None


def parse_intent_brief_triage(path: Path) -> str | None:
    text = path.read_text(encoding="utf-8")
    for pattern in (
        r"(?im)^\|\s*triage\s*\|\s*(Middle|Large|Trivial|Small)\s*\|",
        r"(?im)^triage:\s*(middle|large|trivial|small)\b",
    ):
        match = re.search(pattern, text)
        if match:
            return match.group(1).lower()
    return None


def blocks_spec_agent_workflow(
    states: list[dict], intent_briefs: list[Path]
) -> tuple[bool, str | None]:
    """Middle/Large intent requires workflow-state and requirements-gate."""
    for brief in intent_briefs:
        triage = parse_intent_brief_triage(brief)
        if triage not in {"middle", "large"}:
            continue

        task_id = brief.stem.replace("intent-brief-", "")
        matched = [s for s in states if task_id_from_state(s) == task_id]
        if not matched:
            return (
                True,
                f"Intent Brief の triage が {triage} ですが workflow-state がありません"
                f"（task: {task_id}）。{INIT_WORKFLOW_STATE_HINT}",
            )

        state = matched[0]
        if _gate_incomplete(state, "requirements"):
            return (
                True,
                f"requirements-gate（verifier）が未完了です（task: {task_id}）。"
                " verifier（requirements-gate-check）を実行し、gates.requirements: done"
                " を workflow-state に記録してから spec-agent へ委譲してください。",
            )

    return False, None


def blocks_requirements_gate_verifier(
    temp_dir: Path,
    task_id: str | None,
    states: list[dict],
) -> tuple[bool, str | None]:
    """Deny requirements-gate verifier when Middle+ intent exists but no workflow-state."""
    if not temp_dir.is_dir():
        return False, None

    briefs: list[Path]
    if task_id:
        path = temp_dir / f"intent-brief-{task_id}.md"
        briefs = [path] if path.is_file() else []
    else:
        briefs = sorted(temp_dir.glob("intent-brief-*.md"))

    for brief in briefs:
        triage = parse_intent_brief_triage(brief)
        if triage not in {"middle", "large"}:
            continue

        tid = brief.stem.replace("intent-brief-", "")
        matched = [s for s in states if task_id_from_state(s) == tid]
        if matched:
            continue

        return (
            True,
            f"Intent Brief の triage が {triage} ですが workflow-state がありません"
            f"（task: {tid}）。verifier（requirements-gate）の前に {INIT_WORKFLOW_STATE_HINT}",
        )

    return False, None


def blocks_build_agent(states: list[dict], repo_root: Path) -> tuple[bool, str | None]:
    """Return (should_deny, user_message)."""
    for state in states:
        if not _is_gated_triage(state):
            continue

        task_id = task_id_from_state(state)

        if _phase_incomplete(state, "testspec"):
            return (
                True,
                f"testspec フェーズが未完了です（task: {task_id}）。"
                " test-agent（spec-test-design）で testspec を確定し、"
                " workflow-state ファイルを更新してから build-agent へ委譲してください。",
            )

        testspec_error = validate_testspec_artifacts(state, repo_root)
        if testspec_error:
            return True, f"{testspec_error}（task: {task_id}）"

        if _gate_incomplete(state, "testspec"):
            return (
                True,
                f"testspec-gate（verifier）が未完了です（task: {task_id}）。"
                " verifier（testspec-gate-check）を実行し、gates.testspec: done を"
                " workflow-state に記録してから build-agent へ委譲してください。",
            )

        if _phase_incomplete(state, "tests"):
            return (
                True,
                f"tests フェーズが未完了です（task: {task_id}）。"
                " test-agent（testspec-implementation）で Red テストを実装し、"
                " phases.tests: done を workflow-state に記録してから build-agent へ"
                " 委譲してください（Strict TDD）。",
            )

        red_error = validate_red_tests(state, repo_root)
        if red_error:
            return True, f"{red_error}（task: {task_id}）"

    return False, None


def detect_verifier_gate(text: str) -> str | None:
    """Return requirements | spec | testspec when prompt targets a mid-pipeline gate."""
    lowered = text.lower()
    if "requirements-gate" in lowered or "requirements gate" in lowered:
        return "requirements"
    # testspec before spec — "testspec-gate" contains "spec-gate"
    if "testspec-gate" in lowered or "testspec gate" in lowered:
        return "testspec"
    if "spec-gate" in lowered or "spec gate" in lowered:
        return "spec"
    return None


def delegation_prompt_text(tool_input: dict) -> str:
    parts: list[str] = []
    for key in ("prompt", "description"):
        value = tool_input.get(key)
        if value:
            parts.append(str(value))
    return "\n".join(parts)


def blocks_verifier_gate(
    state: dict, gate_type: str, repo_root: Path
) -> tuple[bool, str | None]:
    """Return (should_deny, user_message) for mid-pipeline verifier delegations."""
    if not _is_gated_triage(state):
        return False, None

    task_id = task_id_from_state(state)

    if gate_type == "requirements":
        if _phase_incomplete(state, "requirements"):
            return (
                True,
                f"requirements-gate: phases.requirements が未完了です（task: {task_id}）。"
                " 要件フェーズ完了後（Phase C 完了、または Phase C スキップ後の"
                " Advisor Defaults 確認後）に init-workflow-state.py を実行してから"
                " verifier へ委譲してください。",
            )
        return False, None

    if gate_type == "spec":
        if _gate_incomplete(state, "requirements"):
            return (
                True,
                f"spec-gate: gates.requirements が未完了です（task: {task_id}）。"
                " requirements-gate を先に実行してください。",
            )
        if _phase_incomplete(state, "spec"):
            return (
                True,
                f"spec-gate: phases.spec が未完了です（task: {task_id}）。"
                " spec-agent 完了後に verifier（spec-gate）へ委譲してください。",
            )
        artifact_error = validate_spec_artifacts(state, repo_root)
        if artifact_error:
            return True, f"{artifact_error}（task: {task_id}）"
        return False, None

    if gate_type == "testspec":
        if _gate_incomplete(state, "spec"):
            return (
                True,
                f"testspec-gate: gates.spec が未完了です（task: {task_id}）。"
                " spec-gate を先に実行してください。",
            )
        if _phase_incomplete(state, "testspec"):
            return (
                True,
                f"testspec-gate: phases.testspec が未完了です（task: {task_id}）。"
                " test-agent（spec-test-design）完了後に verifier（testspec-gate）へ"
                " 委譲してください。",
            )
        return False, None

    return False, None


def blocks_verifier_final_acceptance(state: dict) -> tuple[bool, str | None]:
    """Return (should_deny, user_message) for final acceptance verifier delegations."""
    if not _is_gated_triage(state):
        return False, None

    task_id = task_id_from_state(state)

    if _phase_incomplete(state, "implementation"):
        return (
            True,
            f"最終受け入れ: phases.implementation が未完了です（task: {task_id}）。"
            " build-agent 完了後に review-agent → verifier へ委譲してください。",
        )

    if _phase_incomplete(state, "review"):
        return (
            True,
            f"最終受け入れ: phases.review が未完了です（task: {task_id}）。"
            " review-agent 完了後に verifier へ委譲してください。",
        )

    return False, None
