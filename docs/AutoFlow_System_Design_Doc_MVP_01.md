# Дизайн системы — AutoFlow / Agentic Flow Playbook MVP-01

**Продукт:** AutoFlow / Agentic Flow Playbook  
**Тип документа:** System Design Doc, адаптация ML System Design Doc под agentic development platform  
**Статус:** Draft для MVP-пилота  
**Дата:** 20 мая 2026  
**Аудитория:** внутренние пользователи, разработчики, тимлиды, AI platform / platform engineering  
**Владелец:** TBD  
**Целевой контур:** внутреннее использование в командах разработки  

## 0. Резюме

AutoFlow — это конфигурационный и процессный слой поверх OpenCode, который превращает работу AI-агента из ad-hoc vibe coding в управляемый pipeline:

```text
context-first -> deterministic routing -> delegated execution -> verification -> audit
```

Система принимает пользовательскую задачу, собирает контекст репозитория, выбирает специализированного subagent по JSON-правилам, ведет задачу через test-first/verification-gates и фиксирует evidence перед заявлением о завершении.

**Главная продуктовая ценность:** ускорить выполнение типовых инженерных задач без потери контроля над качеством, безопасностью и воспроизводимостью.

**MVP не является самостоятельным бизнес-приложением.** Это внутренний playbook/runtime для разработчиков: набор agent prompts, rules, workflows, skills, task CLI, validation scripts и документации. Production-версия должна превратить этот набор в переносимый, тестируемый и наблюдаемый внутренний инструмент.

## 1. Цели и предпосылки

### 1.1. Зачем идем в разработку продукта?

**Бизнес-цель.** Снизить время от постановки задачи до проверенного результата за счет автоматизации рутинных этапов: поиска контекста, декомпозиции, выбора исполнителя, подготовки тестов, проверки результата и handoff.

**Почему станет лучше, чем сейчас.** Текущий ручной или полуавтоматический AI-flow часто держится на свободном диалоге с LLM. Это дает быстрые локальные выигрыши, но плохо масштабируется: агент может пропустить контекст, выбрать неправильный тип действий, не выполнить проверки и преждевременно заявить о готовности. AutoFlow заменяет это на явные состояния, роли, правила маршрутизации и completion gate.

**Успех MVP-итерации с точки зрения бизнеса.** Пилот считается успешным, если небольшая внутренняя группа разработчиков может выполнять реальные задачи через AutoFlow быстрее или стабильнее, чем через ручной prompting, при этом каждая закрытая задача имеет verification evidence и понятный audit trail.

| Метрика успеха MVP | Целевое значение для пилота | Комментарий |
|---|---:|---|
| Correct routing rate | >= 80% задач без ручной смены agent | Проверяется по логам routing decisions и ревью разработчика |
| Verified completion rate | >= 90% закрытых задач имеют свежую проверку | Нельзя засчитывать задачи без evidence |
| False completion rate | <= 5% | Заявлено “готово”, но acceptance criteria не выполнены |
| Developer intervention count | Снижение к концу пилота | Сколько раз пользователь вынужден чинить flow вручную |
| User satisfaction | >= 4/5 | Качественная оценка внутренних пользователей |
| Security incidents | 0 | Утечки секретов, опасные shell-операции, изменения вне repo |

### 1.2. Бизнес-требования и ограничения

| ID | Требование | MVP-реализация | Критерий приемки |
|---|---|---|---|
| BR-01 | Единый вход для задач разработки | `opencode run --agent synapse ...`, slash-command `/auto-flow` | Пользователь стартует задачу без выбора конкретного subagent |
| BR-02 | Контекст до реализации | ContextScout + source routing policy | Перед изменениями указан список critical context files |
| BR-03 | Детерминированная маршрутизация | `routing-rules.json`, schema, scenario tests | Одинаковые input facts дают одинаковый selected rule |
| BR-04 | Декомпозиция сложных задач | TaskManager создает `.tmp/tasks/{feature}/task.json` и `subtask_NN.json` | Подзадачи имеют acceptance criteria, dependencies, verification_spec |
| BR-05 | Test-first для feature/bugfix | TestDesigner -> confirm red -> implement -> validate green | Для новой логики есть failing/targeted behavior coverage |
| BR-06 | Completion только после проверки | `task-cli verify` -> `complete` | Нельзя закрыть subtask без актуального verification evidence |
| BR-07 | Наблюдаемость | AuditLogger contract + будущий JSONL writer | Routing, approval, verification events доступны для разбора |
| BR-08 | Безопасность shell/write | Permission model, approval gate | Delete/network/dependency/destructive git требуют approval |
| BR-09 | Переносимость | `opencode.jsonc.example`, env secrets | Нет абсолютных путей и hardcoded secrets в production config |
| BR-10 | Расширяемость | Templates for skills/subagents, rules schema | Новый subagent добавляется через documented checklist |

