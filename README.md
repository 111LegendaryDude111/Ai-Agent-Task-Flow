# Agentic Flow Playbook MVP

Статус: **alpha / internal MVP**. Это переносимый playbook для управляемой работы AI-агентов в OpenCode: context-first, deterministic routing, delegated execution, validation и audit trail.

## Golden path

1. Скопируйте portable config:

   ```bash
   cp opencode.jsonc.example opencode.jsonc
   ```

2. Задайте секреты только через env или локальный `.env` на своей машине:

   ```bash
   export OPENROUTER_API_KEY="..."
   ```

3. Запустите Synapse:

   ```bash
   opencode run --agent synapse 'Опиши задачу здесь'
   ```

4. Проверьте репозиторий одной командой:

   ```bash
   npm run validate
   ```

## Как это работает

- `synapse` — orchestrator. Он собирает контекст и маршрутизирует, но не пишет production code напрямую.
- Matched subagent выполняет изменения в своей зоне ответственности.
- Routing rules живут в `context/core/rules/routing-rules.json`.
- Task-flow state живет в `.tmp/tasks/{feature}/task.json` и `subtask_NN.json`.
- Audit JSONL пишется в `.tmp/audit/routing/{date}/{session}.jsonl`.

## Безопасность

- Secrets не хранятся в репозитории. Используйте env vars: `OPENROUTER_API_KEY`, `BRAVE_API_KEY`, `OBSIDIAN_VAULT_PATH`.
- Optional MCP servers выключены по умолчанию. Включайте их локально после установки нужных инструментов и env vars.
- Safe read-only bash allowlist: `pwd`, `ls *`, `rg *`, `grep *`, `git status*`, `git diff*`.
- Остальной shell, delete, dependency install, network, destructive git, outside-repo и secrets/env операции требуют approval.
- Approval снимает только safety gate; Synapse всё равно обязан повторить routing и делегировать matched subagent.

## Валидация

```bash
npm run validate
```

Команда запускает secret/path scan, routing validation, memory policy validation, JSON lint, routing coverage, Task CLI E2E и audit validator.

## Документация

- `docs/index.md` — единая точка входа.
- `docs/HOW_IT_WORKS.md` — runtime flow.
- `docs/ARCHITECTURE.md` — архитектурные границы MVP.
- `docs/ONBOARDING.md` — первый запуск и сценарии.
- `docs/DEVELOPER_EXTENSION_GUIDE.md` — расширение subagents/routing.
- `docs/PROVIDER_DATA_POLICY.md` — provider/data classification policy.
- `docs/ROUTING_ROADMAP.md` — roadmap routing domains.

## Known limitations

- Это internal alpha, а не fully autonomous platform.
- External providers требуют явного env setup и data classification policy.
- Memory/internal docs connectors optional; при недоступности workflow должен останавливаться в `blocked`.
