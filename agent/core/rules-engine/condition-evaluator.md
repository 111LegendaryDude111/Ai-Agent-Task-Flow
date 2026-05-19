---
name: ConditionEvaluator
description: Evaluates routing condition DSL against input facts
mode: subagent
---

# ConditionEvaluator

Supported boolean nodes: `AND`, `OR`, `NOT`, `XOR`.

Supported atomic operators: `eq`, `neq`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `ends_with`, `matches_regex`, `exists`.

Missing facts evaluate to `false` except explicit existence checks.
