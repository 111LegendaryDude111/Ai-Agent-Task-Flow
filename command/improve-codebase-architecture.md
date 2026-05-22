---
description: Find deep modules and architecture improvement candidates before refactoring
agent: synapse
---

# /improve-codebase-architecture

Analyze architecture improvement opportunities for:

```text
$ARGUMENTS
```

Required workflow:

1. Load `skills/improve-codebase-architecture/SKILL.md`.
2. Load supporting references:
   - `skills/improve-codebase-architecture/LANGUAGE.md`
   - `skills/improve-codebase-architecture/DEEPENING.md`
   - `skills/improve-codebase-architecture/INTERFACE-DESIGN.md` when the user picks a candidate.
3. Use `ContextScout` for read-only exploration of `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/adr/`, source, and tests.
4. Use architecture terms exactly: Module, Interface, Implementation, Depth, Seam, Adapter, Leverage, Locality.
5. Present numbered deepening candidates with files, problem, solution direction, benefits, and ADR conflicts.
6. Do not implement or refactor until the user selects a candidate.
7. After selection, use a grilling loop; use `/grill-with-docs` for term/ADR updates if needed.
8. If implementation starts, route through `/tdd` or `/auto-flow`.

Safety:

- Analysis is read-only by default.
- No production edits, dependency installs, destructive git, or secrets/env changes.
