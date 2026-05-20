# Как работает Agentic Flow Playbook

Agentic Flow Playbook — internal alpha для управляемой работы AI-агентов в OpenCode. Задача проходит через контекст, deterministic routing, approval gates, subagent execution, verification и audit.

## Flow

```text
User task
  → Synapse Orchestrator
  → Context discovery
  → Rule-based routing
  → Matched subagent
  → RED/GREEN/review gates
  → verify → complete
```

## Synapse

`synapse` — orchestrator. Он:

- классифицирует задачу;
- собирает routing facts;
- загружает нужный context;
- читает `context/core/rules/routing-rules.json`;
- делегирует matched subagent;
- не пишет production code напрямую.

## Routing

Основные маршруты MVP:

| Ситуация | Действие |
| --- | --- |
| dangerous shell/delete/install/network/destructive git/outside repo/secrets | request approval |
| safe read-only bash: `pwd`, `ls *`, `rg *`, `grep *`, `git status*`, `git diff*` | direct execution |
| failing test output | `TestDiagnostician` |
| Playwright / E2E | `PlaywrightTestGenerator` |
| test-first / TDD | `TestDesigner` |
| ML / RAG / model evaluation | `MLDeveloper` |
| Java/Kotlin/Gradle backend | `JavaDeveloper` |
| JS/TS/React/CSS | `FrontendDeveloper` |
| complex implementation/refactoring | `TaskManager` |
| docs / README | `DocWriter` |
| review / audit | `CodeReviewer` |
| build / test validation | `BuildAgent` |
| generic implementation | `CoderAgent` |
| context discovery | `ContextScout` |

If no rule matches, runtime should fail/block rather than silently pick a fallback.

## Approval gate

Approval removes only the safety gate. After approval Synapse must route again and delegate to the matched subagent. It must not use approval to bypass routing or write production code itself.

## AutoFlow state

Task-flow artifacts live under `.tmp/tasks/{feature}/`:

- `task.json`
- `subtask_NN.json`

Subtasks must record gates before verification:

- `context_discovery`
- `red`
- `green`
- `review`

Then `task-cli verify` records verification evidence and `task-cli complete` records completion.

## Completion gate

```bash
npm run task-cli -- verify <feature> <seq>
npm run task-cli -- complete <feature> <seq> "summary"
```

Feature-level closeout:

```bash
npm run task-cli -- verify-feature <feature>
npm run task-cli -- archive <feature>
```

## Audit trail

Audit JSONL events are written to:

```text
.tmp/audit/routing/{date}/{session}.jsonl
```

Events are sanitized and validated by:

```bash
npm run validate:audit
```

## Validation

```bash
npm run validate
```
