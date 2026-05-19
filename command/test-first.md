---
description: Create focused failing tests before implementation
agent: test-designer
subtask: true
---

# /test-first

Analyze the requested task and create failing tests before production implementation.

Task:

```text
$ARGUMENTS
```

Constraints:

- Write tests only.
- Do not implement production code.
- Load existing test conventions before editing.
- Prefer unit tests first.
- Add integration or E2E tests only when the behavior crosses boundaries or changes a user-visible flow.
- Prefer one focused failing test per behavior; for larger work, start with one tracer bullet.
- Return the exact targeted test command.
