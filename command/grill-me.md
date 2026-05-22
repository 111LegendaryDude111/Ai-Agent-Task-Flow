---
description: Ask focused questions until the task or design is fully understood
agent: synapse
---

# /grill-me

Stress-test this plan or task:

```text
$ARGUMENTS
```

Required workflow:

1. Load `skills/grill-me/SKILL.md`.
2. Stay in interview mode; do not implement or edit files.
3. Ask one question at a time and wait for the user.
4. For each question, include a recommended answer and why it matters.
5. If a question can be answered from repo files, delegate read-only discovery to `ContextScout` instead of asking.
6. When shared understanding is reached, summarize acceptance criteria, open decisions, and recommended next command.

Safety:

- Safe read-only bash allowlist only: `pwd`, `ls *`, `rg *`, `grep *`, `git status*`, `git diff*`.
- No writes, dependency installs, network calls, destructive git, or secrets/env changes.
