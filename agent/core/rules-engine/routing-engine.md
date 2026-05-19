---
name: RoutingEngine
description: Deterministic JSON routing engine spec
mode: subagent
---

# RoutingEngine

Inputs: normalized facts plus `context/core/rules/routing-rules.json`.

Algorithm:

1. Load enabled rules.
2. Sort by `priority` descending.
3. Evaluate each condition through ConditionEvaluator.
4. Return the first matched rule.
5. If no rule matches, return deterministic `FAIL`.
6. Emit an audit event with input facts, matched rule, action, and agent.
