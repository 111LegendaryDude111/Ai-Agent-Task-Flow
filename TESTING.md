# Testing

Run the full MVP validation suite from the repository root:

```bash
npm run validate
```

This expands to:

- `npm run scan:secrets`
- `npm run validate:routing`
- `npm run validate:memory`
- `npm run lint:json`
- `npm run coverage:routing`
- `npm run test:task-cli`
- `npm run validate:audit`

Expected result:

- no secrets or personal local paths;
- routing schema valid and scenarios pass;
- routing coverage is 100%;
- memory/source policy scenarios pass;
- context JSON files lint cleanly;
- Task CLI E2E passes without global `ts-node`;
- audit events are valid when present.

Prerequisites:

- Node.js 22+ with `npm ci` completed;
- Python 3.11+;
- Python dependencies from `scripts/requirements.txt`.
