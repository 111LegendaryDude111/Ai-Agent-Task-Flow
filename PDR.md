# PDR.md — Agentic Flow Playbook / Enterprise Vibe Coding Platform

**Проект:** `agentic-flow-playbook`
**Назначение:** глобальная конфигурация OpenCode для управляемой enterprise-разработки через AI-агентов
**Версия документа:** 0.1
**Статус:** Draft
**Дата:** 2026-05-18
**Владелец:** TBD

---

## 1. Executive Summary

Цель проекта — реализовать enterprise-ready платформу для agentic/vibe coding, где пользовательская задача проходит управляемый pipeline:

```text
User Task
  → SFA Synapse Orchestrator
  → Context Discovery
  → Task Planning
  → Rule-Based Routing
  → Subagent Execution
  → Review / Build Validation
  → Completion Gate
  → Handoff
```

Ключевая идея: AI-агент не должен хаотично писать код. Он должен работать в ограниченной системе с контекстом, правилами маршрутизации, approval gates, audit trail и deterministic verification.

---

## 2. Problem Statement

Обычный vibe-coding подход плохо масштабируется в enterprise-среде из-за следующих проблем:

1. **Нестабильное качество решений**
   LLM может выбрать неверный подход, пропустить контекст проекта или нарушить локальные стандарты.

2. **Heuristic routing**
   Если LLM сам решает, какой агент или workflow нужен, поведение становится плохо воспроизводимым.

3. **Недостаток контекста**
   Агенты часто начинают реализацию без понимания архитектуры проекта, стандартов, бизнес-документации и существующих паттернов.

4. **Нет надежного completion gate**
   Агент может заявить “готово”, хотя тесты не запускались, diff не проверен, acceptance criteria не закрыты.

5. **Слабая наблюдаемость**
   Без audit log сложно понять, почему система выбрала конкретного исполнителя, какой контекст использовала и где произошла ошибка.

6. **Риск небезопасных изменений**
   Write/edit/bash операции должны быть контролируемыми, особенно в корпоративной среде.

---

## 3. Goals

### 3.1 Product Goals

- Создать управляемую agentic development platform поверх OpenCode.
- Обеспечить predictable execution для задач разработки, тестирования, ревью и документации.
- Снизить риск случайных или невалидированных изменений кода.
- Сделать поведение системы трассируемым через audit logs.
- Повысить качество реализации за счет обязательного context-first workflow.

### 3.2 Engineering Goals

- Реализовать SFA Synapse как главный orchestrator.
- Реализовать rule-based routing engine на основе JSON-правил.
- Реализовать набор специализированных subagents.
- Реализовать TaskManager для декомпозиции сложных задач.
- Реализовать Memory Service integration для durable project knowledge.
- Реализовать approval gate перед write/edit/bash действиями.
- Реализовать completion gate через `verify → complete`.
- Реализовать CLI-команды для типовых workflows.

---

## 4. Non-Goals

На первом этапе проект **не должен** решать следующие задачи:

- Полностью автономное изменение production-кода без участия пользователя.
- Автоматический merge/push без явного подтверждения.
- Замена CI/CD системы.
- Замена issue tracker / Jira / Confluence.
- Обучение собственной LLM.
- Полноценная IDE.
- Live multi-agent execution без deterministic checkpoints.

---

## 5. Core Concepts

## 5.1 SFA Synapse

**SFA Synapse** — главный orchestrator системы.

Он отвечает за:

- анализ пользовательской задачи;
- определение типа задачи и сложности;
- запуск context discovery;
- инициализацию рабочей сессии;
- делегирование planning в TaskManager;
- запуск rule-based routing;
- координацию subagents;
- запуск validation и handoff.

Важно: **SFA Synapse не пишет production-код напрямую**. Он управляет процессом и делегирует реализацию специализированным subagents.

---

## 5.2 TaskManager

**TaskManager** — planning subagent.

Он не является кодирующим агентом. Его задача — превратить сложную пользовательскую задачу в набор подзадач с явными критериями выполнения.

TaskManager создает структуру:

```text
.tmp/tasks/{feature}/
  task.json
  subtask_01.json
  subtask_02.json
  subtask_03.json
  verification/
```

Каждая подзадача должна содержать:

- `id`;
- `title`;
- `description`;
- `scope`;
- `owner_agent`;
- `dependencies`;
- `deliverables`;
- `acceptance_criteria`;
- `verification_spec`;
- `status`.

