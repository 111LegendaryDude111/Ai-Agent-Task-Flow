# Архитектура Agentic Flow Playbook

## Назначение

Agentic Flow Playbook — переносимый конфигурационный слой для OpenCode. Он задает orchestrator, subagents, routing rules, workflows, task CLI и validation suite.

```text
context-first → deterministic routing → delegated execution → verification → audit
```

## Runtime components

| Component | Path | Purpose |
| --- | --- | --- |
| OpenCode config | `opencode.jsonc`, `opencode.jsonc.example` | Portable provider/agent/permission config |
| Synapse | `agent/core/sfa-synapse.md` | Orchestration only |
| Subagents | `agent/subagents/**` | Specialized execution |
| Routing rules | `context/core/rules/routing-rules.json` | Deterministic routing |
| Task CLI | `scripts/task-cli.ts` | Lifecycle, gates, verify/complete |
| State machine | `context/core/workflows/auto-flow-state-machine.json` | Allowed AutoFlow states |
| Audit | `scripts/audit_writer.py`, `scripts/validate_audit_events.py` | JSONL event writing/validation |

## Permissions model

- Synapse has `edit: deny` and `write: deny` in portable config.
- Matched implementation/documentation/test subagents can edit/write inside target repo after task approval.
- Read-only agents keep edit/write denied.
- Safe read-only bash allowlist: `pwd`, `ls *`, `rg *`, `grep *`, `git status*`, `git diff*`.
- Other shell/delete/install/network/destructive git/outside-repo/secrets operations require approval.
- Approval does not authorize Synapse to bypass routing.

## Subagents in MVP

| Agent | Role |
| --- | --- |
| `ContextScout` | read-only context discovery |
| `TaskManager` | decomposition into verifiable subtasks |
| `DocWriter` | documentation |
| `TestDesigner` | failing tests before implementation |
| `TestDiagnostician` | failing test diagnosis |
| `PlaywrightTestGenerator` | Playwright/E2E tests |
| `BuildAgent` | build/test validation |
| `CodeReviewer` | review and risk assessment |
| `CoderAgent` | generic implementation |
| `FrontendDeveloper` | JS/TS/React/CSS |
| `JavaDeveloper` | Java/Kotlin backend |
| `MLDeveloper` | ML/RAG/model evaluation |
| `RoutingEngine`, `ConditionEvaluator`, `AuditLogger` | rule/audit contracts |

## Task-flow state

State lives in `.tmp/tasks/{feature}/task.json` and `subtask_NN.json`.

Subtask lifecycle commands:

```bash
npm run task-cli -- start <feature> <seq> [agent_id]
npm run task-cli -- gate <feature> <seq> context_discovery "evidence"
npm run task-cli -- gate <feature> <seq> red "evidence"
npm run task-cli -- gate <feature> <seq> green "evidence"
npm run task-cli -- gate <feature> <seq> review "evidence"
npm run task-cli -- verify <feature> <seq>
npm run task-cli -- complete <feature> <seq> "summary"
```

`verify` refuses to run until required gates are recorded. `complete` refuses stale or failed verification.

## Validation suite

```bash
npm run validate
```

CI runs the same command and requires no secrets.

## MVP boundaries

Included:

- portable OpenCode config;
- deterministic routing;
- source routing policy;
- permissions hardening;
- task lifecycle and verification gates;
- audit event writer/validator;
- one-command validation.

Not included as mandatory runtime dependency:

- real secrets in repo;
- mandatory Memory Service;
- mandatory external/internal docs connector;
- automatic push/merge;
- production rollout without provider/data classification approval.
