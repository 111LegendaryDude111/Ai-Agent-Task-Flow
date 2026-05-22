# Interface Design

Use this after the user selects an architecture candidate.

## Process

1. Frame constraints:
   - what callers need;
   - what behavior sits behind the seam;
   - dependency category from `DEEPENING.md`;
   - invariants, ordering, error modes, config.
2. Design at least two different interfaces before choosing.
3. Compare by depth, locality, seam placement, and test surface.
4. Recommend one design or a hybrid.

## Design angles

- Minimal interface: 1-3 entry points, maximum leverage.
- Common-case interface: make the usual caller trivial.
- Flexible interface: supports extension when variation is real.
- Ports/adapters interface: use only when there are real adapters.

## Output

```markdown
## Interface option A
- Interface:
- Usage example:
- Hidden implementation:
- Dependency/adapters:
- Trade-offs:

## Recommendation
...
```

Use domain terms from `CONTEXT.md` and architecture terms from `LANGUAGE.md`.
