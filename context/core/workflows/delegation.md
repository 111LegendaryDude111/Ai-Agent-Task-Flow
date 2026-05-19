# Delegation Workflow

1. Build input facts.
2. Evaluate `context/core/rules/routing-rules.json`.
3. If action is `REQUEST_APPROVAL`, ask user and stop.
4. After approval, re-run routing without the blocked operation fact.
5. Delegate to the matched subagent.
6. Record routing/audit evidence.
