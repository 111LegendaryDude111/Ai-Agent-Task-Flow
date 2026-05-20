# Verification Before Completion

A task-flow subtask is not done until both commands succeed:

```bash
npm run task-cli -- verify <feature> <seq>
npm run task-cli -- complete <feature> <seq> "summary"
```

Feature archive requires:

```bash
npm run task-cli -- verify-feature <feature>
npm run task-cli -- archive <feature>
```
