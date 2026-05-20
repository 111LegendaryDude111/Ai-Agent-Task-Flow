# План доработок Agentic Flow Playbook / AutoFlow

Статус реализации: выполнено последовательными MVP-срезами; итоговая проверка — `npm run validate`.

Источник: внешнее ревью из чата + быстрая сверка текущего репозитория.

Статус проекта: **MVP/alpha**. Цель плана — довести playbook до надежного внутреннего продукта для небольшой dev-команды, а затем подготовить основу для более строгого rollout.

## Принципы выполнения

- Делать маленькими вертикальными срезами, которые можно проверить отдельно.
- Сначала закрыть переносимость, безопасность и воспроизводимую валидацию.
- Не расширять roadmap, пока MVP runtime не стал переносимым и проверяемым.
- Не хранить secrets, персональные пути и локальные артефакты в репозитории.
- Каждая доработка должна иметь acceptance criteria и команду проверки.

## Приоритеты

| Priority | Область | Почему важно |
| --- | --- | --- |
| P0 | Portable config, secrets, permissions | Без этого нельзя безопасно отдавать проект внутренним пользователям |
| P1 | Validation scripts, CI, package/runtime reliability | Проверки должны запускаться одной командой и в CI |
| P1 | Task CLI schemas, state enforcement, audit | Нужен реальный runtime enforcement, а не только инструкции |
| P2 | Docs/onboarding/developer guide | Снижает стоимость внедрения и расширения |
| P2 | Routing/subagents expansion | Полезно после стабилизации ядра |

## Вертикальные срезы

### 1. Portable runtime config

**Type:** AFK  
**Blocked by:** None

#### What to build

Сделать OpenCode config переносимым между машинами: убрать абсолютные пути, персональные директории и разные имена env-переменных.

#### Acceptance criteria

- [ ] `opencode.jsonc.example` не содержит абсолютных персональных путей.
- [ ] `opencode.jsonc` либо полностью portable, либо переведен в local-only config и игнорируется Git.
- [ ] Prompt paths используют относительные пути вида `{file:./agent/...}`.
- [ ] OpenRouter key везде называется одинаково: `OPENROUTER_API_KEY`.
- [ ] Optional MCP servers с локальными путями выключены по умолчанию или используют env placeholders.
- [ ] README объясняет, как создать локальный config из example.

#### Verification

```bash
npm run scan:secrets
python3 scripts/lint_json.py --context-root context/core
```

---

### 2. Secrets and local artifact hygiene

**Type:** AFK  
**Blocked by:** Slice 1

#### What to build

Зафиксировать политику secrets и локальных артефактов: `.env`, `.DS_Store`, `node_modules`, temp files, build outputs не должны попадать в поставку.

#### Acceptance criteria

- [ ] `.env.example` добавлен и содержит только безопасные placeholder-переменные.
- [ ] `.gitignore` покрывает `.env`, `.env.*`, `.DS_Store`, `node_modules/`, `.tmp/`, build/test outputs.
- [ ] Добавлен простой secret/path scan script или npm script.
- [ ] README содержит правило: secrets только через env.
- [ ] Проверено, что tracked files не содержат явных ключей или персональных путей.

#### Verification

```bash
git ls-files .env .DS_Store 'node_modules/*'
npm run scan:secrets
```

---

### 3. Permission hardening

**Type:** HITL  
**Blocked by:** Slice 1

#### What to build

Закрепить модель: Synapse оркестрирует и не пишет production code напрямую; опасные shell-паттерны не проходят через слишком широкий allowlist.

#### Acceptance criteria

- [ ] `synapse` имеет `edit: deny` и `write: deny` либо явно ограничен non-production task files.
- [ ] Широкий shell file-discovery pattern убран из allowlist или заменен на более строгий безопасный wrapper/pattern.
- [ ] `AGENTS.md`, `docs/HOW_IT_WORKS.md`, `docs/ARCHITECTURE.md` синхронизированы с фактическими permissions.
- [ ] Approval снимает только safety gate, но не разрешает Synapse обходить routing.
- [ ] Security-sensitive prompts покрыты routing scenarios или documented blocker behavior.

#### Verification

```bash
rg -n '"synapse"|"edit": "allow"|"write": "allow"|"find \*": "allow"' opencode.jsonc opencode.jsonc.example
python3 scripts/validate_routing_rules.py --context-root context/core
```

---

### 4. One-command validation and CI

**Type:** AFK  
**Blocked by:** Slice 2

#### What to build

Сделать единый entrypoint для всех проверок локально и в CI.

#### Acceptance criteria

