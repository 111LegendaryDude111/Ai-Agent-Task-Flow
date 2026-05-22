# ADR Format

ADRs live in `docs/adr/` unless a context-specific ADR directory already exists.

## File name

Use sequential numbering:

```text
docs/adr/0001-short-slug.md
docs/adr/0002-short-slug.md
```

Scan existing ADRs, find the highest number, increment by one.

## Minimal template

```md
# {Short title of the decision}

{1-3 sentences: context, decision, and why.}
```

## Optional sections

Use only when they add real value:

```md
---
status: accepted
---

# {Short title}

...

## Considered options

- ...

## Consequences

- ...
```

## When to offer an ADR

Offer an ADR only when all three are true:

1. **Hard to reverse** - changing later has meaningful cost.
2. **Surprising without context** - future readers will wonder why.
3. **Real trade-off** - there were plausible alternatives.

Skip ADRs for temporary preferences, obvious choices, or easy-to-reverse decisions.

## Good ADR topics

- Architectural shape.
- Integration style between contexts.
- Database, message bus, auth provider, or deployment choice with lock-in.
- Scope ownership between contexts.
- Deliberate deviation from the obvious path.
- Constraints not visible in code.
- Rejected alternatives worth remembering.
