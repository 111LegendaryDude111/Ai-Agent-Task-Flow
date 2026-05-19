#!/usr/bin/env python3

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
FEATURE = "task-cli-e2e"
FIXTURE_DIR = ROOT / "fixtures" / "task-management" / FEATURE
TEST_PROJECT_DIR = ROOT / ".tmp" / "task-cli-e2e-project"
TASKS_DIR = TEST_PROJECT_DIR / ".tmp" / "tasks"
FEATURE_DIR = TASKS_DIR / FEATURE
ARCHIVED_DIR = TASKS_DIR / "completed" / FEATURE
WORK_DIR = TEST_PROJECT_DIR / ".tmp" / "task-cli-e2e-files" / FEATURE
TASK_CLI = ROOT / "scripts" / "task-cli.ts"
PROBE_SOURCE = ROOT / "scripts" / "task_cli_e2e_probe.py"
PROBE_DEST = TEST_PROJECT_DIR / "scripts" / "task_cli_e2e_probe.py"


def cleanup() -> None:
    if TEST_PROJECT_DIR.exists():
        shutil.rmtree(TEST_PROJECT_DIR)


def setup_fixture() -> None:
    cleanup()

    FEATURE_DIR.mkdir(parents=True, exist_ok=True)
    for file_name in ["task.json", "subtask_01.json"]:
        shutil.copy2(FIXTURE_DIR / file_name, FEATURE_DIR / file_name)

    WORK_DIR.mkdir(parents=True, exist_ok=True)
    (WORK_DIR / "implementation.txt").write_text("IMPLEMENTED\n", encoding="utf-8")

    PROBE_DEST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(PROBE_SOURCE, PROBE_DEST)

    subprocess.run(
        ["git", "init"],
        cwd=TEST_PROJECT_DIR,
        check=True,
        capture_output=True,
        text=True,
    )


def run_cli(*args: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["TS_NODE_COMPILER_OPTIONS"] = '{"module":"commonjs"}'

    npx_bin = "npx.cmd" if sys.platform == "win32" else "npx"
    command = [npx_bin, "ts-node", str(TASK_CLI), *args]

    result = subprocess.run(
        command,
        cwd=TEST_PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
    )

    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        raise RuntimeError(f"CLI command failed: {' '.join(args)}")

    return result


def assert_archived_state() -> None:
    if FEATURE_DIR.exists():
        raise RuntimeError("Feature directory still exists in active tasks after archive")

    if not ARCHIVED_DIR.exists():
        raise RuntimeError("Archived feature directory was not created")

    task = json.loads((ARCHIVED_DIR / "task.json").read_text(encoding="utf-8"))
    subtask = json.loads((ARCHIVED_DIR / "subtask_01.json").read_text(encoding="utf-8"))

    if task.get("status") != "archived":
        raise RuntimeError(f"Expected archived task status, got {task.get('status')}")

    if task.get("verification", {}).get("status") != "passed":
        raise RuntimeError("Feature verification did not pass")

    if subtask.get("status") != "completed":
        raise RuntimeError(f"Expected completed subtask status, got {subtask.get('status')}")

    if subtask.get("verification", {}).get("status") != "passed":
        raise RuntimeError("Subtask verification did not pass")


def main() -> int:
    setup_fixture()

    try:
        run_cli("validate", FEATURE)
        run_cli("verify", FEATURE, "01")
        run_cli("complete", FEATURE, "01", "Implemented deterministic e2e fixture")
        run_cli("validate", FEATURE)
        run_cli("verify-feature", FEATURE)
        run_cli("archive", FEATURE)
        assert_archived_state()
    finally:
        cleanup()

    print("Task CLI E2E fixture passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
