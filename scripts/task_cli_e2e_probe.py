#!/usr/bin/env python3

import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: task_cli_e2e_probe.py <subtask|feature> <file>")
        return 1

    mode = sys.argv[1]
    file_path = Path(sys.argv[2])

    if mode not in {"subtask", "feature"}:
        print(f"Unknown mode: {mode}")
        return 1

    if not file_path.exists():
        print(f"Missing file: {file_path}")
        return 1

    content = file_path.read_text(encoding="utf-8")
    if "IMPLEMENTED" not in content:
        print("IMPLEMENTED marker missing")
        return 1

    if "TODO" in content or "FIXME" in content:
        print("Unexpected TODO/FIXME marker found")
        return 1

    print(f"{mode} probe passed for {file_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
