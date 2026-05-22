---
description: Run the deterministic test-first multi-agent AutoFlow
agent: synapse
---

# /auto-flow

Run AutoFlow for this goal:

```text
$ARGUMENTS
```

Required workflow:

1. Load `context/core/workflows/auto-flow.md`.
2. Load `context/core/workflows/auto-flow-state-machine.json`.
3. Load `skills/tdd/SKILL.md` for the implementation loop.
4. Treat the state machine as the source of allowed states and transitions.
5. Do not implement production code directly as Synapse.
6. Use `ContextScout` for context discovery.
7. Use `TaskManager` to create vertical subtasks with DoR, DoD, acceptance criteria, deliverables, suggested agent, dependencies, and `verification_spec`.
8. For each ready subtask:
   - apply `skills/tdd/SKILL.md` one-behavior tracer-bullet discipline;
   - invoke `TestDesigner` for RED before production changes;
   - confirm RED with `BuildAgent` when permitted;
   - route implementation through `context/core/rules/routing-rules.json`;
   - confirm GREEN with `BuildAgent`;
   - refactor only after GREEN and within selected subtask scope, then re-run GREEN validation;
   - invoke `TestDiagnostician` before changing tests when validation fails;
   - invoke `CodeReviewer` before completion;
   - run `task-cli verify <feature> <seq>`;
   - run `task-cli complete <feature> <seq> "summary"`.
9. Continue until the goal is done or the state machine reaches `blocked`.
10. Never claim completion before verification succeeds.

Safe read-only bash commands from the allowlist (`pwd`, `ls *`, `rg *`, `grep *`, `git status*`, `git diff*`) may run without approval. Stop and ask for approval before other `bash`, delete operations, dependency installs, network operations, destructive git operations, edits outside the target repository, or changes to secrets/env files. Edits and writes inside the target repository are allowed for matched subagents after task approval.
