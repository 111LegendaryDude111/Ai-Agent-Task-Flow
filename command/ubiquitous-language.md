---
description: Deprecated alias for /grill-with-docs shared domain language workflow
agent: synapse
---

# /ubiquitous-language

Deprecated alias. Use `/grill-with-docs` for shared vocabulary, `CONTEXT.md`, and ADR-backed decisions.

Input:

```text
$ARGUMENTS
```

Required workflow:

1. Load `skills/grill-with-docs/SKILL.md`.
2. Treat this exactly as `/grill-with-docs`.
3. Focus on canonical domain terms, aliases to avoid, relationships, and flagged ambiguities.
4. Route confirmed `CONTEXT.md` or ADR edits to `DocWriter`; Synapse must not write directly.