**Бизнес-ограничения.** Проект рассчитан на внутренних пользователей и разработчиков. MVP не должен выполнять автоматический merge/push без подтверждения, не должен заменять CI/CD, issue tracker или code review процесс, не должен хранить секреты в task files, memory, logs или audit artifacts, не должен отправлять чувствительные данные внешнему LLM-провайдеру без явной политики.

**Бизнес-процесс пилота.** Разработчик берет задачу из backlog, запускает AutoFlow в репозитории, Synapse классифицирует задачу, ContextScout собирает контекст, TaskManager при необходимости создает подзадачи, routing rules выбирают subagent, результат проходит тесты/ревью/verification, после чего разработчик получает handoff: summary, changed files, subagents used, verification run, remaining risks.

### 1.3. Что входит в скоуп проекта/итерации, что не входит

**Входит в MVP-итерацию.**

- Portable setup: переносимый `opencode.jsonc.example`, `.env.example`, install/validation instructions.
- Deterministic routing: schema, scenarios, coverage report, negative tests.
- Runtime task management: task/subtask schemas, state persistence, CLI validation, verify/complete/archive.
- Verification gates: evidence before completion, feature-level verification.
- Safety gates: command policy, approval model, no direct Synapse implementation.
- Audit trail MVP: JSONL writer for routing, approval, delegation, verification, completion.
- User onboarding: quick start, golden paths, troubleshooting.
- Developer extension guide: как добавить rule/subagent/skill без регрессий.

**Не входит в MVP-итерацию.**

- Полная замена Jira/YouTrack/Linear.
- Полноценная IDE или web UI.
- Автоматический merge/push/PR без явного действия пользователя.
- Обучение собственной LLM.
- Enterprise dashboard с аналитикой по всем командам.
- Полностью автономная разработка без проверки человеком.
- Гарантия корректности бизнес-логики без acceptance criteria от владельца задачи.

**Результат с точки зрения качества кода и воспроизводимости.** MVP должен запускаться на чистом окружении по инструкции, иметь одну команду для validation suite, не требовать локальных абсолютных путей, сохранять task state в `.tmp/tasks`, фиксировать verification evidence и иметь CI-проверки для JSON rules/policies/scripts.

**Планируемый технический долг.** В текущем состоянии остаются зоны, требующие hardening: активный `opencode.jsonc` содержит локальные пути и placeholder apiKey, `package.json` не содержит scripts/devDependencies для `ts-node`, audit writer описан контрактом, но не реализован как runtime-компонент, schema routing operators шире фактического evaluator, часть slash commands является заготовкой.

### 1.4. Предпосылки решения

| Предпосылка | Обоснование | Риск, если предпосылка неверна |
|---|---|---|
| Пользователи — разработчики, знакомые с CLI/Git | MVP ориентирован на внутренние dev-команды | Нужен UI/onboarding другого уровня |
| Репозитории имеют воспроизводимые проверки | Verification gate зависит от test/build commands | Completion будет часто уходить в blocked |
| Можно использовать OpenCode как runtime | Текущий проект построен вокруг OpenCode agents/config | Потребуется портирование orchestration layer |
| Часть задач можно делегировать внешнему LLM | OpenRouter указан как primary provider | Нужна строгая data classification / local-only режим |
| `.tmp/tasks` приемлем как локальный state store | MVP task runtime хранит состояние в файлах | Для multi-user нужен централизованный state store |
| Команда готова писать acceptance criteria | Без явных критериев task-flow не может доказать done | Рост false completion или blocked states |

## 2. Методология

### 2.1. Постановка задачи

С технической точки зрения AutoFlow решает задачу **детерминированной оркестрации агентного процесса разработки**. Это не ML-модель и не рекомендательная система. Ближайшая техническая формулировка:

