---
description: Grill a plan against CONTEXT.md/ADR docs and maintain shared domain language
agent: synapse
---

# /grill-with-docs

Stress-test this plan against repository language and decisions:

```text
$ARGUMENTS
```

Required workflow:

1. Load `skills/grill-with-docs/SKILL.md`.
2. Load `skills/grill-with-docs/CONTEXT-FORMAT.md` and `skills/grill-with-docs/ADR-FORMAT.md` when docs updates are needed.
3. Use `ContextScout` to inspect existing `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/adr/`, source, and tests.
4. Ask one question at a time; include recommended answer, evidence, and proposed doc update if relevant.
5. When a term is resolved, route the doc update to `DocWriter` instead of editing as Synapse.
6. Offer ADRs only for decisions that are hard to reverse, surprising without context, and real trade-offs.
7. Do not edit production code.

Notes:

- `/ubiquitous-language` is merged into this command.
- Create `CONTEXT.md` or `docs/adr/` lazily only after the user confirms wording or a decision.
