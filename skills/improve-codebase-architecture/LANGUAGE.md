# Architecture Language

Use these terms exactly in architecture suggestions.

## Terms

**Module**: anything with an interface and an implementation: function, class, package, or vertical slice. Avoid "component" and "service" unless the codebase uses those as domain terms.

**Interface**: everything a caller must know to use a module correctly: types, invariants, ordering constraints, error modes, config, performance. Not only a type signature.

**Implementation**: what is inside a module.

**Depth**: leverage at the interface. A module is **deep** when a lot of useful behavior sits behind a small interface. A module is **shallow** when the interface is nearly as complex as the implementation.

**Seam**: a place where behavior can change without editing that place. Avoid "boundary" unless referring to a domain boundary already named in docs.

**Adapter**: a concrete thing that satisfies an interface at a seam.

**Leverage**: what callers get from depth: more capability per unit of interface knowledge.

**Locality**: what maintainers get from depth: change, bugs, and knowledge concentrated in one place.

## Principles

- Depth is a property of the interface, not implementation size.
- The deletion test: if deleting the module removes complexity, it was pass-through; if complexity spreads to callers, it was useful.
- The interface is the test surface.
- One adapter means a hypothetical seam. Two adapters means a real seam.
- Prefer project domain terms from `CONTEXT.md` when naming modules.