```text
Input: user task + repo context + standards + routing rules + permissions
Output: selected workflow + selected subagent + verified changes + audit evidence
```

**Бейзлайн:** разработчик вручную формулирует prompt generic AI-agent, сам подбирает контекст, сам просит тесты/ревью, сам проверяет результат.

**MVP AutoFlow:** Synapse orchestrator, ContextScout, TaskManager, routing-rules, специализированные subagents, task CLI, verification-before-completion.

**Production target:** переносимый внутренний инструмент с packaged CLI, CI, audit writer, centralized policy/rules registry, provider gateway, data-classification enforcement и документацией для rollout.

### 2.2. Блок-схема решения

**Бейзлайн: ручной AI-flow**

```text
Developer task
  -> Generic AI prompt
  -> Manual context copy/paste
  -> AI edits or suggests edits
  -> Developer manually checks diff/tests
  -> Manual handoff
```

**MVP AutoFlow**

```text
Developer task
  -> Synapse Orchestrator
  -> ContextScout: repo + standards + durable memory policy
  -> TaskManager: task.json + subtask_NN.json when needed
  -> Rule-Based Routing Engine: input facts -> priority rule -> subagent
  -> Specialized subagent: docs/tests/frontend/java/ml/review/build/generic
  -> BuildAgent + CodeReviewer + TestDiagnostician gates
  -> Task CLI: verify -> complete -> verify-feature -> archive
  -> Audit JSONL + final handoff
```

**Production architecture target**

```text
CLI / IDE command / internal UI
  -> AutoFlow Orchestration Runtime
  -> Context & Policy Gateway
  -> Rule Engine Service
  -> Task State Store
  -> Agent Execution Layer
  -> Verification & CI Adapter
  -> Audit Store / Dashboard
  -> Handoff to developer / PR workflow
```

### 2.3. Этапы решения задачи

| Этап | Входные артефакты | MVP-техника | Выход | Метрики этапа | Основные риски |
|---|---|---|---|---|---|
| 1. Intake и context discovery | User task, repo files, `context/core/**` | Synapse классифицирует задачу, ContextScout ищет critical files | Task facts, список контекста | Доля задач без missing context | Неполный контекст, ambiguous requirements |
| 2. Task decomposition | Цель, acceptance criteria, context files | TaskManager создает task/subtask JSON | `.tmp/tasks/{feature}/...` | Валидность JSON, готовность next task | Слишком крупные или unverifiable subtasks |
| 3. Deterministic routing | input facts, routing rules | Priority-based matching через ConditionEvaluator | matched rule + subagent/action | routing pass rate, conflict rate | Drift между schema и evaluator |
| 4. Test-first execution | subtask spec, target files | TestDesigner -> confirm red -> implement minimal change | Tests + production diff | red/green evidence rate | Слабые/хрупкие тесты, flakiness |
| 5. Review and validation | diff, tests, verification_spec | CodeReviewer + BuildAgent | review result, command outputs | blocking findings, pass rate | Review как формальность, partial checks |
| 6. Completion gate | verification evidence | `task-cli verify` -> `complete` | completed subtask / blocked state | false completion rate | Возможность обойти CLI или stale evidence |
| 7. Audit and handoff | routing/approval/verification events | JSONL audit contract/writer | audit trail + final summary | audit completeness | Логи без полезного контекста или с секретами |
| 8. Hardening and onboarding | pilot feedback, failures | docs, CI, config portability | rollout-ready package | setup success rate | Adoption friction |

#### Этап 1. Подготовка контекста и требований

| Данные / сущности | Есть ли сейчас | Требуемый ресурс | Качество проверено |
|---|---|---|---|
| User task text | Да, runtime input | User / PO | Нет, требует intake clarification |
| Repo source files | Да, filesystem | Developer / ContextScout | Частично, через git status/diff и tests |
| Standards/workflows | Да, `context/core/**` | Platform engineer | Да, JSON lint для config/rules |
| Routing rules | Да, `context/core/rules/routing-rules.json` | Platform engineer | Да, schema + scenarios |
| Task state | Да, `.tmp/tasks/**` | TaskManager / CLI | Частично, runtime schemas нужно усилить |
| Audit events | Контракт есть | Platform engineer | Нет, writer нужно реализовать |
| External/internal docs | Концептуально есть | Docs connector / policy | Нет, требует integration hardening |

