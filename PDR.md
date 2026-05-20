# PDR — Agentic Flow Playbook / AutoFlow

**Status:** alpha / internal MVP  
**Goal:** portable, rule-routed OpenCode playbook with verifiable task lifecycle.

## MVP scope

The MVP includes:

- portable `opencode.jsonc.example` and local `opencode.jsonc`;
- Synapse orchestrator with no direct production-code write permissions;
- deterministic routing rules in `context/core/rules/routing-rules.json`;
- core subagents listed in `docs/ARCHITECTURE.md`;
- task lifecycle artifacts in `.tmp/tasks/{feature}/`;
- Task CLI lifecycle, gates, verification, completion, feature verification, archive;
- audit JSONL writer/validator;
- one-command validation through `npm run validate`;
- provider/data classification policy.

## MVP non-goals

- autonomous push/merge;
- storing real secrets;
- mandatory Memory Service;
- mandatory external/internal docs connectors;
- production rollout without provider/data approval;
- broad routing expansion before scenario coverage.

## Runtime pipeline

```text
User task
  → Synapse intake
  → ContextScout discovery
  → TaskManager decomposition when complex
  → routing-rules.json
  → matched subagent
  → RED/GREEN/review gates
  → task-cli verify
  → task-cli complete
  → audit event
```

## Acceptance criteria

- Config is portable and contains no personal local paths.
- Secrets are loaded only through env vars.
- Optional MCP servers are disabled by default.
- Synapse cannot edit/write directly in portable config.
- Approval only removes safety gate; it does not bypass routing.
- Routing evaluator, schema, docs, and scenarios stay in parity.
- Task JSON schemas exist and `task-cli validate` checks task artifacts.
- AutoFlow gates prevent skipping context discovery, RED, GREEN, review, verify, and complete.
- Audit events are sanitized and valid JSONL.
- CI and local validation use `npm run validate`.

## Roadmap

Routing expansion is tracked in `docs/ROUTING_ROADMAP.md`. Provider/data handling is tracked in `docs/PROVIDER_DATA_POLICY.md`. New domains must add scenarios before enabling runtime rules.
