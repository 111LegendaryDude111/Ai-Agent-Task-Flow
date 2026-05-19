---
description: Review ML implementation for leakage, validation correctness, metrics, and production readiness
agent: ml-developer
subtask: true
---

# /ml-review

Review the current ML-related changes.

Focus on:

- target definition;
- data leakage;
- validation split;
- metric correctness;
- preprocessing order;
- train/inference skew;
- threshold policy;
- reproducibility;
- test coverage;
- production risks.

Do not rewrite code unless explicitly asked.

Return actionable findings with severity: `BLOCKER`, `MAJOR`, `MINOR`, or `NIT`.

Input:

```text
$ARGUMENTS
```
