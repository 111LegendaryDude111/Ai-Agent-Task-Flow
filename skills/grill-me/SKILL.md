---
name: grill-me
description: Interview the user one question at a time until the plan and constraints are shared. Use when the user asks to stress-test a plan, says "grill me", or needs requirements clarified before implementation.
version: 1.0.0
---

# Grill Me

## Purpose

Stress-test a plan before implementation. Ask focused questions until the task, constraints, trade-offs, and success criteria are clear enough to route or build.

## OpenCode workflow

- Run through `synapse`; do not edit files directly.
- If a question can be answered from the repository, use `ContextScout` first instead of asking the user.
- Use safe read-only discovery only: read/list/glob/grep and allowed shell commands.
- Ask one question at a time and wait for the answer.
- For each question, include your recommended answer and why the answer matters.
- Stop when shared understanding is good enough to produce acceptance criteria, a task plan, or a blocker.

## Question pattern

```markdown
## Question N
...

## My recommended answer
...

## Why this matters
...

## If you choose this, next decision is
...
```

## Rules

- Do not ask broad questionnaires.
- Do not continue with hidden assumptions.
- Do not implement during grilling.
- If requirements conflict, name the conflict and ask the smallest resolving question.
- If the result should become durable project language or an ADR, switch to `/grill-with-docs`.

## Output when finished

```markdown
## Shared understanding
- ...

## Acceptance criteria
- ...

## Open decisions
- ...

## Recommended next command
- `/tdd ...`, `/auto-flow ...`, or `/grill-with-docs ...`
```
