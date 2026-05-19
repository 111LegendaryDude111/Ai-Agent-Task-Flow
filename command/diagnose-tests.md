---
description: Diagnose failing tests and recommend the smallest safe fix
agent: test-diagnostician
subtask: true
---

# /diagnose-tests

Analyze failing test output and recommend the smallest safe fix.

Input:

```text
$ARGUMENTS
```

Constraints:

- Diagnose only.
- Do not edit production or test code.
- Do not weaken assertions unless they contradict explicit requirements.
- Classify the failure source and provide evidence.
