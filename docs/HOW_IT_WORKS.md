# Как работает Agentic Flow Playbook

Agentic Flow Playbook — это минимальная платформа для управляемой работы AI-агентов в OpenCode. Главная идея: пользовательская задача не попадает сразу в «свободный» coding-agent, а проходит через контекст, правила маршрутизации, approval gates и проверку результата.

## Короткая схема

```text
User task
  ↓
Synapse Orchestrator
  ↓
Context discovery
  ↓
Rule-based routing
  ↓
Matched subagent
  ↓
Review / build / tests
  ↓
verify → complete
```

## 1. Пользователь ставит задачу

Пользователь описывает работу обычным языком, например:

```text
Добавь unit-тест для нового поведения.
```

Задача попадает в основного агента `synapse`, который задан в `opencode.jsonc` как `default_agent`.

## 2. Synapse классифицирует задачу

`agent/core/sfa-synapse.md` описывает роль Synapse:

- определить тип задачи: документация, тесты, ML, frontend, backend, review, build validation и т.д.;
- понять, нужен ли read-only анализ или изменение файлов;
- собрать факты для routing rules;
- не писать production-код напрямую;
- делегировать выполнение matched subagent.

Synapse — это orchestrator, а не универсальный исполнитель.

## 3. Загружается контекст

Перед изменениями система использует локальные источники истины:

| Тип вопроса | Основной источник |
| --- | --- |
| Текущее состояние кода, конфиги, версии | repo / filesystem |
| Стандарты и workflow | `context/core/**` |
| Durable project knowledge | Memory Service, если доступен |
| Внутренняя документация | internal docs connector / scout |
| Внешние библиотеки | external docs / web |

Политика выбора источника описана в `context/core/config/memory-routing-policy.json`.

## 4. Routing rules выбирают исполнителя

Маршрутизация задается в `context/core/rules/routing-rules.json`. Это JSON-правила с приоритетами, а не свободное решение LLM.

Основные правила текущего MVP:

| Ситуация | Действие |
| --- | --- |
| `write`/`edit` внутри проекта | выполнять автономно через matched subagent |
| safe read-only bash: `pwd`, `ls *`, `find *`, `rg *`, `grep *`, `git status*`, `git diff*` | direct execution |
| other `bash`, delete, dependency install, network, destructive git, secrets/env | запросить approval |
| failing test output | `TestDiagnostician` |
| Playwright / E2E | `PlaywrightTestGenerator` |
| test-first / TDD | `TestDesigner` |
| ML / RAG / model evaluation | `MLDeveloper` |
| Java/Kotlin/Gradle backend | `JavaDeveloper` |
| JS/TS/React/CSS | `FrontendDeveloper` |
| complex implementation/refactoring | `TaskManager` |
| docs / README | `DocWriter` |
| review / audit | `CodeReviewer` |
| build / test validation | `BuildAgent` |
| generic implementation | `CoderAgent` |
| context discovery | `ContextScout` |
| read-only операции | direct execution |

Если правило не найдено, задача не должна молча выполняться как fallback.

## 5. Approval gate защищает изменения

Обычные `write`/`edit` внутри целевого репозитория разрешены для автономной работы matched subagent. Это уменьшает количество ручных подтверждений на каждом файле.

Подтверждение всё ещё требуется для операций с повышенным риском:

- `bash` вне safe read-only allowlist;
- удаление файлов;
- dependency installs;
- network operations;
- destructive git operations;
- изменения вне целевого репозитория;
- изменения secrets/env файлов.

Approval снимает только safety gate. После подтверждения Synapse всё равно должен повторить routing и делегировать работу подходящему subagent.

## 6. Subagent выполняет узкую часть работы

Текущий набор subagents задан в `opencode.jsonc` и лежит в `agent/**`:

- `ContextScout` — read-only поиск контекста;
- `TaskManager` — декомпозиция сложных задач;
- `DocWriter` — документация;
- `TestDesigner` — тесты до реализации;
- `TestDiagnostician` — диагностика падающих тестов;
- `PlaywrightTestGenerator` — E2E/Playwright;
- `BuildAgent` — build/test/type-check validation;
- `CodeReviewer` — review и risk assessment;
- `CoderAgent` — generic implementation;
- `FrontendDeveloper` — JS/TS/React/CSS;
- `JavaDeveloper` — Java/Kotlin backend;
- `MLDeveloper` — ML/RAG/model evaluation;
- `RoutingEngine`, `ConditionEvaluator`, `AuditLogger` — спецификации rule engine и audit events.

## 7. Для feature/bugfix используется test-first

Для реализации feature/bugfix Synapse должен сначала обеспечить покрытие поведения тестом через `TestDesigner` или подтвердить, что релевантный failing test уже есть.

После реализации, если тесты падают, диагностика идет через `TestDiagnostician`, а не через немедленное ослабление тестов.

## 8. Completion gate

Нельзя заявлять «готово», пока не пройдена проверка. Для task-flow используется:

```bash
npx ts-node scripts/task-cli.ts verify <feature> <seq>
npx ts-node scripts/task-cli.ts complete <feature> <seq> "summary"
```

Для feature-level завершения:

```bash
npx ts-node scripts/task-cli.ts verify-feature <feature>
npx ts-node scripts/task-cli.ts archive <feature>
```

Базовая проверка самого playbook описана в `TESTING.md`.

## 9. Audit trail

Контракт audit events описан в `agent/core/rules-engine/audit-logger.md`.

Ожидаемый формат — JSONL в `.tmp/audit/routing/{date}/{session}.jsonl` с полями:

- `timestamp`
- `session_id`
- `event_type`
- `input_facts`
- `matched_rule`
- `action`
- `agent`
- `result`

`.tmp/` игнорируется Git-ом.

## 10. Проверки MVP

Из корня репозитория:

```bash
python3 scripts/validate_routing_rules.py --context-root context/core
python3 scripts/validate_memory_routing_policy.py --config-root context/core/config
python3 scripts/lint_json.py --context-root context/core
python3 scripts/generate_coverage_report.py --context-root context/core
python3 scripts/run_task_cli_e2e.py
```

Ожидаемый результат:

- routing schema valid;
- все routing scenarios проходят;
- routing coverage — 100%;
- memory/source policy scenarios проходят;
- task CLI E2E проходит.

## Главная идея

Система превращает vibe coding в повторяемый pipeline:

```text
контекст → routing → delegated execution → verification → audit
```

LLM остается полезным исполнителем и аналитиком, но работает внутри правил, локального контекста и проверяемого процесса.