**Результат этапа:** задача имеет достаточный контекст для планирования или переводится в `blocked` с минимальным недостающим вопросом/permission.

#### Этап 2. Routing and orchestration

**Бейзлайн:** LLM сама решает, что делать и каким стилем.  
**MVP:** routing rules сортируются по priority, первое matched правило выбирает action/subagent.  
**Production:** rule engine становится отдельным проверяемым модулем с audit events, conflict detection, negative scenarios и versioned rules registry.

| Routing output | Пример назначения | Verification |
|---|---|---|
| `REQUEST_APPROVAL` | Опасная shell/write операция | Пользователь явно подтверждает |
| `DELEGATE: FrontendDeveloper` | `.tsx`, React, CSS/UI coding | Targeted tests/build |
| `DELEGATE: JavaDeveloper` | Java/Kotlin backend | Unit/integration tests |
| `DELEGATE: MLDeveloper` | ML/RAG/model eval | Leakage/eval/reproducibility checks |
| `DELEGATE: TestDesigner` | New behavior test-first | Expected red state |
| `DELEGATE: BuildAgent` | Build/test/type-check | Command evidence |
| `EXECUTE_DIRECT` | Read-only commands | Allowlist only |
| `FAIL` | Unknown unmatched work | Explicit blocked/fail response |

#### Этап 3. Verification and completion

Completion считается валидным только при наличии свежего evidence: команда проверки, exit code, output summary, проверенные deliverables, git diff/fingerprint и acceptance criteria checklist.

| Gate | Кто отвечает | Условие прохождения | Failure path |
|---|---|---|---|
| Confirm red | BuildAgent | Новый/существующий тест падает по ожидаемой причине | TestDiagnostician или blocked |
| Validate green | BuildAgent | Targeted validation passes | Diagnose failure |
| Review | CodeReviewer | Нет blocking findings | Вернуться к implement/test |
| Verify subtask | Synapse + task CLI | `verify` passed, evidence saved | Diagnose / blocked |
| Complete subtask | Synapse + task CLI | `complete` после verify | Нельзя complete без verify |
| Feature verification | Synapse + task CLI | `verify-feature` passed | blocked или next action |

## 3. Подготовка пилота

### 3.1. Способ оценки пилота

Рекомендуемый дизайн пилота — controlled internal pilot на 2–3 репозиториях и 5–8 разработчиках. Для честной оценки использовать смешанный подход:

1. **Before/after:** сравнить задачи команды до и после AutoFlow по lead time, количеству ручных исправлений, дефектам в review.
2. **Within-subject comparison:** один и тот же разработчик выполняет сопоставимые задачи с AutoFlow и без AutoFlow.
3. **Task-class analysis:** отдельно оценивать docs, tests, frontend, backend, ML/RAG, review/build tasks.
4. **Qualitative review:** короткое интервью после каждой задачи: где AutoFlow помог, где мешал, где routing был неверным.

| Класс задач | Примеры | Что измеряем |
|---|---|---|
| Documentation | README, ADR, migration docs | Скорость, полнота, необходимость ручной правки |
| Test-first bugfix | Regression test + fix | Red/green evidence, correctness |
| Frontend task | React/TSX component | Routing, targeted build/test, review findings |
| Backend Java/Kotlin | Endpoint/service change | Unit tests, dependency/context usage |
| ML/RAG/eval | Eval harness, metric, leakage check | Reproducibility, metric alignment |
| Build/review | Typecheck, lint, code review | Evidence quality, useful findings |

### 3.2. Что считаем успешным пилотом

| Категория | Метрика | Success threshold |
|---|---|---:|
| Продуктовая ценность | Средняя субъективная полезность | >= 4/5 |
| Скорость | Снижение elapsed time на типовых задачах | >= 20% для подходящих задач |
| Качество | Доля задач без blocking review findings после AutoFlow | >= 75% |
| Управляемость | Correct routing rate | >= 80% |
| Доказуемость | Verified completion rate | >= 90% |
| Безопасность | Секреты/опасные команды без approval | 0 инцидентов |
| Надежность runtime | Setup success на чистой машине | >= 90% участников |
| Adoption | Доля участников, готовых использовать дальше | >= 70% |

### 3.3. Подготовка пилота

**Минимальный pre-pilot checklist.**

