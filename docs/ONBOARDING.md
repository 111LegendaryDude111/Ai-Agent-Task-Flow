# Internal User Onboarding

## Local setup

1. Install prerequisites: Node.js 22+, Python 3.11+.
2. Install dependencies:

   ```bash
   npm ci
   python -m pip install -r scripts/requirements.txt
   ```

3. Create local config:

   ```bash
   cp opencode.jsonc.example opencode.jsonc
   export OPENROUTER_API_KEY="..."
   ```

4. Validate:

   ```bash
   npm run validate
   ```

Ollama fallback: install Ollama, pull `qwen3:4b`, then set `model: local-ollama/qwen3:4b` in local config. MCP servers are opt-in and disabled by default.

## Scenario 1: docs task

Prompt:

```text
Обнови README под текущий runtime и проверь документацию.
```

Expected routing: `documentation-routing` → `DocWriter`.

Expected output: changed docs, verification command, risks.

Troubleshooting: if runtime facts are unclear, Synapse should delegate context discovery first or stop in `blocked`.

## Scenario 2: bugfix

Prompt:

```text
Исправь баг в обработке пустого input, сначала тест.
```

Expected routing: `TestDesigner` for RED, then implementation subagent by stack, then `BuildAgent` and `CodeReviewer`.

Expected output: failing test evidence, implementation diff, green validation, review summary.

Troubleshooting: if test output is unrelated/flaky, route to `TestDiagnostician`.

## Scenario 3: test-first change

Prompt:

```text
Добавь поведение через TDD: сначала failing unit test, потом минимальная реализация.
```

Expected routing: `test-first-design-routing` → `TestDesigner`, then matched implementer.

Expected output: RED command, GREEN command, `task-cli verify` / `complete` evidence for task-flow.

Troubleshooting: if no deterministic test command exists, stop in `blocked` and ask for scope or prerequisites.

## Scenario 4: ML review

Prompt:

```text
Проверь ML pipeline на leakage, split strategy и метрики.
```

Expected routing: `ml-development-routing` → `MLDeveloper` or `code-review-routing` → `CodeReviewer` when explicitly review-only.

Expected output: leakage findings, validation risks, metrics/split recommendations.

Troubleshooting: missing data semantics or target definition is a blocker.

## Scenario 5: validation

Prompt:

```text
Запусти базовую проверку playbook и объясни failures.
```

Expected routing: `build-validation-routing` → `BuildAgent`.

Expected output: `npm run validate`, exit code, failure summary, next diagnostic route.

Troubleshooting: missing Node/Python deps is `blocked` until install approval.

## When status is `blocked`

Do not continue by guessing. Report:

- blocker evidence;
- smallest missing input/permission;
- exact next command or decision needed;
- whether external provider/data risk requires approval.
