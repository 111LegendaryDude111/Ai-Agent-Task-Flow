---
name: improve-codebase-architecture
description: Find deepening opportunities, shallow modules, weak seams, and architecture refactors informed by CONTEXT.md and ADRs. Use when the user asks to improve architecture, make code more testable, reduce coupling, or find deep modules.
version: 1.0.0
---

# Improve Codebase Architecture

## Purpose

Find architecture changes that improve locality, leverage, testability, and AI navigability. Start with analysis and candidate selection, not implementation.

## OpenCode workflow

- Run through `synapse`.
- Use `ContextScout` for read-only exploration.
- Load `CONTEXT.md`, `CONTEXT-MAP.md`, and `docs/adr/` if present.
- Use vocabulary from `skills/improve-codebase-architecture/LANGUAGE.md`.
- Present deepening candidates before proposing implementation details.
- If the user selects a candidate, switch to a grilling loop and optionally `/grill-with-docs` for term/ADR updates.
- If implementation starts, route through `/tdd` or `/auto-flow`.

## Analysis focus

Look for:

- shallow modules: interface nearly as complex as implementation;
- pass-through modules that fail the deletion test;
- duplicated caller knowledge;
- seams with only one adapter and no real variation;
- tests coupled to implementation details;
- domain concepts spread across many files;
- modules where one behavior requires bouncing through many small files.

## Candidate output

For each candidate, report:

```markdown
## Candidate N: {name}

**Files**
- ...

**Problem**
...

**Solution direction**
...

**Benefits**
- Locality: ...
- Leverage: ...
- Test surface: ...

**ADR conflict, if any**
...
```

Then ask: `Which candidate should we explore?`

## Rules

- Do not rewrite architecture during discovery.
- Do not propose interfaces until the user picks a candidate.
- Do not relitigate ADRs unless real friction justifies reopening one.
- Use project domain language from `CONTEXT.md` when naming candidates.
- If docs are missing, proceed silently; create docs only when `/grill-with-docs` resolves a term or decision.

## References

- `skills/improve-codebase-architecture/LANGUAGE.md`
- `skills/improve-codebase-architecture/DEEPENING.md`
- `skills/improve-codebase-architecture/INTERFACE-DESIGN.md`
