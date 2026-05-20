---
name: ConditionEvaluator
description: Evaluates routing condition DSL against input facts
mode: subagent
---

# ConditionEvaluator

Supported boolean nodes: `AND`, `OR`, `NOT`, `XOR`.

Supported atomic operators:

- equality/membership: `eq`, `neq`, `in`, `not_in`
- string: `contains`, `not_contains`, `starts_with`, `ends_with`, `matches_regex`
- numeric: `gt`, `gte`, `lt`, `lte`
- existence/boolean: `exists`, `not_exists`, `is_true`, `is_false`

Matching is case-sensitive unless a rule explicitly normalizes facts or uses a regex flag. Missing facts evaluate to `false` except explicit `exists` / `not_exists` checks.