- [ ] В `package.json` добавлены scripts: `validate:routing`, `validate:memory`, `lint:json`, `coverage:routing`, `test:task-cli`, `validate`.
- [ ] Добавлен `make validate` или documented npm-only path.
- [ ] Добавлен CI workflow/pipeline, запускающий validation suite.
- [ ] README и `TESTING.md` используют одну команду проверки.
- [ ] CI не требует secrets для базовой проверки.

#### Verification

```bash
npm run validate
```

---

### 5. Package/runtime reliability

**Type:** AFK  
**Blocked by:** Slice 4

#### What to build

Убрать зависимость от глобального `ts-node` и сделать Task CLI воспроизводимым.

#### Acceptance criteria

- [ ] `typescript`, `ts-node` и нужные типы добавлены в devDependencies.
- [ ] `package-lock.json` не содержит локальных path metadata.
- [ ] `scripts/run_task_cli_e2e.py` не зависает на обычном окружении или имеет timeout/failure diagnostics.
- [ ] Task CLI можно запускать через npm scripts.
- [ ] Документация содержит Node/Python prerequisites.

#### Verification

```bash
npm ci
npm run test:task-cli
```

---

### 6. Routing evaluator/schema parity

**Type:** AFK  
**Blocked by:** Slice 4

#### What to build

Выровнять `routing-rules.schema.json`, документацию и фактический evaluator в `validate_routing_rules.py`.

#### Acceptance criteria

- [ ] Все операторы из schema либо реализованы evaluator'ом, либо удалены из schema.
- [ ] Покрыты `starts_with`, `ends_with`, `matches_regex`, `gt/gte/lt/lte` или явно запрещены.
- [ ] Добавлены negative/edge scenarios: conflict, ambiguous task, mixed stack, unknown repo type, case sensitivity, security-sensitive prompt.
- [ ] Coverage report остается 100%.

#### Verification

```bash
python3 scripts/validate_routing_rules.py --context-root context/core
python3 scripts/generate_coverage_report.py --context-root context/core
```

---

### 7. Task JSON schemas and lifecycle commands

**Type:** AFK  
**Blocked by:** Slice 5

#### What to build

Сделать task-flow artifacts строго валидируемыми и добавить missing lifecycle operations.

#### Acceptance criteria

- [ ] Добавлены JSON Schema для `task.json` и `subtask_NN.json`.
- [ ] `task-cli validate` проверяет схемы и понятные ошибки.
- [ ] Добавлены команды `start`, `block`, `unblock`, `reopen`, `cancel` или documented decision не добавлять часть команд.
- [ ] `skills/task-management/router.sh` показывает только реально реализованные команды.
- [ ] Unit/e2e tests покрывают happy path и invalid task files.

#### Verification

```bash
npm run test:task-cli
```

---

### 8. AutoFlow state enforcement

**Type:** AFK  
**Blocked by:** Slice 7

#### What to build

Превратить state machine из инструкции в проверяемое runtime-состояние.

#### Acceptance criteria

- [ ] Текущий state хранится в `.tmp/tasks/{feature}/task.json` или отдельном state artifact.
- [ ] Переходы валидируются по `auto-flow-state-machine.json`.
- [ ] Нельзя перескочить required gates: context discovery, RED, GREEN, review, verify, complete.
- [ ] Нарушение перехода дает явный blocker/error.
- [ ] Docs объясняют state lifecycle.

#### Verification

```bash
npm run test:task-cli
python3 scripts/lint_json.py --context-root context/core
```

---

### 9. Audit writer implementation

**Type:** AFK  
**Blocked by:** Slice 8

#### What to build

Реализовать фактическую запись audit events, а не только prompt-контракт.

#### Acceptance criteria

- [ ] JSONL events пишутся в `.tmp/audit/routing/{date}/{session}.jsonl`.
- [ ] Пишутся события routing decision, approval decision, subagent handoff, verification result, completion/archive.
- [ ] Events не содержат secrets/env values.
- [ ] Есть минимальный validator формата audit events.
- [ ] Audit trail можно приложить к verification evidence.

#### Verification

```bash
npm run validate
# plus targeted audit validator after implementation
```

---

### 10. Subagent prompt contracts

**Type:** AFK  
**Blocked by:** Slice 3

#### What to build

Усилить короткие prompts у ключевых subagents: output contract, blocker contract, verification contract, примеры.

#### Acceptance criteria

- [ ] `TaskManager` описывает DoR/DoD, dependencies, acceptance criteria, verification spec.
- [ ] `BuildAgent` возвращает команды, результат, failure summary, next diagnostic route.
- [ ] `CodeReviewer` возвращает blocking/non-blocking findings и risk summary.
- [ ] `DocWriter`, `FrontendDeveloper`, `JavaDeveloper` имеют required context и refusal/blocker behavior.
- [ ] Все prompts согласованы с routing rules и permissions.

#### Verification

