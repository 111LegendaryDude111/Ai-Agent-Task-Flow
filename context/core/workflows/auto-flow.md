# AutoFlow Workflow

AutoFlow turns one user goal into a deterministic multi-agent implementation loop.

Use this workflow when the user asks to run `auto-flow`, wants an agent to execute a prewritten plan, or wants an end-to-end flow from decomposition to tests, implementation, review, and completion.

State machine source: `context/core/workflows/auto-flow-state-machine.json`.

## Principles

- Synapse orchestrates; it does not implement production code.
- State lives in `.tmp/tasks/{feature}/task.json` and `subtask_NN.json`, not in agent memory.
- Work is split into vertical subtasks, not horizontal phases.
- Each implementation subtask follows vertical TDD:

```text
one behavior -> failing test -> minimal implementation -> green -> review -> verify -> complete
```

- Do not weaken tests to make code pass unless the test contradicts explicit requirements.
- Do not claim completion before verification succeeds.

## Roles

| Role | Agent |
| --- | --- |
| Orchestration | `synapse` |
| Context discovery | `ContextScout` |
| Decomposition and task files | `TaskManager` |
| Failing tests | `TestDesigner` |
| Implementation | routing-selected implementation subagent, including `MLDeveloper` for ML/RAG/model work |
| Test/build validation | `BuildAgent` |
| Failure diagnosis | `TestDiagnostician` |
| Review | `CodeReviewer` |

## Definition of Ready

Every subtask created by AutoFlow must be ready before implementation starts:

- objective is clear and scoped to one behavior or vertical slice;
- dependencies are explicit;
- required context files are listed;
- deliverables are listed;
- acceptance criteria include the expected behavior;
- test strategy is clear;
- `verification_spec` can be executed deterministically;
- suggested implementation agent is set.

## Definition of Done

A subtask is done only when:

- the expected failing test was created or relevant failing coverage already existed;
- implementation is minimal and scoped;
- targeted tests pass;
- required verification commands pass;
- CodeReviewer has no blocking findings;
- `npm run task-cli -- verify <feature> <seq>` passes;
- `npm run task-cli -- complete <feature> <seq> "summary"` succeeds.

## Execution flow

1. **Intake**
   - Restate the user goal.
   - Identify missing requirements.
   - Stop and ask if success criteria or scope are ambiguous.

2. **Context discovery**
   - Delegate to `ContextScout`.
   - Load only relevant source, tests, configs, and standards.

3. **Task decomposition**
   - Delegate to `TaskManager`.
   - Create `.tmp/tasks/{feature}/task.json` and `subtask_NN.json` files.
   - Include DoR, DoD, acceptance criteria, deliverables, dependencies, suggested agent, and `verification_spec`.
   - Validate task files with `npm run task-cli -- validate <feature>` when permitted.

4. **Subtask loop**
   - Select the next ready subtask via `npm run task-cli -- next <feature>`.
   - Delegate tests to `TestDesigner`.
   - Confirm RED via `BuildAgent`.
   - Route implementation via `context/core/rules/routing-rules.json`.
   - Confirm GREEN via `BuildAgent`.
   - If validation fails, delegate diagnosis to `TestDiagnostician`.
   - Delegate review to `CodeReviewer`.
   - Run `npm run task-cli -- verify <feature> <seq>`.
   - Run `npm run task-cli -- complete <feature> <seq> "summary"`.
   - Repeat until no subtasks remain.

5. **Feature closeout**
   - Run `npm run task-cli -- verify-feature <feature>` when feature-level verification exists.
   - Archive only when verification passes and the user wants archive.
   - Return summary, changed files, subagents used, verification, and risks.

## Failure handling

- If RED does not fail for the expected reason, diagnose before implementing.
- If GREEN fails, diagnose before editing tests.
- If review blocks implementation, return to implementation.
- If review blocks test coverage, return to `TestDesigner`.
- If environment, secrets, external services, or ambiguous requirements block verification, stop in `blocked` and ask for the smallest missing input.

## Required output at each stop

```markdown
# AutoFlow status
## Current state
...
## Current subtask
...
## Subagents used
- ...
## Files changed
- ...
## Verification
- ...
## Next action
...
## Blockers
- ...
```
