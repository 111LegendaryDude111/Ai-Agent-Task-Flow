---
description: Implement an ML task using the MLDeveloper subagent
agent: ml-developer
subtask: true
---

# /ml-implement

Implement this ML task with proper validation, metrics, leakage checks, and tests.

Task:

```text
$ARGUMENTS
```

Rules:

- First inspect the existing ML/data pipeline.
- Do not start with model complexity.
- Define task type, target, validation strategy, metrics, leakage risks, and baseline before coding.
- Check for data leakage blockers.
- Prefer a minimal baseline or minimal production change.
- Invoke `TestDesigner` before production changes unless relevant failing coverage already exists.
- Add or update deterministic tests.
- Return commands for tests, training, and evaluation when applicable.
