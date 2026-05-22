# OpenCode skill commands

Repository-local skills live under `skills/`. Slash commands live under `command/` and run through `synapse` unless noted.

## Commands

| Command | Purpose |
| --- | --- |
| `/grill-me` | Ask one question at a time until task/design understanding is shared. |
| `/grill-with-docs` | Grill a plan against `CONTEXT.md`, `CONTEXT-MAP.md`, ADRs, source, and tests; update docs through `DocWriter` after confirmation. |
| `/ubiquitous-language` | Deprecated alias for `/grill-with-docs`; shared vocabulary now lives there. |
| `/tdd` | Run red-green-refactor through `TestDesigner`, `BuildAgent`, routed implementation, optional scoped refactor, `CodeReviewer`, and task verification. |
| `/improve-codebase-architecture` | Find deepening opportunities, shallow modules, weak seams, and testability improvements. |

## OpenCode adaptation rules

- `/auto-flow` also loads `skills/tdd/SKILL.md` for implementation subtasks; this improves the existing `TestDesigner` loop rather than replacing it.
- `synapse` coordinates; it does not write production code directly.
- Code/docs writes happen through matched subagents after task approval.
- Use `ContextScout` for read-only discovery.
- Use `DocWriter` for confirmed `CONTEXT.md` and ADR changes.
- Use `TestDesigner`, `BuildAgent`, routed implementation subagent, and `CodeReviewer` for TDD.
- Safe read-only bash allowlist remains `pwd`, `ls *`, `rg *`, `grep *`, `git status*`, `git diff*`.
- Dangerous shell, delete, dependency install, network, destructive git, outside-repo, and secrets/env operations require approval.

## Related files

- `command/grill-me.md`
- `command/grill-with-docs.md`
- `command/ubiquitous-language.md`
- `command/tdd.md`
- `command/improve-codebase-architecture.md`
- `skills/grill-me/SKILL.md`
- `skills/grill-with-docs/SKILL.md`
- `skills/tdd/SKILL.md`
- `skills/improve-codebase-architecture/SKILL.md`
