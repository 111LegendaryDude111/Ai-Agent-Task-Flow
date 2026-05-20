# Developer Extension Guide

Use this guide when adding a new subagent, routing rule, or scenario.

## Checklist

1. Name the domain and owner subagent.
2. Choose a permission profile:
   - read-only analysis: `edit/write: deny`;
   - implementation: `edit/write: allow` inside target repo only;
   - never broaden shell beyond safe read-only allowlist without approval gate.
3. Add or update prompt under `agent/subagents/**` using `instructions/subagent-template.md`.
4. Add routing rule in `context/core/rules/routing-rules.json`.
5. Add scenarios in `context/core/rules/routing-rules.scenarios.json` before enabling broad behavior.
6. Run:

   ```bash
   npm run validate:routing
   npm run coverage:routing
   ```

7. Update docs if runtime behavior changes.

## Naming

- Agent names: `PascalCase` for runtime subagents.
- Rule IDs: kebab-case, e.g. `python-data-routing`.
- Scenario IDs: kebab-case and stable.
- Prompt files: kebab-case under the matching domain directory.

## Priority guidance

| Priority band | Use |
| --- | --- |
| 150-200 | safety and highly specific specialists |
| 90-149 | main implementation routes |
| 50-89 | generic docs/review/build/coding |
| 1-49 | direct/read-only helpers |

Higher priority wins. Add conflict scenarios when a new rule can overlap an existing one.

## Example: add SQL migration route

1. Create prompt: `agent/subagents/development/sql-migration-developer.md`.
2. Add config entry to `opencode.jsonc.example` and local `opencode.jsonc` with implementation permissions.
3. Add rule:

   ```json
   {
     "id": "sql-migration-routing",
     "priority": 125,
     "condition": {
       "type": "file_extension",
       "operator": "in",
       "value": [".sql"]
     },
     "action": { "type": "DELEGATE", "agent": "SqlMigrationDeveloper" }
   }
   ```

4. Add positive, negative, and conflict scenarios.
5. Run `npm run validate`.

## Skill extensions

For reusable skills, start from `instructions/skill-template.md`. Keep skill instructions narrow, with explicit triggers and verification expectations.

## Regression checklist

- Existing routing coverage remains 100%.
- No new rule bypasses approval-gate.
- Prompt has required context, output contract, blocker behavior, and verification contract.
- README/docs mention the new runtime only after it is implemented.
