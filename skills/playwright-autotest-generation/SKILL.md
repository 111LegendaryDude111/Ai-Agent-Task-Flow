---
name: playwright-autotest-generation
description: Provider-neutral rules for generating or updating Playwright E2E tests from explicit flow steps
version: 1.0.0
---

# Playwright Autotest Generation

Use when creating or updating Playwright tests.

## Rules

- Source steps must be explicit: user-provided flow, existing spec, or accepted task plan.
- Keep step order stable.
- Reuse existing fixtures and page objects.
- Do not add assertions that are not required by acceptance criteria.
- Run the narrowest target command possible, usually one spec with one worker.

## Output

- Changed files
- Scenario covered
- Command run
- Result or blocker
