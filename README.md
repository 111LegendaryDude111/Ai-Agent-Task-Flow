# Agentic Flow Playbook MVP

Коротко: это заготовка для управляемой работы AI-агентов в OpenCode. Пользователь дает задачу, главный агент Synapse собирает контекст, выбирает нужного подагента по правилам и автономно правит файлы внутри проекта, но просит подтверждение для shell/delete и других опасных действий.

## Как устроен проект

- `opencode.jsonc` - конфиг OpenCode: OpenRouter-модель по умолчанию, локальный Ollama fallback и агенты.
- `agent/core/sfa-synapse.md` - инструкция для главного агента Synapse.
- `agent/subagents/` - инструкции для специализированных агентов, например ML-разработчика и тестовых агентов.
- `context/core/rules/` - JSON-правила маршрутизации задач.
- `context/core/config/` - правила работы с памятью и схемы для сохранения знаний.
- `scripts/` - проверки, генерация отчетов и CLI для задач.
- `docs/LOCAL_MODEL_SETUP.md` - как настроить локальную модель через Ollama.

## Как это работает

1. Пользователь описывает задачу.
2. Synapse определяет тип задачи: документация, тесты, ML, frontend, backend и т.д.
3. Проект читает правила из `context/core/rules/routing-rules.json`.
4. `write`/`edit` внутри проекта разрешены для автономной работы matched subagent.
5. Safe read-only bash (`pwd`, `ls`, `find`, `rg`, `grep`, `git status`, `git diff`) выполняется без подтверждения; для остального `bash`, удаления, dependency installs, network operations, destructive git, изменений вне проекта и секретов агент просит подтверждение.
6. Перед завершением запускаются проверки. Для задач из task-flow используется `scripts/task-cli.ts verify` и `complete`.

Главная идея простая: меньше хаоса, больше повторяемости. Один и тот же ввод должен вести к одному и тому же маршруту.

## Как использовать

Нужны OpenCode и ключ OpenRouter. Локальный Ollama можно оставить как fallback.

```bash
export OPENROUTER_API_KEY="..."
opencode run --agent synapse 'Опиши задачу здесь'
```

По умолчанию используется `openrouter/deepseek/deepseek-v4-flash`. Локальная настройка Ollama описана в `docs/LOCAL_MODEL_SETUP.md`.

## Команды

Проверить правила маршрутизации:

```bash
python3 scripts/validate_routing_rules.py --context-root context/core
```

Проверить политику памяти:

```bash
python3 scripts/validate_memory_routing_policy.py --config-root context/core/config
```

Проверить JSON-файлы:

```bash
python3 scripts/lint_json.py --context-root context/core
```

Сгенерировать отчет по покрытию правил сценариями:

```bash
python3 scripts/generate_coverage_report.py --context-root context/core
```

Проверить task CLI на e2e-фикстуре:

```bash
python3 scripts/run_task_cli_e2e.py
```

Создать patched Ollama-модель для OpenCode, если она отсутствует:

```bash
python3 scripts/create_ollama_opencode_model.py
```

## Безопасность

Не храните токены и секреты в репозитории. API-ключи задавайте через переменные окружения, например `OPENROUTER_API_KEY`.