---

## 5.3 Rule-Based Routing Engine

Routing Engine выбирает исполнителя на основе deterministic rules.

Принцип:

```text
Input facts + routing-rules.json → matched rule → action → subagent
```

Примеры input facts:

```json
{
  "repo_type": "js",
  "file_extension": ".tsx",
  "task_type": "coding",
  "operation_type": "edit",
  "context": "add React component",
  "branch_status": true,
  "has_dependency": false
}
```

Routing не должен зависеть от свободного LLM-рассуждения. LLM может помогать построить input facts, но финальное решение должно приниматься rule engine.

---

## 5.4 Subagents

Subagents — специализированные исполнители.

Основные группы:

1. **Core subagents**
   - ContextScout
   - ExternalScout
   - TaskManager
   - Documentation
   - ConfluenceScout

2. **Development subagents**
   - FrontendDeveloper
   - ComponentSmith
   - DesignBlender
   - NodeJsDeveloper
   - JavaDeveloper
   - BpmnCamundaGenerator
   - CodingTaskSpecGenerator
   - RepoChecker
   - RepoSeeder

3. **Code / Validation subagents**
   - CoderAgent
   - Reviewer
   - BuildAgent

4. **Testing subagents**
   - PlaywrightTestGenerator

---

## 5.5 Memory Service

Memory Service хранит durable project knowledge:

- tech stack;
- архитектурные паттерны;
- conventions;
- domain rules;
- stable decisions;
- integration points.

Memory Service не должен хранить:

- secrets;
- transient state;
- raw chunks без нормализации;
- временные выводы;
- содержимое конкретных файлов без необходимости.

---

## 6. Target Architecture

