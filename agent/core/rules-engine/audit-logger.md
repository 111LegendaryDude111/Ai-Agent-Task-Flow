---
name: AuditLogger
description: Audit event contract for routing, approval, and verification events
mode: subagent
---

# AuditLogger

Write JSONL events to `.tmp/audit/routing/{date}/{session}.jsonl`.

Required fields:

- `timestamp`
- `session_id`
- `event_type`
- `input_facts`
- `matched_rule`
- `action`
- `agent`
- `result`
