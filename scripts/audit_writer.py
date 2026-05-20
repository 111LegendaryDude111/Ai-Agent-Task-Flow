#!/usr/bin/env python3
"""Append sanitized JSONL audit events for routing and task-flow runtime events."""

from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_AUDIT_ROOT = ROOT / ".tmp" / "audit" / "routing"
SECRET_KEYS = re.compile(r"(api[_-]?key|token|secret|password|authorization)", re.IGNORECASE)
SECRET_VALUES = re.compile(r"(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|AIza[A-Za-z0-9_-]{12,}|/" + r"Users/[^\s\"']+)")


def sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for key, item in value.items():
            if SECRET_KEYS.search(str(key)):
                sanitized[str(key)] = "[REDACTED]"
            else:
                sanitized[str(key)] = sanitize(item)
        return sanitized

    if isinstance(value, list):
        return [sanitize(item) for item in value]

    if isinstance(value, str):
        return SECRET_VALUES.sub("[REDACTED]", value)

    return value


def append_audit_event(event: dict[str, Any], audit_root: Path = DEFAULT_AUDIT_ROOT) -> Path:
    now = datetime.now(timezone.utc)
    session_id = str(event.get("session_id") or os.environ.get("AUDIT_SESSION_ID") or "local-session")
    safe_session = re.sub(r"[^A-Za-z0-9_.-]", "-", session_id)[:80] or "local-session"

    payload = sanitize({
        "timestamp": event.get("timestamp") or now.isoformat(),
        "session_id": safe_session,
        "event_type": event.get("event_type") or "unknown",
        "input_facts": event.get("input_facts", {}),
        "matched_rule": event.get("matched_rule"),
        "action": event.get("action"),
        "agent": event.get("agent"),
        "result": event.get("result"),
        "metadata": event.get("metadata", {}),
    })

    output_dir = audit_root / now.date().isoformat()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{safe_session}.jsonl"
    with output_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False, sort_keys=True) + "\n")
    return output_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Append one sanitized audit JSONL event")
    parser.add_argument("--event", required=True, help="JSON object event payload")
    parser.add_argument("--audit-root", default=str(DEFAULT_AUDIT_ROOT), help="Audit output root")
    args = parser.parse_args()

    event = json.loads(args.event)
    output = append_audit_event(event, Path(args.audit_root))
    print(output.relative_to(ROOT) if output.is_relative_to(ROOT) else output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