| Направление | Что подготовить | Owner |
|---|---|---|
| Репозитории | 2–3 sandbox/real repos с тестами и понятными задачами | Tech Lead |
| Backlog | 20–30 задач разных классов, acceptance criteria | PO / Tech Lead |
| Runtime | Portable config, `.env.example`, install guide | Platform engineer |
| Verification | Project-specific commands: test/build/lint/typecheck | Repo owner |
| Security | Provider policy, secret rules, shell approval policy | Security / Platform |
| Observability | Audit JSONL, pilot spreadsheet/dashboard | Platform / PO |
| Onboarding | 30–60 минут workshop + quickstart | Platform / Tech Lead |

**Ограничения по вычислениям.** MVP запускается локально; основные затраты — model calls, локальный CPU/GPU при Ollama, CI/test execution. Для пилота достаточно собирать per-task usage proxy: model/provider, elapsed time, number of prompts/delegations, verification command durations. Если провайдер тарифицируется по токенам, бюджет задается per developer/day и per task class.

## 4. Внедрение для production систем

### 4.1. Архитектура решения

| Компонент | Назначение | MVP | Production target |
|---|---|---|---|
| Entry point | Принять задачу пользователя | OpenCode command / slash command | CLI + IDE extension + optional internal UI |
| Synapse Orchestrator | Управлять state machine и delegation | Prompt file | Runtime module + policy checks |
| Context layer | Repo, standards, memory, docs | ContextScout + policy JSON | Context gateway + source adapters |
| Rule engine | Deterministic routing | JSON rules + validator | Versioned rules service/library |
| Task state store | Состояние feature/subtasks | `.tmp/tasks/**` | Local + optional centralized store |
| Subagent layer | Выполнение специализированных работ | Prompt files in `agent/**` | Packaged agent registry |
| Verification layer | Tests/build/review/complete | BuildAgent + task CLI | CI adapter + evidence store |
| Audit layer | Объяснимость решений | Contract only / JSONL target | Audit writer + dashboard/export |
| Provider gateway | OpenRouter/Ollama/model policy | Config in `opencode.jsonc` | Data-classification-aware gateway |
| Governance | Безопасность и стандарты | Docs + permissions | Policy-as-code + secret scanning |

**Основной runtime-flow:**

```text
start_task(task_text, repo_path)
  -> classify_facts(task_text, repo)
  -> discover_context(facts)
  -> decompose_if_complex(task, context)
  -> route(facts, routing_rules)
  -> request_approval_if_required(action)
  -> delegate_to_subagent(agent, subtask)
  -> verify_evidence(subtask)
  -> complete_or_block(subtask)
  -> write_audit_events(flow)
```

### 4.2. Описание инфраструктуры и масштабируемости

**MVP-инфраструктура:** локальный репозиторий, OpenCode, Node/Python scripts, OpenRouter primary provider, Ollama fallback, `.tmp/tasks` для state, локальный Git, project-specific tests.

**Почему такой выбор подходит для MVP.** Минимальная стоимость внедрения, быстрая проверка ценности, нет необходимости строить отдельный backend. Команда может валидировать поведение на реальных задачах до инвестиций в production platform.

**Минусы MVP-подхода.** Локальное состояние трудно агрегировать, нет централизованной аналитики, политика безопасности зависит от корректности локального config, audit трудно анализировать по командам, setup может быть хрупким.

**Production-рекомендация.** Упаковать AutoFlow как внутренний CLI/toolkit с versioned config, CI validation, centralized rule registry, audit export, local-only и external-provider modes, и шаблонами интеграции в репозитории.

### 4.3. Требования к работе системы

| Требование | MVP target | Production target |
|---|---:|---:|
| Routing latency | < 1 сек после facts extraction | < 500 мс library/service call |
| Context discovery | < 60 сек для обычной задачи | Configurable, with file budget |
| Task decomposition | < 2 мин для complex task | < 1 мин при cached context |
| Verification freshness | Всегда current session | Hard gate with evidence TTL |
| Availability | Локально, best effort | >= 99% для shared services |
| Throughput | 1 active task per developer/repo session | Несколько параллельных sessions |
| Recovery | blocked state + explicit next action | resumable state + audit replay |
| Data retention | `.tmp` локально, gitignored | retention policy by data class |

### 4.4. Безопасность системы

