# Refactoring After GREEN

Refactor only after targeted tests pass.

Look for:

- duplication;
- long methods;
- shallow modules;
- feature envy;
- primitive obsession;
- awkward names revealed by the new behavior;
- code that is hard to test through its current interface.

Rules:

- Keep tests on public behavior.
- Run targeted tests after each refactor step.
- Do not expand scope into unrelated cleanup.
- If a refactor changes design meaningfully, consider `/grill-with-docs` for language or ADR updates.
