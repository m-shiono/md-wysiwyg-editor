#!/usr/bin/env python3
"""E2E tests for gate-*.py hooks (stdin JSON → permission)."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS = Path(__file__).resolve().parent


def run_hook(script: str, tool_input: dict, cwd: Path) -> dict:
    proc = subprocess.run(
        [sys.executable, str(HOOKS / script)],
        input=json.dumps({"tool_input": tool_input}),
        cwd=str(cwd),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0 and not proc.stdout.strip():
        raise RuntimeError(f"{script} failed: {proc.stderr}")
    return json.loads(proc.stdout)


WORKFLOW_STATE = """\
task_id: demo
triage: middle
feature_slug: demo
phases:
  requirements: done
  spec: done
  testspec: done
  tests: done
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
tdd_loop:
  iteration: 0
  max: 3
  status: pending
  last_failure: null
"""

TESTSPEC = """\
# Testspec demo

## Test Matrix

| TC ID | Category | Sub | Priority | Input | Expected | Notes | Spec |
|-------|----------|-----|----------|-------|----------|-------|------|
| TC-001 | Happy | sample | P0 | 1 | 2 | sample | §9.1 |
"""


class GateE2ETests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        (self.root / "temporary").mkdir()
        (self.root / "doc").mkdir()
        (self.root / "tests").mkdir()
        (self.root / "doc" / "systemspec.md").write_text("# Spec\n\n## §9.1 Demo\n", encoding="utf-8")
        (self.root / "doc" / "testspec-demo.md").write_text(TESTSPEC, encoding="utf-8")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _write_state(self, text: str = WORKFLOW_STATE) -> None:
        (self.root / "temporary" / "workflow-state-demo.yaml").write_text(text, encoding="utf-8")

    def test_build_agent_denied_without_red_tests(self) -> None:
        self._write_state()
        result = run_hook(
            "gate-specification-workflow.py",
            {"subagent_type": "build-agent", "prompt": "Task ID: demo"},
            self.root,
        )
        self.assertEqual(result["permission"], "deny")
        self.assertIn("P0", result.get("user_message", ""))

    def test_build_agent_allowed_with_red_tests(self) -> None:
        self._write_state()
        (self.root / "tests" / "demo.test.ts").write_text(
            "it('TC-001: sample', () => {});\n", encoding="utf-8"
        )
        result = run_hook(
            "gate-specification-workflow.py",
            {"subagent_type": "build-agent", "prompt": "Task ID: demo"},
            self.root,
        )
        self.assertEqual(result["permission"], "allow")

    def test_init_workflow_state_creates_file(self) -> None:
        proc = subprocess.run(
            [
                sys.executable,
                str(HOOKS / "init-workflow-state.py"),
                "--task-id",
                "e2e-init",
                "--triage",
                "middle",
            ],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        created = REPO_ROOT / "temporary" / "workflow-state-e2e-init.yaml"
        try:
            self.assertTrue(created.is_file())
            text = created.read_text(encoding="utf-8")
            self.assertIn("task_id: e2e-init", text)
            self.assertIn("requirements: pending", text.split("gates:")[1])
        finally:
            if created.is_file():
                created.unlink()

    def test_spec_agent_denied_when_requirements_gate_pending(self) -> None:
        """Init must not pre-set gates.requirements: done (verifier bypass)."""
        task_id = "gate-demo"
        (self.root / "temporary" / f"intent-brief-{task_id}.md").write_text(
            "# Intent\n\n| triage | Middle |\n", encoding="utf-8"
        )
        (self.root / "temporary" / f"requirements-brief-{task_id}.md").write_text(
            "## User Decisions Required\n\nnone\n", encoding="utf-8"
        )
        proc = subprocess.run(
            [
                sys.executable,
                str(HOOKS / "init-workflow-state.py"),
                "--task-id",
                task_id,
                "--triage",
                "middle",
            ],
            cwd=str(self.root),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)

        result = run_hook(
            "gate-requirements-workflow.py",
            {"subagent_type": "spec-agent", "prompt": f"Task ID: {task_id}"},
            self.root,
        )
        self.assertEqual(result["permission"], "deny")
        self.assertIn("requirements-gate", result.get("user_message", ""))

    def test_spec_agent_allowed_after_requirements_gate_done(self) -> None:
        task_id = "gate-pass"
        (self.root / "temporary" / f"intent-brief-{task_id}.md").write_text(
            "# Intent\n\n| triage | Middle |\n", encoding="utf-8"
        )
        (self.root / "temporary" / f"requirements-brief-{task_id}.md").write_text(
            "## User Decisions Required\n\nnone\n", encoding="utf-8"
        )
        (self.root / "temporary" / f"workflow-state-{task_id}.yaml").write_text(
            f"""\
