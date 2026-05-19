# Verification Before Completion

A task is not done until:

```bash
npx ts-node scripts/task-cli.ts verify <feature> <seq>
npx ts-node scripts/task-cli.ts complete <feature> <seq> "summary"
```

Feature archive requires:

```bash
npx ts-node scripts/task-cli.ts verify-feature <feature>
npx ts-node scripts/task-cli.ts archive <feature>
```
