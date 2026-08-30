#!/usr/bin/env python3
"""Unit tests for workflow-state helpers and gates."""

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parent
import sys

sys.path.insert(0, str(HOOKS_DIR))

from _workflow_state import (  # noqa: E402
    blocks_build_agent,
    blocks_requirements_gate_verifier,
    blocks_spec_agent_workflow,
    blocks_test_agent,
    blocks_verifier_final_acceptance,
    blocks_verifier_gate,
    detect_verifier_gate,
    extract_task_id_from_prompt,
    filter_states_for_task,
    missing_red_test_tcs,
    parse_workflow_state,
    tc_present_in_test_sources,
    validate_red_tests,
    validate_spec_artifacts,
)

_update_spec = importlib.util.spec_from_file_location(
    "update_workflow_state_mod",
    HOOKS_DIR / "update-workflow-state.py",
)
_update_mod = importlib.util.module_from_spec(_update_spec)
assert _update_spec and _update_spec.loader
_update_spec.loader.exec_module(_update_mod)
update_file = _update_mod.update_file


SAMPLE_STATE = """\
task_id: demo
triage: middle
feature_slug: demo

phases:
  requirements: done
  spec: done
  testspec: done
  tests: pending
  implementation: pending
  review: pending

gates:
  requirements: done
  spec: done
  testspec: done

artifacts:
  intent_brief: temporary/intent-brief-demo.md
  requirements_brief: temporary/requirements-brief-demo.md
  systemspec_section: "§9.1 Demo"
  testspec: doc/testspec-demo.md

bypass:
  reason: null
"""

TESTSPEC_DOC = """\
# Testspec demo

| TC ID | Category | Sub | Priority | Input | Expected | Notes | Spec |
|-------|----------|-----|----------|-------|----------|-------|------|
| TC-001 | Happy | sample | P0 | 1 | 2 | sample | §9.1 |
"""


class WorkflowStateParserTests(unittest.TestCase):
    def test_parse_nested_blocks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "workflow-state-demo.yaml"
            path.write_text(SAMPLE_STATE, encoding="utf-8")
            state = parse_workflow_state(path)
            self.assertEqual(state["task_id"], "demo")
            self.assertEqual(state["phases"]["spec"], "done")
            self.assertEqual(state["gates"]["testspec"], "done")
            self.assertEqual(state["artifacts"]["testspec"], "doc/testspec-demo.md")

    def test_extract_task_id_from_prompt(self) -> None:
        tool_input = {"prompt": "Task ID: my-feature\nGoal: do thing"}
        self.assertEqual(extract_task_id_from_prompt(tool_input), "my-feature")

    def test_filter_states_requires_task_id_when_multiple(self) -> None:
        states = [{"task_id": "a", "path": Path("a")}, {"task_id": "b", "path": Path("b")}]
        matched, err = filter_states_for_task(states, None)
        self.assertEqual(matched, [])
        self.assertIn("Task ID", err or "")


class GateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.temp = self.root / "temporary"
        self.temp.mkdir()
        (self.root / "doc").mkdir()
        (self.root / "doc" / "systemspec.md").write_text("# Spec\n\n## §9.1 Demo\n", encoding="utf-8")
        (self.root / "doc" / "testspec-demo.md").write_text(TESTSPEC_DOC, encoding="utf-8")
        (self.root / "tests").mkdir()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _state(self, **overrides: object) -> dict:
        base = parse_workflow_state(self._write_state())
        base.update(overrides)
        return base

    def _write_state(self, text: str = SAMPLE_STATE) -> Path:
        path = self.temp / "workflow-state-demo.yaml"
        path.write_text(text, encoding="utf-8")
        return path

    def test_blocks_test_agent_when_spec_phase_pending(self) -> None:
        text = SAMPLE_STATE.replace("  spec: done\n", "  spec: pending\n", 1)
        path = self._write_state(text)
        state = parse_workflow_state(path)
        deny, msg = blocks_test_agent([state], self.root)
        self.assertTrue(deny)
        self.assertIn("spec", msg or "")

    def test_blocks_test_agent_when_gate_spec_pending(self) -> None:
        text = SAMPLE_STATE.replace(
            "gates:\n  requirements: done\n  spec: done\n  testspec: done",
            "gates:\n  requirements: done\n  spec: pending\n  testspec: done",
            1,
        )
        path = self._write_state(text)
        state = parse_workflow_state(path)
        self.assertEqual(state["phases"]["spec"], "done")
        self.assertEqual(state["gates"]["spec"], "pending")
        deny, msg = blocks_test_agent([state], self.root)
        self.assertTrue(deny)
        self.assertIn("spec-gate", msg or "")

    def test_blocks_build_agent_when_tests_pending(self) -> None:
        path = self._write_state()
        state = parse_workflow_state(path)
        deny, msg = blocks_build_agent([state], self.root)
        self.assertTrue(deny)
        self.assertIn("tests", msg or "")

    def test_allows_build_agent_when_tests_done(self) -> None:
        text = SAMPLE_STATE.replace("  tests: pending\n", "  tests: done\n", 1)
        path = self._write_state(text)
        (self.root / "tests" / "demo.test.ts").write_text(
            "it('TC-001: sample', () => {});\n", encoding="utf-8"
        )
        state = parse_workflow_state(path)
        deny, _ = blocks_build_agent([state], self.root)
        self.assertFalse(deny)

    def test_validate_spec_artifacts_missing_section(self) -> None:
        path = self._write_state()
        state = parse_workflow_state(path)
        state["artifacts"]["systemspec_section"] = "§missing"
        err = validate_spec_artifacts(state, self.root)
        self.assertIsNotNone(err)

    def test_blocks_spec_agent_without_workflow_state(self) -> None:
        brief = self.temp / "intent-brief-demo.md"
        brief.write_text("| triage | Middle |\n", encoding="utf-8")
        deny, msg = blocks_spec_agent_workflow([], [brief])
        self.assertTrue(deny)
        self.assertIn("workflow-state", msg or "")

    def test_validate_red_tests_missing_tc(self) -> None:
        text = SAMPLE_STATE.replace("  tests: pending\n", "  tests: done\n", 1)
        path = self._write_state(text)
        state = parse_workflow_state(path)
        err = validate_red_tests(state, self.root)
        self.assertIsNotNone(err)
        self.assertIn("TC-001", err or "")

    def test_update_file_sets_gate(self) -> None:
        path = self._write_state()
        update_file(path, None, None, "spec", "done", {})
        state = parse_workflow_state(path)
        self.assertEqual(state["gates"]["spec"], "done")

    def test_detect_verifier_gate_keywords(self) -> None:
        self.assertEqual(detect_verifier_gate("Task ID: x\nrequirements-gate"), "requirements")
        self.assertEqual(detect_verifier_gate("spec-gate after spec-agent"), "spec")
        self.assertEqual(detect_verifier_gate("testspec-gate"), "testspec")
        self.assertIsNone(detect_verifier_gate("final acceptance"))

    def test_blocks_requirements_gate_verifier_without_state(self) -> None:
        temp = self.root / "temporary"
        temp.mkdir(exist_ok=True)
        (temp / "intent-brief-skip.md").write_text(
            "# Intent\n\n| triage | Middle |\n", encoding="utf-8"
        )
        deny, msg = blocks_requirements_gate_verifier(temp, "skip", [])
        self.assertTrue(deny)
        self.assertIn("init-workflow-state", msg or "")

    def test_blocks_verifier_spec_gate_when_spec_pending(self) -> None:
        text = SAMPLE_STATE.replace("  spec: done\n", "  spec: pending\n", 1)
        path = self._write_state(text)
        state = parse_workflow_state(path)
        deny, msg = blocks_verifier_gate(state, "spec", self.root)
        self.assertTrue(deny)
        self.assertIn("spec-gate", msg or "")

    def test_blocks_verifier_testspec_gate_when_spec_gate_pending(self) -> None:
        text = SAMPLE_STATE.replace(
            "gates:\n  requirements: done\n  spec: done\n  testspec: done",
            "gates:\n  requirements: done\n  spec: pending\n  testspec: done",
            1,
        )
        path = self._write_state(text)
        state = parse_workflow_state(path)
        deny, msg = blocks_verifier_gate(state, "testspec", self.root)
        self.assertTrue(deny)
        self.assertIn("spec-gate", msg or "")

    def test_blocks_verifier_final_when_review_pending(self) -> None:
        text = SAMPLE_STATE.replace("  tests: pending\n", "  tests: done\n", 1).replace(
            "  implementation: pending\n", "  implementation: done\n", 1
        )
        path = self._write_state(text)
        state = parse_workflow_state(path)
        deny, msg = blocks_verifier_final_acceptance(state)
        self.assertTrue(deny)
        self.assertIn("review", msg or "")

    def test_tc_present_pytest_variant(self) -> None:
        combined = "def test_tc_001_sample():\n    pass\n"
        self.assertTrue(tc_present_in_test_sources("TC-001", combined, self.root))

    def test_missing_red_tests_pytest_variant(self) -> None:
        text = SAMPLE_STATE.replace("  tests: pending\n", "  tests: done\n", 1)
        path = self._write_state(text)
        (self.root / "tests" / "demo_test.py").write_text(
            "def test_tc_001_sample():\n    assert True\n", encoding="utf-8"
        )
        state = parse_workflow_state(path)
        missing = missing_red_test_tcs(state, self.root)
        self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main()