task_id: {task_id}
triage: middle
feature_slug: {task_id}
phases:
  requirements: done
  spec: pending
  testspec: pending
  tests: pending
  implementation: pending
  review: pending
gates:
  requirements: done
  spec: pending
  testspec: pending
artifacts:
  intent_brief: temporary/intent-brief-{task_id}.md
  requirements_brief: temporary/requirements-brief-{task_id}.md
  systemspec_section: null
  testspec: null
bypass:
  reason: null
""",
            encoding="utf-8",
        )

        result = run_hook(
            "gate-requirements-workflow.py",
            {"subagent_type": "spec-agent", "prompt": f"Task ID: {task_id}"},
            self.root,
        )
        self.assertEqual(result["permission"], "allow")

    def test_verifier_spec_gate_denied_when_spec_pending(self) -> None:
        task_id = "verifier-spec"
        text = WORKFLOW_STATE.replace("task_id: demo", f"task_id: {task_id}").replace(
            "  spec: done\n", "  spec: pending\n", 1
        )
        (self.root / "temporary" / f"workflow-state-{task_id}.yaml").write_text(text, encoding="utf-8")
        result = run_hook(
            "gate-verifier-workflow.py",
            {
                "subagent_type": "verifier",
                "prompt": f"Task ID: {task_id}\nGoal: spec-gate",
            },
            self.root,
        )
        self.assertEqual(result["permission"], "deny")
        self.assertIn("spec-gate", result.get("user_message", ""))

    def test_verifier_spec_gate_allowed_when_ready(self) -> None:
        task_id = "verifier-ready"
        text = WORKFLOW_STATE.replace("task_id: demo", f"task_id: {task_id}").replace(
            "  tests: done\n", "  tests: pending\n", 1
        )
        (self.root / "temporary" / f"workflow-state-{task_id}.yaml").write_text(text, encoding="utf-8")
        result = run_hook(
            "gate-verifier-workflow.py",
            {
                "subagent_type": "verifier",
                "prompt": f"Task ID: {task_id}\nGoal: spec-gate",
            },
            self.root,
        )
        self.assertEqual(result["permission"], "allow")

    def test_verifier_final_acceptance_allowed_when_review_done(self) -> None:
        text = WORKFLOW_STATE.replace("  implementation: pending\n", "  implementation: done\n", 1)
        text = text.replace("  review: pending\n", "  review: done\n", 1)
        self._write_state(text)
        result = run_hook(
            "gate-verifier-workflow.py",
            {"subagent_type": "verifier", "prompt": "Task ID: demo\nGoal: final acceptance"},
            self.root,
        )
        self.assertEqual(result["permission"], "allow")

    def test_verifier_final_denied_when_review_pending(self) -> None:
        text = WORKFLOW_STATE.replace("  implementation: pending\n", "  implementation: done\n", 1)
        (self.root / "temporary" / "workflow-state-demo.yaml").write_text(text, encoding="utf-8")
        result = run_hook(
            "gate-verifier-workflow.py",
            {"subagent_type": "verifier", "prompt": "Task ID: demo\nGoal: final acceptance"},
            self.root,
        )
        self.assertEqual(result["permission"], "deny")
        self.assertIn("review", result.get("user_message", ""))

    def test_verifier_requirements_gate_denied_without_workflow_state(self) -> None:
        """Phase C skip (UD=0): deny requirements-gate verifier until init-workflow-state."""
        task_id = "phase-c-skip"
        (self.root / "temporary" / f"intent-brief-{task_id}.md").write_text(
            "# Intent\n\n| triage | Middle |\n", encoding="utf-8"
        )
        (self.root / "temporary" / f"requirements-brief-{task_id}.md").write_text(
            "## User Decisions Required\n\nnone\n", encoding="utf-8"
        )

        result = run_hook(
            "gate-verifier-workflow.py",
            {
                "subagent_type": "verifier",
                "prompt": f"Task ID: {task_id}\nGoal: requirements-gate",
            },
            self.root,
        )
        self.assertEqual(result["permission"], "deny")
        self.assertIn("init-workflow-state", result.get("user_message", ""))

    def test_verifier_requirements_gate_denied_without_task_id(self) -> None:
        """Middle+ intent without Task ID still requires workflow-state for requirements-gate."""
        (self.root / "temporary" / "intent-brief-no-task.md").write_text(
            "# Intent\n\n| triage | Middle |\n", encoding="utf-8"
        )
        result = run_hook(
            "gate-verifier-workflow.py",
            {
                "subagent_type": "verifier",
                "prompt": "Goal: requirements-gate",
            },
            self.root,
        )
        self.assertEqual(result["permission"], "deny")
        self.assertIn("init-workflow-state", result.get("user_message", ""))

    def test_phase_c_skip_path_after_init(self) -> None:
        """Phase C skip: init → requirements-gate verifier allow → spec-agent blocked until gate."""
        task_id = "skip-flow"
        (self.root / "temporary" / f"intent-brief-{task_id}.md").write_text(
            "# Intent\n\n| triage | Middle |\n", encoding="utf-8"
        )
        (self.root / "temporary" / f"requirements-brief-{task_id}.md").write_text(
            "## User Decisions Required\n\nnone\n", encoding="utf-8"
        )
        proc = subprocess.run(
            [
                sys.executable,
                str(HOOKS / "init-workflow-state.py"),
                "--task-id",
                task_id,
                "--triage",
                "middle",
            ],
            cwd=str(self.root),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)

        verifier_result = run_hook(
            "gate-verifier-workflow.py",
            {
                "subagent_type": "verifier",
                "prompt": f"Task ID: {task_id}\nGoal: requirements-gate",
            },
            self.root,
        )
        self.assertEqual(verifier_result["permission"], "allow")

        spec_result = run_hook(
            "gate-requirements-workflow.py",
            {"subagent_type": "spec-agent", "prompt": f"Task ID: {task_id}"},
            self.root,
        )
        self.assertEqual(spec_result["permission"], "deny")
        self.assertIn("requirements-gate", spec_result.get("user_message", ""))

    def test_stop_nudge_when_intent_only(self) -> None:
        (self.root / "temporary" / "intent-brief-only.md").write_text("# Intent\n", encoding="utf-8")
        proc = subprocess.run(
            [sys.executable, str(HOOKS / "requirements-stop-check.py")],
            input="{}",
            cwd=str(self.root),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        payload = json.loads(proc.stdout)
        self.assertIn("followup_message", payload)
        self.assertIn("Requirements Brief", payload["followup_message"])

    def test_stop_silent_when_requirements_brief_exists(self) -> None:
        (self.root / "temporary" / "intent-brief-x.md").write_text("# Intent\n", encoding="utf-8")
        (self.root / "temporary" / "requirements-brief-x.md").write_text("# Req\n", encoding="utf-8")
        proc = subprocess.run(
            [sys.executable, str(HOOKS / "requirements-stop-check.py")],
            input="{}",
            cwd=str(self.root),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(json.loads(proc.stdout), {})

    def test_archive_workflow_state_moves_file(self) -> None:
        self._write_state()
        proc = subprocess.run(
            [sys.executable, str(HOOKS / "archive-workflow-state.py"), "--task-id", "demo"],
            cwd=str(self.root),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertFalse((self.root / "temporary" / "workflow-state-demo.yaml").is_file())
        archived = list((self.root / "temporary" / "archive").glob("workflow-state-demo-*.yaml"))
        self.assertEqual(len(archived), 1)

    def test_archive_workflow_state_delete(self) -> None:
        self._write_state()
        proc = subprocess.run(
            [
                sys.executable,
                str(HOOKS / "archive-workflow-state.py"),
                "--task-id",
                "demo",
                "--delete",
            ],
            cwd=str(self.root),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertFalse((self.root / "temporary" / "workflow-state-demo.yaml").is_file())
        self.assertFalse((self.root / "temporary" / "archive").exists())


if __name__ == "__main__":
    unittest.main()
