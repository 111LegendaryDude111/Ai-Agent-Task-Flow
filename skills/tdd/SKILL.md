---
name: tdd
description: Test-driven development through red-green-refactor and vertical tracer bullets. Use when the user asks for TDD, red-green-refactor, test-first bugfixes/features, or small verified implementation steps.
version: 1.0.0
---

# TDD

## Purpose

Build or fix behavior with one narrow failing test, minimal implementation, green validation, review, and verified completion.

## OpenCode workflow

Run through `synapse` and the existing AutoFlow roles. This skill improves the AutoFlow TDD loop; it does not replace `TestDesigner`.

1. `ContextScout` loads relevant source, tests, config, and standards.
2. `TestDesigner` writes or identifies one focused failing behavior test.
3. `BuildAgent` confirms RED when permitted.
4. Synapse routes implementation through `context/core/rules/routing-rules.json`.
5. Matched implementation subagent makes the smallest production change.
6. `BuildAgent` confirms GREEN.
7. Refactor only after GREEN and only inside selected subtask scope; then re-run GREEN validation.
8. `CodeReviewer` reviews the selected diff.
9. `task-cli verify` and `task-cli complete` close only after evidence passes.

## Core rules

- Test behavior through public interfaces, not implementation details.
- One behavior -> one test -> minimal implementation -> green.
- No horizontal slicing: do not write all tests first and all code later.
- Never refactor while RED.
- Do not weaken tests unless they contradict explicit requirements.
- Do not add speculative features for future tests.
- If requirements are unclear, ask or stop in `blocked`.

## Planning checklist

Before RED:

- Confirm public interface or user-visible behavior.
- Confirm highest-value behavior to test first.
- Identify required context and existing test conventions.
- Pick narrowest deterministic test level: unit, integration, or E2E.
- Define exact expected RED state and command.

## Per-cycle checklist

```text
[ ] Test describes behavior, not implementation.
[ ] Test uses public interface only.
[ ] Test would survive internal refactor.
[ ] Code is minimal for this test.
[ ] Targeted command is known.
[ ] GREEN validation passes before refactor.
```

## References

- `skills/tdd/tests.md`
- `skills/tdd/mocking.md`
- `skills/tdd/deep-modules.md`
- `skills/tdd/interface-design.md`
- `skills/tdd/refactoring.md`