```text
┌────────────────────────────────────────────────────────────────┐
│                         User Task                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                     SFA Synapse Orchestrator                    │
│  Analyze → Discover → InitSession → Plan → GitSync → Execute    │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                       Context Layer                             │
│  Repo │ Memory Service │ Core Context │ Confluence │ External    │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                       TaskManager                               │
│       task.json + subtask_NN.json + verification_spec           │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                   Rule-Based Routing Engine                     │
│         routing-rules.json → ConditionEvaluator → AuditLogger   │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                         Subagents                               │
│ Frontend │ Java │ Node │ Playwright │ BPMN │ Reviewer │ Build    │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                    Verification / Completion Gate               │
│              task-cli.ts verify → task-cli.ts complete          │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Functional Requirements

## FR-1. SFA Synapse Orchestration

### Requirement

Система должна иметь главный orchestrator `SFA Synapse`, который принимает пользовательскую задачу и управляет полным workflow.

### Acceptance Criteria

- Orchestrator определяет `task_type`.
- Orchestrator определяет `complexity`.
- Orchestrator запускает context discovery.
- Orchestrator делегирует planning в TaskManager для complex tasks.
- Orchestrator не пишет код напрямую для implementation tasks.
- Orchestrator вызывает routing engine перед execution.
- Orchestrator инициирует validation перед handoff.

### DoD

- Есть файл `agent/core/sfa-synapse.md`.
- Описаны stage 0–6.
- Есть запрет на direct implementation.
- Есть сценарии happy path и failure path.

---

## FR-2. Context Discovery

### Requirement

Перед реализацией система должна собрать релевантный контекст.

### Источники контекста

- repository files;
- `context/core/standards/*`;
- Memory Service;
- Confluence;
- external documentation;
- project-specific files.

### Acceptance Criteria

- Для coding task загружается `code-quality.md`.
- Для testing task загружается `test-coverage.md`.
- Для documentation task загружается `documentation.md`.
- Для external library task вызывается ExternalScout / Context7.
- Для Confluence-related task вызывается ConfluenceScout.

### DoD

- Есть `ContextScout`.
- Есть deterministic source routing policy.
- Есть fallback strategy при недоступности источника.
- Ошибка context loading не скрывается.

---

## FR-3. TaskManager Planning

### Requirement

Сложные задачи должны разбиваться на подзадачи.

### Acceptance Criteria

- Complex task создает `task.json`.
- Каждая подзадача имеет explicit owner agent.
- Есть dependencies между подзадачами.
- Есть acceptance criteria для каждой подзадачи.
- Есть verification spec.

### DoD

- Реализован формат `task.json`.
- Реализован формат `subtask_NN.json`.
- Есть CLI для `status`, `verify`, `complete`.
- Есть тестовые fixtures.

---

## FR-4. Rule-Based Routing

### Requirement

Система должна маршрутизировать задачи через deterministic rule engine.

### Acceptance Criteria

- Routing rules хранятся в `context/core/rules/routing-rules.json`.
- Каждое правило имеет `id`, `priority`, `condition`, `action`, `target_agent`.
- Правила сортируются по priority descending.
- Первое matched правило выбирается как routing decision.
- Routing decision логируется.

### DoD

- Есть JSON schema для routing rules.
- Есть ConditionEvaluator.
- Есть AuditLogger.
- Есть сценарии `routing-rules.scenarios.json`.
- Есть negative tests для ambiguous routing.

---

## FR-5. Approval Gate

### Requirement

Write/edit/bash операции должны требовать подтверждения пользователя.

### Acceptance Criteria

- `operation_type in [write, edit, bash]` вызывает `REQUEST_APPROVAL`.
- После approval routing выполняется повторно.
- Без approval операция не выполняется.
- Approval decision логируется.

### DoD

- Есть rule `approval-gate` с высоким priority.
- Есть тесты на блокировку write/edit/bash.
- Есть явное сообщение пользователю перед изменением состояния.

---

## FR-6. Subagent Execution

### Requirement

Execution должен выполняться специализированным subagent в зависимости от routing decision.

### Acceptance Criteria

- `.tsx` задачи маршрутизируются во FrontendDeveloper / ComponentSmith.
- Java задачи маршрутизируются в JavaDeveloper.
- Node.js задачи маршрутизируются в NodeJsDeveloper.
- Playwright задачи маршрутизируются в PlaywrightTestGenerator.
- BPMN/Camunda задачи маршрутизируются в BpmnCamundaGenerator.
- Review задачи маршрутизируются в Reviewer.
- Build/test validation задачи маршрутизируются в BuildAgent.

### DoD

- Есть agent files для всех MVP subagents.
- Каждый subagent имеет scope, responsibilities, constraints, input/output contract.
- Есть smoke scenarios для каждого subagent.

---

## FR-7. Completion Gate

### Requirement

Система не должна заявлять “готово” без deterministic verification.

### Acceptance Criteria

- Перед handoff вызывается `task-cli.ts verify`.
- После успешного verify вызывается `task-cli.ts complete`.
- Если verify failed — задача не переводится в completed.
- Verification evidence сохраняется в `verification/`.

### DoD

- Есть task CLI.
- Есть verification artifacts.
- Есть status model: `pending`, `in_progress`, `completed`, `cancelled`, `failed`.
- Есть тесты на запрет premature completion.

---

## FR-8. Audit Logging

### Requirement

Все routing decisions и важные lifecycle events должны логироваться.

### Acceptance Criteria

- Routing decision пишет JSONL event.
- Event содержит `timestamp`, `session_id`, `input_facts`, `matched_rule`, `action`, `agent`.
- Approval events логируются.
- Verification results логируются.

### DoD

- Есть `.tmp/audit/routing/{date}/{session}.jsonl`.
- JSONL формат стабилен.
- Есть parser/validator audit logs.

---

## FR-9. Memory Service Integration

### Requirement

Система должна уметь читать и сохранять durable project knowledge.

### Acceptance Criteria

- Есть schema для memory entry.
- Поддерживаются типы: `tech-stack`, `pattern`, `convention`, `decision`, `domain`.
- Секреты не сохраняются.
- Raw doc chunks не сохраняются как durable memory.
- Memory capture выполняется после анализа проекта.

### DoD

- Есть `memory-entry.schema.json`.
- Есть `memory-routing-policy.json`.
- Есть validation memory entries.
- Есть redaction/safety checks перед записью.

---

## FR-10. CLI Commands

### Requirement

Платформа должна предоставлять команды для типовых операций.

### MVP Commands

- `/add-context`
- `/context`
- `/commit`
- `/clean`
- `/test`
- `/validate-repo`
- `/analyze-patterns`
- `/optimize`
- `/check-context-deps`

### Acceptance Criteria

- Каждая команда имеет markdown spec.
- У каждой команды есть input contract.
- У каждой команды есть output contract.
- Опасные команды соблюдают approval gate.

### DoD

- Все command files находятся в `command/`.
- Есть examples.
- Есть validation checklist.

---

## 8. Non-Functional Requirements

## NFR-1. Determinism

- Routing должен быть воспроизводимым.
- JSON rules должны иметь schema validation.
- При одинаковых input facts routing decision должен быть одинаковым.

## NFR-2. Observability

- Все routing decisions логируются.
- Ошибки context discovery не скрываются.
- Verification failure возвращает понятную причину.

## NFR-3. Safety

- Write/edit/bash только через approval gate.
- Secrets не сохраняются в Memory Service.
- Перед disk writes должен быть redaction layer для debug artifacts.

## NFR-4. Maintainability

- Каждый agent/subagent описан отдельным markdown-файлом.
- Routing rules отделены от кода.
- Standards и workflows хранятся в `context/core/`.

## NFR-5. Extensibility

- Новый subagent можно добавить без изменения SFA Synapse.
- Новое routing rule можно добавить через JSON.
- Новый skill можно добавить в `skills/`.

---

## 9. Proposed Repository Structure

```text
agentic-flow-playbook/
├── agent/
│   ├── core/
│   │   ├── sfa-synapse.md
│   │   └── rules-engine/
│   │       ├── routing-engine.md
│   │       ├── condition-evaluator.md
│   │       └── audit-logger.md
│   └── subagents/
│       ├── core/
│       ├── development/
│       ├── code/
│       └── testing/
├── command/
├── context/
│   └── core/
│       ├── config/
│       ├── rules/
│       ├── standards/
│       ├── workflows/
│       └── context-system/
├── skills/
├── instructions/
├── scripts/
├── fixtures/
├── verification/
├── AGENTS.md
├── README.md
├── TESTING.md
└── opencode.jsonc.example
```

---

## 10. Implementation Plan

## Phase 0. Foundation

### Scope

- Создать базовую структуру репозитория.
- Описать top-level README.
- Описать AGENTS.md.
- Описать базовые standards.

### Deliverables

- `README.md`
- `AGENTS.md`
- `context/core/standards/code-quality.md`
- `context/core/standards/documentation.md`
- `context/core/standards/test-coverage.md`
- `context/core/standards/security-patterns.md`

### DoD

- Структура проекта создана.
- Все базовые документы доступны.
- `validate-repo` проверяет наличие обязательных файлов.

---

## Phase 1. SFA Synapse MVP

### Scope

- Реализовать spec для SFA Synapse.
- Описать 6-stage workflow.
- Запретить direct implementation.
- Описать handoff protocol.

### Deliverables

- `agent/core/sfa-synapse.md`
- `context/core/workflows/delegation.md`
- `context/core/workflows/feature-breakdown.md`

### DoD

- Есть понятный execution lifecycle.
- Есть explicit delegation rule.
- Есть failure handling.

---

## Phase 2. Rule-Based Routing MVP

### Scope

- Реализовать routing rules schema.
- Реализовать initial routing rules.
- Реализовать ConditionEvaluator spec.
- Реализовать AuditLogger spec.

### Deliverables

- `context/core/rules/routing-rules.json`
- `context/core/rules/routing-rules.schema.json`
- `context/core/rules/routing-rules.scenarios.json`
- `agent/core/rules-engine/routing-engine.md`
- `agent/core/rules-engine/condition-evaluator.md`
- `agent/core/rules-engine/audit-logger.md`

### DoD

- Есть минимум 10 routing rules.
- Есть approval-gate rule.
- Есть scenarios для проверки routing.
- Есть audit log format.

---

## Phase 3. Core Subagents

### Scope

- Реализовать ContextScout.
- Реализовать TaskManager.
- Реализовать ExternalScout.
- Реализовать Documentation.
- Реализовать ConfluenceScout.

### Deliverables

- `agent/subagents/core/contextscout.md`
- `agent/subagents/core/task-manager.md`
- `agent/subagents/core/externalscout.md`
- `agent/subagents/core/documentation.md`
- `agent/subagents/core/confluence-scout.md`

### DoD

- Каждый subagent имеет contract.
- TaskManager умеет создавать task/subtask schema.
- ContextScout умеет выбирать context sources.

---

## Phase 4. Execution Subagents MVP

### Scope

- Реализовать development/code/testing subagents.

### Deliverables

- `frontend-developer.md`
- `component-smith.md`
- `nodejs-developer.md`
- `java-developer.md`
- `playwright-test-generator.md`
- `reviewer.md`
- `build-agent.md`

### DoD

- Каждый subagent имеет scope boundaries.
- Каждый subagent описывает required context.
- Каждый subagent описывает output format.

---

## Phase 5. Task CLI + Completion Gate

### Scope

- Реализовать task lifecycle.
- Реализовать verify/complete semantics.
- Реализовать verification artifacts.

### Deliverables

- `scripts/task-cli.ts`
- `context/core/workflows/verification-before-completion.md`
- `verification/README.md`

### DoD

- `verify` проверяет evidence.
- `complete` запрещен без успешного verify.
- Есть тесты на stale evidence.
- Есть clear failure reasons.

---

## Phase 6. Memory Service Integration

### Scope

- Реализовать memory schema.
- Реализовать routing policy.
- Реализовать memory capture rules.

### Deliverables

- `context/core/config/memory-entry.schema.json`
- `context/core/config/memory-routing-policy.json`
- `context/core/context-system/guides/memory-capture.md`

### DoD

- Есть allowed memory types.
- Есть forbidden memory types.
- Есть validation перед store.
- Есть examples.

---

## Phase 7. Commands and Skills

### Scope

- Реализовать command specs.
- Реализовать skills specs.

### Deliverables

- `command/*.md`
- `skills/*/README.md`
- `instructions/skill-template.md`
- `instructions/subagent-template.md`

### DoD

- Все команды документированы.
- Все skills имеют input/output contract.
- Есть validation для required skill fields.

---

## Phase 8. Test Fixtures and Validation

### Scope

- Создать fixtures для routing, planning, context discovery, completion gate.

### Deliverables

- `fixtures/routing/`
- `fixtures/tasks/`
- `fixtures/context/`
- `TESTING.md`

### DoD

- Есть regression tests для routing.
- Есть negative tests для approval gate.
- Есть tests для verify/complete.
- Есть validate-repo command.

---

## 11. MVP Scope

MVP должен закрывать следующие сценарии:

1. Frontend task → ContextScout → TaskManager → FrontendDeveloper → BuildAgent → Completion Gate.
2. Playwright task → ContextScout → PlaywrightTestGenerator → BuildAgent → Completion Gate.
3. Java task → ContextScout → JavaDeveloper → BuildAgent → Completion Gate.
4. Documentation task → Documentation subagent → Completion Gate.
5. Code review task → Reviewer → Handoff.
6. Read-only task → direct execution без approval.
7. Write/edit/bash task → approval gate.

---

## 12. Data Contracts

## 12.1 Routing Rule

```json
{
  "id": "mandatory-frontend-routing",
  "priority": 100,
  "description": "Route TSX tasks to FrontendDeveloper",
  "condition": {
    "all": [
      { "field": "repo_type", "op": "eq", "value": "js" },
      { "field": "file_extension", "op": "in", "value": [".tsx", ".ts"] }
    ]
  },
  "action": "DELEGATE",
  "target_agent": "FrontendDeveloper"
}
```

## 12.2 Task File

```json
{
  "feature_id": "feature-login-screen",
  "title": "Implement login screen",
  "status": "in_progress",
  "created_at": "2026-05-18T10:00:00Z",
  "subtasks": ["subtask_01", "subtask_02"],
  "acceptance_criteria": [
    "Login screen is implemented",
    "E2E test covers successful login",
    "Type-check and lint pass"
  ]
}
```

## 12.3 Subtask File

```json
{
  "id": "subtask_01",
  "title": "Implement React login component",
  "owner_agent": "FrontendDeveloper",
  "status": "pending",
  "dependencies": [],
  "deliverables": [
    "src/features/login/LoginPage.tsx"
  ],
  "verification_spec": {
    "commands": ["pnpm type:check", "pnpm lint"],
    "files_must_exist": ["src/features/login/LoginPage.tsx"]
  }
}
```

## 12.4 Audit Event

```json
{
  "timestamp": "2026-05-18T10:30:00Z",
  "session_id": "2026-05-18-feature-login",
  "input_facts": {
    "repo_type": "js",
    "file_extension": ".tsx",
    "task_type": "coding",
    "operation_type": "edit"
  },
  "matched_rule": "mandatory-frontend-routing",
  "action": "DELEGATE",
  "agent": "FrontendDeveloper"
}
```

## 12.5 Memory Entry

```json
{
  "content": "Project uses React Router v6 with nested routes in components/router.tsx",
  "tags": ["project:example-ui", "type:tech-stack", "react-router"],
  "memory_type": "note",
  "metadata": {
    "project": "example-ui",
    "category": "routing",
    "source": "repo-analysis",
    "confidence": "verified",
    "updated_at": "2026-05-18"
  }
}
```

---

## 13. Validation Strategy

## 13.1 Unit-Level Validation

- Validate routing rules against JSON schema.
- Validate memory entries against JSON schema.
- Validate task/subtask files.
- Validate condition evaluator operators.

## 13.2 Scenario Tests

Scenarios:

- frontend `.tsx` task routes to FrontendDeveloper;
- `.java` task routes to JavaDeveloper;
- Playwright task routes to PlaywrightTestGenerator;
- write operation triggers approval gate;
- read-only operation executes directly;
- failed verification blocks completion;
- missing context creates explicit warning.

## 13.3 Repository Validation

`/validate-repo` checks:

- required directories exist;
- required agent files exist;
- routing rules reference existing agents;
- command specs exist;
- skills follow template;
- standards files exist;
- schemas are valid JSON.

---

## 14. Observability

Минимальный набор observable artifacts:

```text
.tmp/sessions/{session-id}/context.md
.tmp/tasks/{feature}/task.json
.tmp/tasks/{feature}/subtask_NN.json
.tmp/audit/routing/{date}/{session}.jsonl
verification/{feature}/evidence.json
verification/{feature}/commands.log
```

Каждый handoff должен содержать:

- что было сделано;
- какие subagents участвовали;
- какие проверки прошли;
- какие проверки не прошли;
- какие файлы изменены;
- какие риски остались.

---

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---:|---|
| Система станет слишком тяжелой для простых задач | High | Ввести fast path для read-only/simple tasks |
| Routing rules будут конфликтовать | Medium | Priority bands + scenario tests + schema validation |
| Memory Service будет загрязняться мусором | High | Strict memory schema + allowed/forbidden types + review before write |
| Агенты будут игнорировать стандарты | Medium | Context-first loading + completion gate |
| Premature “done” claims | High | verify → complete mandatory gate |
| Секреты попадут в logs/memory | High | Redaction layer before artifacts and memory writes |
| Confluence/external docs недоступны | Medium | Fallback strategy + explicit degraded mode |
| Слишком много approval prompts | Medium | Operation classification + batch approval for scoped changes |

---

## 16. Open Questions

1. Какие операции должны считаться `bash` high-risk, а какие можно разрешить как safe read-only?
2. Нужно ли поддерживать batch approval для нескольких файлов сразу?
3. Где физически должен жить Memory Service: локально, в MCP-сервисе или в корпоративной БД?
4. Нужна ли интеграция с Jira/Bitbucket на MVP-этапе?
5. Должен ли TaskManager создавать задачи только локально или синхронизировать их с внешним task tracker?
6. Нужны ли разные режимы строгости: `fast`, `standard`, `strict`?
7. Какие метрики качества считать основными: completion success rate, verification pass rate, rollback rate, user acceptance rate?

---

## 17. Success Metrics

## Product Metrics

- Доля задач, доведенных до verified completion.
- Доля задач, принятых пользователем без ручной доработки.
- Среднее время от task input до handoff.
- Количество premature completion incidents.
- Количество failed routing incidents.

## Engineering Metrics

- Routing rule coverage.
- Scenario test pass rate.
- Verification pass rate.
- Количество memory validation failures.
- Количество blocked unsafe operations.
- Доля subagent outputs с валидным contract.

---

## 18. Rollout Plan

## Stage 1. Local MVP

- Запуск только локально.
- Без автоматического push.
- Без production integrations.
- Manual approval для write/edit/bash.

## Stage 2. Team Pilot

- Использование на 1–2 внутренних репозиториях.
- Сбор routing failures.
- Сбор verification failures.
- Уточнение standards и workflows.

## Stage 3. Enterprise Pilot

- Подключение Confluence / Memory Service.
- Подключение Bitbucket/GitLab workflows.
- Добавление audit review.
- Поддержка нескольких стеков.

## Stage 4. Production Hardening

- Полный validation suite.
- Security review.
- Redaction layer.
- Stable release process.
- Documentation and onboarding.

---

## 19. Implementation Backlog

## P0 — Must Have

- SFA Synapse spec.
- Rule-Based Routing Engine spec.
- routing-rules schema.
- approval gate.
- ContextScout.
- TaskManager.
- FrontendDeveloper.
- JavaDeveloper.
- PlaywrightTestGenerator.
- Reviewer.
- BuildAgent.
- task-cli verify/complete.
- audit log format.
- validate-repo command.

## P1 — Should Have

- Memory Service integration.
- ConfluenceScout.
- ExternalScout / Context7.
- `/clean`, `/test`, `/commit` commands.
- skill templates.
- subagent templates.
- scenario fixtures.

## P2 — Could Have

- BatchExecutor.
- RepoSeeder.
- RepoChecker.
- BPMN/Camunda generator.
- Figma MCP workflow.
- Advanced optimization command.
- Metrics dashboard.

---

## 20. Definition of Ready

Feature считается ready для реализации, если:

- есть понятный user/problem statement;
- определен task type;
- определен expected output;
- известны relevant context sources;
- определены affected components;
- есть acceptance criteria;
- есть verification method;
- нет unresolved blocker questions.

---

## 21. Definition of Done

Feature считается done, если:

- все planned subtasks завершены;
- все deliverables созданы;
- routing decisions залогированы;
- verification evidence создан;
- `task-cli.ts verify` успешен;
- `task-cli.ts complete` успешен;
- handoff содержит summary, changed files, checks, risks;
- нет незадекларированных failed checks.

---

## 22. Recommended First Milestone

Первый milestone должен быть максимально узким:

```text
User task: “Add simple React component and Playwright test”
```

Система должна пройти полный pipeline:

```text
SFA Synapse
  → ContextScout
  → TaskManager
  → Rule-Based Routing
  → FrontendDeveloper
  → PlaywrightTestGenerator
  → BuildAgent
  → verify
  → complete
  → handoff
