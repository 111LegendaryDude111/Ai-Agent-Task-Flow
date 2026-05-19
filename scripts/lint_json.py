#!/usr/bin/env python3
"""
JSON Linter for routing rules files.

Validates JSON syntax and structure for all routing rules files.
"""

import json
import sys
from pathlib import Path
from typing import List, Tuple, Dict, Any
import argparse


if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


def lint_json_file(file_path: Path, schema_path: Path = None) -> Tuple[bool, List[str]]:
    """Lint a single JSON file."""
    errors = []

    # Check file exists
    if not file_path.exists():
        errors.append(f"File not found: {file_path}")
        return False, errors

    # Parse JSON
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        errors.append(f"Invalid JSON in {file_path}: {e}")
        return False, errors

    # Validate against schema if provided
    if schema_path and schema_path.exists():
        try:
            from jsonschema import Draft202012Validator

            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = json.load(f)

            validator = Draft202012Validator(schema)
            for err in sorted(validator.iter_errors(data), key=lambda item: list(item.absolute_path)):
                path = ".".join(str(p) for p in err.absolute_path) if err.absolute_path else "root"
                errors.append(f"{path} - {err.message}")

        except ImportError:
            pass  # jsonschema not installed

    return len(errors) == 0, errors


def find_routing_json_files(context_root: Path) -> Dict[str, Path]:
    """Find all routing-related JSON files."""
    rules_dir = context_root / "rules"
    config_dir = context_root / "config"

    files = {
        "routing schema": rules_dir / "routing-rules.schema.json",
        "routing rules": rules_dir / "routing-rules.json",
        "routing scenarios": rules_dir / "routing-rules.scenarios.json",
        "memory policy": config_dir / "memory-routing-policy.json",
        "memory policy scenarios": config_dir / "memory-routing-policy.scenarios.json",
        "memory entry schema": config_dir / "memory-entry.schema.json",
    }

    return files


def main():
    parser = argparse.ArgumentParser(description="Lint routing rules JSON files")
    parser.add_argument(
        "--context-root",
        type=str,
        default=None,
        help="Path to context root directory"
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Enable strict validation"
    )

    args = parser.parse_args()

    # Determine context root
    if args.context_root:
        context_root = Path(args.context_root)
    else:
        script_dir = Path(__file__).parent.parent
        context_root = script_dir / "context" / "core"

    if not context_root.exists():
        print(f"Error: Context root not found: {context_root}")
        sys.exit(1)

    files = find_routing_json_files(context_root)
    schema_path = files.get("routing schema")

    print("Linting routing rules JSON files...")
    print()

    all_passed = True
    total_errors = 0

    for name, file_path in files.items():
        if not file_path.exists():
            print(f"[SKIP] {name}: File not found, skipping")
            continue

        print(f"Checking {file_path.name}...")
        strict_schema = schema_path if args.strict and name in {"routing rules", "routing scenarios"} else None
        valid, errors = lint_json_file(file_path, strict_schema)

        if valid:
            print("  [OK] Valid JSON")
        else:
            print("  [FAIL] Invalid")
            for error in errors:
                print(f"    - {error}")
            all_passed = False
            total_errors += len(errors)

    print()
    print("=" * 60)

    if all_passed:
        print("[OK] All files passed linting")
        sys.exit(0)
    else:
        print(f"[FAIL] Linting failed with {total_errors} error(s)")
        sys.exit(1)


if __name__ == "__main__":
    main()
