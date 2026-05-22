---
name: grill-with-docs
description: Grill a plan against repository language and documented decisions, then update CONTEXT.md or ADRs as decisions crystallize. Use when the user needs ubiquitous language, domain terminology, CONTEXT.md, ADRs, or plan stress-testing with docs.
version: 1.0.0
---

# Grill With Docs

`/ubiquitous-language` is merged into this skill. Use this for shared domain vocabulary between user, code, docs, and agents.

## Purpose

Run a grilling session that keeps project language consistent. Challenge fuzzy terms, compare the user's claims with code/docs, and capture durable terms or decisions only when they become clear.

## OpenCode workflow

- Run through `synapse`; Synapse coordinates but does not write files directly.
- Use `ContextScout` for read-only code/doc discovery.
- Use `DocWriter` for edits to `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/*.md` after the user confirms the wording or decision.
- Do not edit production code during grilling.
- Ask one question at a time and wait for feedback.
- If a question can be answered by reading repo files, read first and ask only the unresolved part.

## Documents to inspect

Prefer this order:

1. `CONTEXT-MAP.md` if present.
2. Root `CONTEXT.md` if present.
3. Context-local `CONTEXT.md` files referenced by the map.
4. `docs/adr/*.md` and context-local `docs/adr/*.md`.
5. Relevant source and tests.

Create docs lazily:

- Create `CONTEXT.md` only when the first domain term is resolved.
- Create `docs/adr/` only when the first ADR is justified.

## Grilling rules

- Call out conflicting terminology immediately.
- Turn vague terms into one canonical term plus aliases to avoid.
- Stress-test domain relationships with concrete scenarios.
- Cross-check user claims against code when possible.
- Keep `CONTEXT.md` about domain language, not implementation details.
- Offer an ADR only when the decision is hard to reverse, surprising without context, and a real trade-off.

## Context update trigger

Update `CONTEXT.md` when:

- a term is resolved;
- an overloaded term gets a canonical meaning;
- a relationship between domain terms becomes clear;
- an ambiguity should not be rediscovered later.

Use `skills/grill-with-docs/CONTEXT-FORMAT.md`.

## ADR trigger

Offer an ADR when all are true:

1. Hard to reverse.
2. Surprising without context.
3. Result of a real trade-off.

Use `skills/grill-with-docs/ADR-FORMAT.md`.

## Output during session

```markdown
## Question N
...

## Recommended answer
...

## Evidence from docs/code
- ...

## Proposed doc update, if confirmed
- `CONTEXT.md`: ...
- `docs/adr/NNNN-slug.md`: ...
```

## Output when finished

```markdown
## Shared language
- ...

## Decisions made
- ...

## Docs updated
- ...

## Open questions
- ...
```