| Угроза | Пример | Митигирующее решение |
|---|---|---|
| Permission bypass | Agent выполняет destructive shell через allowlist pattern | Safe-shell parser вместо wildcard allowlist; deny by default |
| Prompt injection из repo/docs | Документ просит игнорировать правила | Source trust policy; system rules higher priority; no hidden execution |
| Secret leakage | Ключи попадают в prompt/log/task memory | Secret scanner, redaction, provider policy, no env logging |
| Test weakening | Agent правит тест вместо кода | TestDiagnostician gate, review rule, explicit prohibition |
| False completion | “Готово” без запуска tests | Verification-before-completion hard gate |
| Audit tampering | Agent удаляет или переписывает logs | Append-only audit, hash chain for production |
| External provider data leakage | Код/секреты уходят в OpenRouter | Data classification + local-only mode for sensitive repos |
| Overbroad Synapse permissions | Orchestrator пишет production code напрямую | Synapse edit/write ограничить orchestration/task files или enforce via policy |

### 4.5. Безопасность данных

| Тип данных | Где появляется | Policy |
|---|---|---|
| Source code | Repo context, diffs, prompts | Не отправлять внешнему provider без разрешенной classification |
| Secrets/env | Config, tests, logs | Не читать/не сохранять; redaction; secret scanning |
| Task descriptions | User input, `.tmp/tasks` | Локальное хранение; не включать sensitive details без необходимости |
| Verification output | CLI logs, tests, build output | Хранить как evidence, но редактировать секреты |
| Durable memory | Memory service | Только stable project knowledge, без transient facts/secrets/raw chunks |
| Audit logs | `.tmp/audit/**` или production store | Содержать facts/rule/action/result, не raw secret-bearing payloads |

### 4.6. Издержки

Точные издержки зависят от выбранного provider, объема контекста и длительности тестов. Для MVP следует считать не фиксированную цену, а per-task cost model:

```text
Task cost = model_input_tokens * input_price
          + model_output_tokens * output_price
          + local/CI compute time
          + developer supervision time
```

| Категория затрат | MVP | Production control |
|---|---|---|
| LLM usage | OpenRouter или локальная Ollama | Budget per repo/team/task class |
| Local compute | Ollama, tests, builds | Resource limits, cached context |
| CI compute | Если verification запускается через CI | CI minutes budget |
| Platform maintenance | Скрипты, docs, rules | Owner + release cadence |
| Security/compliance | Review provider policy, secret scanning | Automated policy checks |

### 4.7. Integration points

| Интеграция | Назначение | MVP | Production |
|---|---|---|---|
| Git | diff/status/source of truth | `git status`, `git diff` | PR integration, branch policy |
| CI/CD | Независимая проверка результата | Manual commands | CI adapter, required checks |
| Issue tracker | Task source and acceptance criteria | Manual copy | Jira/Linear/YouTrack connector |
| Internal docs | Architecture/business context | Policy placeholder | Confluence/Docs Scout |
| External docs/web | Library references | External search policy | Approved docs providers |
| Memory service | Durable project knowledge | Policy/schema | Governed memory registry |
| Model providers | AI execution | OpenRouter/Ollama | Provider gateway + data policy |
| Security tooling | Secret/code scanning | Recommended | Required pre-handoff gate |

### 4.8. Риски и неопределенности

| Риск | Вероятность | Влияние | План обработки |
|---|---:|---:|---|
| Пользователи не доверяют агентам | Средняя | Высокое | Evidence-first handoff, transparent audit, pilot training |
| Runtime setup хрупкий | Высокая | Высокое | Portable config, package scripts, install doctor |
| Rules устаревают при росте use cases | Средняя | Среднее | Versioned rules, scenarios, coverage, owner |
| Агент делает изменения за пределами скоупа | Средняя | Высокое | Task state, diff review, permission boundaries |
| Verification commands дорогие/долгие | Средняя | Среднее | Narrow targeted tests first, staged verification |
| External provider недоступен | Средняя | Среднее | Ollama fallback, provider retry, local-only mode |
| Audit недостаточно полезен | Средняя | Среднее | Define event taxonomy and dashboard questions upfront |
| Security policy конфликтует со скоростью | Средняя | Высокое | Data classes and approved modes per repo |

## 5. Rollout plan и readiness gates

