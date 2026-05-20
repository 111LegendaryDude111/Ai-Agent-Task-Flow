# Task CLI Commands

Read-only/status:

- `status [feature]`
- `next [feature]`
- `parallel [feature]`
- `deps <feature> <seq>`
- `blocked [feature]`

Lifecycle/state:

- `start <feature> <seq> [agent_id]`
- `gate <feature> <seq> <context_discovery|red|green|review> [evidence]`
- `transition <feature> <state> [reason]`
- `block <feature> [seq] "reason"`
- `unblock <feature> [seq]`
- `reopen <feature> <seq>`
- `cancel <feature> [seq] [reason]`

Verification/completion:

- `verify <feature> <seq>`
- `complete <feature> <seq> "summary"`
- `verify-feature <feature>`
- `archive <feature>`
- `validate [feature]`