```

Это даст end-to-end proof, что архитектура работает не только как набор markdown-инструкций, но как связанный workflow.

---

## 23. Appendix: Minimal Routing Rules for MVP

| Priority | Rule ID | Condition | Action |
|---:|---|---|---|
| 200 | approval-gate | operation_type in write/edit/bash | REQUEST_APPROVAL |
| 150 | playwright-test-routing | task_type = playwright_test | DELEGATE PlaywrightTestGenerator |
| 140 | bpmn-generation-routing | context contains BPMN/Camunda | DELEGATE BpmnCamundaGenerator |
| 130 | confluence-documentation-routing | context contains Confluence/PEGA | DELEGATE ConfluenceScout |
| 100 | mandatory-frontend-routing | repo_type=js and file_extension in .tsx/.ts | DELEGATE FrontendDeveloper |
| 100 | mandatory-backend-routing | repo_type=java and file_extension=.java | DELEGATE JavaDeveloper |
| 95 | task-planning-routing | task_type=coding and complexity=complex | DELEGATE TaskManager |
| 90 | repo-discovery-routing | context contains find repositories | DELEGATE RepoChecker |
| 85 | repo-seeding-routing | context contains create repository | DELEGATE RepoSeeder |
| 80 | documentation-routing | task_type=documentation | DELEGATE Documentation |
| 80 | code-review-routing | context contains review | DELEGATE Reviewer |
| 80 | build-validation-routing | context contains build/test/validate | DELEGATE BuildAgent |
| 10 | read-only-execution | operation_type in read/list/grep | EXECUTE_DIRECT |

---

## 24. Appendix: Recommended Strictness Modes

## Fast Mode

Для read-only и простых задач.

- Context loading минимальный.
- TaskManager не обязателен.
- Completion gate упрощенный.

## Standard Mode

Для обычной разработки.

- ContextScout обязателен.
- Routing обязателен.
- Verification обязательна.

## Strict Mode

Для enterprise-critical задач.

- Full context discovery.
- TaskManager обязателен.
- Approval gate обязателен.
- Reviewer обязателен.
- BuildAgent обязателен.
- Full audit trail обязателен.

---

## 25. Final Recommendation

Реализацию стоит начинать не с большого набора subagents, а с **вертикального end-to-end MVP**:

1. SFA Synapse.
2. ContextScout.
3. TaskManager.
4. Routing Engine.
5. 2–3 execution subagents.
6. BuildAgent.
7. Completion Gate.
8. Audit Log.

После этого можно расширять покрытие через новые routing rules, subagents, commands и skills.