| Gate | Что должно быть готово | Проверка |
|---|---|---|
| G1. Portable setup | Нет абсолютных путей/secrets, есть `.env.example` | Fresh clone setup test |
| G2. Validation suite | Одна команда запускает lint/schema/scenarios/coverage/e2e | CI green |
| G3. Runtime schemas | JSON schema для task/subtask и state transitions | Negative tests |
| G4. Permission enforcement | Safe-shell parser, Synapse не пишет production code | Security review |
| G5. Audit MVP | JSONL writer для routing/approval/delegation/verification | Audit replay smoke test |
| G6. Onboarding | Quickstart, examples, troubleshooting | New user completes sample task |
| G7. Pilot readiness | Backlog, metrics, owners, support channel | Pilot kickoff checklist |

**Рекомендуемая очередность работ.**

1. Hardening setup: portable config, `.gitignore`, package scripts, remove local artifacts.
2. CI validation: `make validate` / `npm test` for routing, memory policy, JSON lint, coverage, task CLI e2e.
3. Runtime enforcement: task/subtask schemas, state transition validator, audit writer.
4. Safety: permission model, safe-shell parser, provider/data policy.
5. Documentation: user quickstart, developer extension guide, examples.
6. Pilot: measured rollout on selected repos.

## 6. Текущий статус MVP по результатам ревью

| Проверка | Статус | Комментарий |
|---|---|---|
| Routing schema validation | PASS | JSON schema валидирует ruleset |
| Routing scenarios | 15/15 PASS | Все текущие сценарии проходят |
| Memory/source routing policy | 9/9 PASS | Source policy scenarios проходят |
| JSON lint по `context/core` | PASS | Rules/config JSON валидны |
| Routing coverage | 100% по 14 rules | Все production rules покрыты scenario tests |
| Task CLI manual flow | PASS в ручном запуске | `verify -> complete -> verify-feature -> archive` работоспособен |
| `scripts/run_task_cli_e2e.py` | Требует hardening | В текущем окружении зависает на `npx ts-node`, так как `ts-node` не зафиксирован в package dependencies/scripts |

## 7. Открытые вопросы

| Вопрос | Почему важно | Предлагаемое решение |
|---|---|---|
| Какие репозитории разрешены для внешнего LLM? | Data leakage risk | Ввести repo data classification: local-only / external-allowed |
| Кто владеет routing rules? | Rules быстро устаревают | Назначить platform owner и review process |
| Где хранить audit в production? | Нужна трассируемость | MVP JSONL, затем centralized audit store |
| Как интегрировать с Jira/Confluence? | Для внутренних задач нужен business context | Начать с manual copy, затем connector pilot |
| Как измерять скорость? | Без метрик сложно доказать value | Pilot dashboard: elapsed time, interventions, verification |
| Как обрабатывать flaky tests? | Flakiness ломает доверие | TestDiagnostician classification + quarantine policy |
| Что считается “готово” для docs-only task? | Нет build/test сигнала | Define docs verification checklist and reviewer gate |

## 8. Роли и ответственность

| Роль | Ответственность |
|---|---|
| Product Owner / Tech Lead | Выбирает pilot backlog, формулирует acceptance criteria, оценивает бизнес-эффект |
| Platform Engineer | Поддерживает AutoFlow config, scripts, CI, audit, packaging |
| Security Reviewer | Утверждает provider policy, shell permissions, secret handling |
| Repo Owner | Предоставляет project-specific verification commands и standards |
| Developer-user | Запускает AutoFlow, принимает handoff, сообщает failures |
| AI Platform Owner | Развивает agent registry, routing rules, governance и roadmap |

## 9. Итоговое проектное решение

AutoFlow следует развивать как **внутренний engineering productivity product**, а не как набор разрозненных prompt-файлов. Ядро уже выбрано верно: deterministic routing, context-first, subagent specialization, test-first, verification gate, audit. Основной фокус следующей итерации — не добавление новых агентов, а hardening runtime: переносимость, CI, безопасное выполнение команд, audit writer, task schemas и понятный onboarding.

Для MVP-пилота продуктовая гипотеза формулируется так:

> Если разработчики будут запускать задачи через AutoFlow вместо ручного prompting, то типовые engineering tasks будут закрываться быстрее и с меньшим количеством непроверенных/необъяснимых результатов, потому что система навязывает контекст, routing, тесты, ревью и verification evidence до handoff.