```bash
rg -n "Output|Blocker|Verification|Required context" agent/subagents
python3 scripts/validate_routing_rules.py --context-root context/core
```

---

### 11. Documentation cleanup and MVP alignment

**Type:** AFK  
**Blocked by:** Slices 1-4

#### What to build

Синхронизировать документацию с фактическим runtime и отделить roadmap/черновики от MVP.

#### Acceptance criteria

- [ ] `PDR.md` явно помечает MVP vs roadmap.
- [ ] Упоминания несуществующих runtime agents перенесены в roadmap или удалены из MVP docs.
- [ ] Temporary draft docs удалены из tracked docs или переименованы в архив/черновик, если нужны.
- [ ] Добавлен `docs/index.md` как единая точка входа.
- [ ] README коротко объясняет статус alpha, golden path и known limitations.

#### Verification

```bash
npm run scan:secrets
```

---

### 12. Internal user onboarding guide

**Type:** AFK  
**Blocked by:** Slice 11

#### What to build

Создать практический guide для первого запуска и типовых сценариев.

#### Acceptance criteria

- [ ] Добавлен `docs/ONBOARDING.md`.
- [ ] Есть 3-5 готовых сценариев: docs task, bugfix, test-first, ML review, validation.
- [ ] Для каждого сценария есть prompt, expected routing, expected output, troubleshooting.
- [ ] Описано, что делать при `blocked`.
- [ ] Описаны local setup, OpenRouter, Ollama fallback, MCP opt-in.

#### Verification

```bash
rg -n "ONBOARDING|blocked|OpenRouter|Ollama|MCP" docs README.md
```

---

### 13. Developer extension guide

**Type:** AFK  
**Blocked by:** Slices 6, 10, 11

#### What to build

Документировать, как безопасно добавлять новых subagents, routing rules и scenarios.

#### Acceptance criteria

- [ ] Добавлен `docs/DEVELOPER_EXTENSION_GUIDE.md`.
- [ ] Описаны naming, priorities, permission profile, scenarios, coverage, regression checklist.
- [ ] Есть пример добавления нового rule + subagent + scenario.
- [ ] Guide ссылается на `instructions/skill-template.md` и `instructions/subagent-template.md`.

#### Verification

```bash
rg -n "DEVELOPER_EXTENSION_GUIDE|priority|scenario|permission" docs instructions
```

---

### 14. Provider and data classification policy

**Type:** HITL  
**Blocked by:** Slice 11

#### What to build

Зафиксировать, какие данные можно отправлять во внешние модели, а что должно обрабатываться локально.

#### Acceptance criteria

- [ ] Добавлена provider matrix: OpenRouter, Ollama, optional providers.
- [ ] Описаны классы данных: public/internal/confidential/secret.
- [ ] Для каждого класса указано, какие providers разрешены.
- [ ] Approval gate учитывает external provider risk в docs/rules.
- [ ] README ссылается на policy.

#### Verification

```bash
rg -n "data classification|provider matrix|confidential|secret|OpenRouter|Ollama" docs README.md
```

---

### 15. Routing and subagent expansion roadmap

**Type:** HITL  
**Blocked by:** Slices 6, 13, 14

#### What to build

После стабилизации ядра определить следующий набор routing domains и subagents.

#### Candidate domains

- Node.js backend
- Python/data engineering
- SQL/migrations
- DevOps/CI
- API/spec design
- Dependency update
- Security review
- RAG/evaluation-specific ML flows

#### Acceptance criteria

- [ ] Приоритизирован список новых domains.
- [ ] Для каждого domain есть expected routing facts и owner subagent.
- [ ] Добавлены scenarios до включения rules.
- [ ] Нет деградации existing routing coverage.

#### Verification

```bash
python3 scripts/validate_routing_rules.py --context-root context/core
python3 scripts/generate_coverage_report.py --context-root context/core
```

## Рекомендуемый порядок работ

1. Portable runtime config.
2. Secrets/local artifact hygiene.
3. Permission hardening.
4. One-command validation and CI.
5. Package/runtime reliability.
6. Routing evaluator/schema parity.
7. Task JSON schemas and lifecycle commands.
8. AutoFlow state enforcement.
9. Audit writer.
10. Subagent prompt contracts.
11. Documentation cleanup and MVP alignment.
12. Internal user onboarding guide.
13. Developer extension guide.
14. Provider and data classification policy.
15. Routing and subagent expansion roadmap.

## Definition of Done для каждого среза

- [ ] Изменения минимальны и относятся к конкретному срезу.
- [ ] Документация синхронизирована с runtime.
- [ ] Нет secrets, персональных путей и лишних локальных артефактов.
- [ ] Запущена указанная verification-команда.
- [ ] Если verification не проходит, зафиксирован blocker и следующий шаг.
