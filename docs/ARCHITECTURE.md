# Архитектура Agentic Flow Playbook

## Назначение

Agentic Flow Playbook — это конфигурационный слой для OpenCode, который превращает работу AI-агента в управляемый pipeline:

```text
context-first → deterministic routing → delegated execution → verification → audit
```

Проект не является бизнес-приложением. Это playbook: набор инструкций, правил, subagents, skills, workflow-документов и validation scripts.

## High-level схема

```text
┌─────────────────────────────────────────────────────────────┐
│                         User Task                           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Synapse Orchestrator                       │
│  classify → discover context → plan → route → delegate      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Rule-Based Routing Engine                   │
│  context/core/rules/routing-rules.json                      │
│  priority rules → matched action / matched subagent         │
└──────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│ ContextScout  │      │ TaskManager   │      │ Code/Doc/Test │
│ read context  │      │ split tasks   │      │ subagents     │
└───────────────┘      └───────────────┘      └───────┬───────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────┐
│              BuildAgent / CodeReviewer / Tests             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Completion Gate                          │
│            task-cli verify → task-cli complete              │
└─────────────────────────────────────────────────────────────┘
```

## Runtime configuration

Основной runtime-файл:

```text
opencode.jsonc
```

Ключевые настройки:

- `model`: `openrouter/deepseek/deepseek-v4-flash`;
- `default_agent`: `synapse`;
- primary provider: `openrouter` через `https://openrouter.ai/api/v1`;
- fallback provider: `local-ollama` через `http://127.0.0.1:11434/v1`;
- prompt-файлы: `agent/**`;
- permissions: read/list/grep/glob, edit/write внутри проекта и safe read-only bash разрешены; остальные shell/delete и опасные операции требуют approval.

Переносимый пример конфигурации лежит в:

```text
opencode.jsonc.example
```

## Основные компоненты

### 1. Orchestrator

```text
agent/core/sfa-synapse.md
```

Synapse отвечает за orchestration:

- классифицирует задачу;
- загружает контекст;
- выбирает routing facts;
- запускает rule-based routing;
- делегирует matched subagent;
- разрешает edit/write внутри проекта для matched subagent;
- не пишет production-код напрямую;
- завершает работу только после verification gate.

### 2. Routing rules

```text
context/core/rules/routing-rules.json
```

Правила имеют приоритеты. Высокоприоритетные safety/specialist правила срабатывают раньше generic fallback.

Priority bands:

| Band | Priority | Назначение |
| --- | ---: | --- |
| critical | 150-200 | approval и high-confidence specialists |
| high | 90-149 | основные implementation маршруты |
| normal | 50-89 | docs/review/build/generic coding |
| low | 1-49 | read-only/direct/system helpers |

Если задача не матчится ни одним правилом, ожидаемое поведение — fail, а не молчаливое выполнение.

### 3. Source routing policy

```text
context/core/config/memory-routing-policy.json
```

Политика определяет, какой источник использовать для разных типов вопросов:

| Query type | Primary source |
| --- | --- |
| `project_context_lookup` | Memory Service |
| `implementation_fact` | repo / filesystem |
| `standards_workflow_lookup` | `context/core/**` |
| `internal_long_form_documentation` | internal docs connector |
| `external_library_lookup` | external docs / web |
| `durable_writeback` | Memory Service по schema |

Memory не заменяет repo для точных текущих фактов кода.

### 4. Subagents

Текущий runtime-набор subagents задан в `opencode.jsonc`:

| Agent | Роль |
| --- | --- |
| `ContextScout` | read-only context discovery |
| `TaskManager` | decomposition into verifiable subtasks |
| `DocWriter` | documentation generation and maintenance |
| `TestDesigner` | focused failing tests before implementation |
| `TestDiagnostician` | diagnosis of failing tests |
| `PlaywrightTestGenerator` | Playwright/E2E tests |
| `BuildAgent` | build/type-check/test validation |
| `CodeReviewer` | review and risk assessment |
| `CoderAgent` | generic implementation |
| `FrontendDeveloper` | JS/TS/React/CSS implementation |
| `JavaDeveloper` | Java/Kotlin backend implementation |
| `MLDeveloper` | ML/RAG/model evaluation work |
| `RoutingEngine` | routing engine specification |
| `ConditionEvaluator` | condition DSL specification |
| `AuditLogger` | audit event contract |

### 5. Task management

Task-flow artifacts живут в `.tmp/tasks/**` и не попадают в Git.

Основные команды:

```bash
npx ts-node scripts/task-cli.ts verify <feature> <seq>
npx ts-node scripts/task-cli.ts complete <feature> <seq> "summary"
npx ts-node scripts/task-cli.ts verify-feature <feature>
npx ts-node scripts/task-cli.ts archive <feature>
```

E2E fixture для task lifecycle:

```text
fixtures/task-management/task-cli-e2e/
```

### 6. Audit

Audit contract:

```text
agent/core/rules-engine/audit-logger.md
```

Ожидаемое место JSONL events:

```text
.tmp/audit/routing/{date}/{session}.jsonl
```

Минимальные поля события:

- `timestamp`
- `session_id`
- `event_type`
- `input_facts`
- `matched_rule`
- `action`
- `agent`
- `result`

## Directory layout

```text
agent/                  OpenCode agent and subagent prompts
command/                slash-command playbooks
context/                routing rules, standards, workflows, source policy
docs/                   project documentation
fixtures/               test fixtures
instructions/           templates for skills/subagents
scripts/                validators, reports, task CLI helpers
skills/                 reusable skill instructions
verification/           verification notes and evidence conventions
opencode.jsonc          active local OpenCode config
opencode.jsonc.example  portable example config
```

## Safety model

1. `write`/`edit` inside the target repository are allowed for matched subagents after task approval.
2. Safe read-only bash allowlist (`pwd`, `ls *`, `find *`, `rg *`, `grep *`, `git status*`, `git diff*`) may execute without approval.
3. Approval is still required for other `bash`, delete operations, dependency installs, network operations, destructive git operations, edits outside the target repository, and secrets/env changes.
4. Approval does not authorize Synapse to bypass routing.
5. Production implementation goes through matched subagent.
6. Feature/bugfix work should be test-first.
7. Failing tests are diagnosed before tests are changed.
8. Secrets must not be written to logs, memory, docs, task files or verification artifacts.

## Verification suite

Базовая проверка playbook:

```bash
python3 scripts/validate_routing_rules.py --context-root context/core
python3 scripts/validate_memory_routing_policy.py --config-root context/core/config
python3 scripts/lint_json.py --context-root context/core
python3 scripts/generate_coverage_report.py --context-root context/core
python3 scripts/run_task_cli_e2e.py
```

Ожидаемый результат:

- routing schema valid;
- все routing scenarios pass;
- routing coverage 100%;
- memory/source policy scenarios pass;
- task CLI E2E pass.

## Архитектурные границы

Входит в MVP:

- OpenCode config;
- local Ollama provider;
- deterministic routing;
- source routing policy;
- approval gate;
- subagent prompts;
- validation scripts;
- task-flow verification helpers.

Не входит в MVP как обязательная runtime-зависимость:

- cloud LLM provider;
- real secrets in repo;
- обязательный Memory Service;
- обязательный internal docs connector;
- автоматический push/commit.
