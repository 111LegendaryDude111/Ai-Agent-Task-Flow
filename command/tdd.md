---
description: Run red-green-refactor through the OpenCode multi-agent flow
agent: synapse
subtask: true
---

# /tdd

Develop this behavior with TDD:

```text
$ARGUMENTS
```

Required workflow:

1. Load `skills/tdd/SKILL.md`.
2. Load `context/core/workflows/auto-flow.md` when the task needs implementation state.
3. Use `ContextScout` to read relevant source, tests, config, and standards.
4. Ask if the public interface, behavior, or acceptance criteria are unclear.
5. Delegate RED to `TestDesigner`: one focused behavior test only.
6. Confirm RED with `BuildAgent` when permitted.
7. Route implementation through `context/core/rules/routing-rules.json`.
8. Confirm GREEN with `BuildAgent`.
9. Refactor only after GREEN and only within requested scope.
10. Review with `CodeReviewer` before completion.
11. For task-flow work, record gates and run `task-cli verify` then `task-cli complete`.

Rules:

- One behavior -> one failing test -> minimal implementation -> green.
- No horizontal slicing.
- Do not weaken tests unless they contradict explicit requirements.
- Never claim completion before verification evidence succeeds.
