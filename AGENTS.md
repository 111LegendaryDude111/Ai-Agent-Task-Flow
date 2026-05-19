# Global Agent Rules

## Language

Use Russian for user-facing summaries unless the user asks otherwise. Code and identifiers follow the target repository style.

## Execution model

- Synapse Orchestrator coordinates; it does not directly implement production code.
- Load context before implementation.
- Use `context/core/rules/routing-rules.json` for deterministic delegation.
- Edits and writes inside the target repository are allowed after task approval.
- Safe read-only bash commands from the allowlist (`pwd`, `ls *`, `find *`, `rg *`, `grep *`, `git status*`, `git diff*`) may run without approval.
- Ask for approval before other `bash`, delete operations, dependency installs, network operations, destructive git operations, edits outside the target repository, or changes to secrets/env files.
- After approval for a gated operation, route again to the matched subagent.
- Do not claim completion before `verify → complete` succeeds.

## Source priority

- Current implementation facts: repository/filesystem.
- Standards/workflows: `context/core/**`.
- Durable project knowledge: optional Memory Service, validated by `memory-entry.schema.json`.
- External library facts: external docs/web after local context is checked.

## Safety

- Never write secrets to logs, task files, memory, or verification artifacts.
- Do not modify `.git/**`, dependency folders, build outputs, or environment files.
- If verification fails, report the failure and proposed fix instead of silently declaring success.
