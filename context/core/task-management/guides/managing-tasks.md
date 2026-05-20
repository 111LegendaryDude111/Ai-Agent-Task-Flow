# Managing Tasks

Common commands:

```bash
npm run task-cli -- status
npm run task-cli -- next
npm run task-cli -- start <feature> <seq> [agent_id]
npm run task-cli -- gate <feature> <seq> context_discovery "evidence"
npm run task-cli -- gate <feature> <seq> red "evidence"
npm run task-cli -- gate <feature> <seq> green "evidence"
npm run task-cli -- gate <feature> <seq> review "evidence"
npm run task-cli -- verify <feature> <seq>
npm run task-cli -- complete <feature> <seq> "summary"
```

Use `blocked`, `block`, `unblock`, `reopen`, and `cancel` for lifecycle exceptions.
