#!/usr/bin/env python3
"""Validate JSONL audit events emitted by the playbook runtime."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

REQUIRED_FIELDS = {"timestamp", "session_id", "event_type", "input_facts", "matched_rule", "action", "agent", "result"}
ALLOWED_EVENT_TYPES = {
    "routing_decision",
    "approval_decision",
    "subagent_handoff",
    "verification_result",
    "completion",
    "archive",
    "lifecycle_transition",
}
SECRET_VALUE = re.compile(r"(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|AIza[A-Za-z0-9_-]{12,}|/" + r"Users/[^\s\"']+)")
SECRET_KEY = re.compile(r"(api[_-]?key|token|secret|password|authorization)", re.IGNORECASE)


def iter_event_files(audit_root: Path):
    if not audit_root.exists():
        return []
    return sorted(path for path in audit_root.rglob("*.jsonl") if path.is_file())


def contains_secret(value: Any) -> bool:
    if isinstance(value, dict):
        for key, item in value.items():
            if SECRET_KEY.search(str(key)) and item != "[REDACTED]":
                return True
            if contains_secret(item):
                return True
        return False
    if isinstance(value, list):
        return any(contains_secret(item) for item in value)
    if isinstance(value, str):
        return bool(SECRET_VALUE.search(value))
    return False


def validate_event(event: dict[str, Any], source: str) -> list[str]:
    errors: list[str] = []
    missing = sorted(REQUIRED_FIELDS - set(event.keys()))
    if missing:
        errors.append(f"{source}: missing required fields: {', '.join(missing)}")

    event_type = event.get("event_type")
    if event_type not in ALLOWED_EVENT_TYPES:
        errors.append(f"{source}: invalid event_type {event_type!r}")

    if not isinstance(event.get("input_facts"), dict):
        errors.append(f"{source}: input_facts must be object")
    if not isinstance(event.get("session_id"), str) or not event.get("session_id"):
        errors.append(f"{source}: session_id must be non-empty string")
    if contains_secret(event):
        errors.append(f"{source}: event contains an unsanitized secret or local path")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate audit JSONL files")
    parser.add_argument("--audit-root", default=".tmp/audit", help="Audit root to scan")
    parser.add_argument("--allow-empty", action="store_true", help="Pass when no audit events exist")
    args = parser.parse_args()

    audit_root = Path(args.audit_root)
    files = iter_event_files(audit_root)
    if not files:
        if args.allow_empty:
            print("Audit validation passed: no audit events found")
            return 0
        print(f"No audit JSONL files found under {audit_root}")
        return 1

    errors: list[str] = []
    events_seen = 0
    for path in files:
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip():
                continue
            events_seen += 1
            try:
                event = json.loads(line)
            except json.JSONDecodeError as exc:
                errors.append(f"{path}:{line_no}: invalid JSON: {exc}")
                continue
            errors.extend(validate_event(event, f"{path}:{line_no}"))

    if errors:
        print("Audit validation failed:")
        for error in errors:
            print(f"  - {error}")
        return 1

    print(f"Audit validation passed: {events_seen} event(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
