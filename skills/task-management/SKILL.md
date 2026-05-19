---
name: task-management
description: Task management CLI for tracking and managing feature subtasks with status, dependencies, and validation
version: 1.0.0
author: opencode
type: skill
category: development
tags:
  - tasks
  - management
  - tracking
  - dependencies
  - cli
---

# Task Management Skill

> **Purpose**: Track, manage, and validate feature implementations with atomic task breakdowns, dependency resolution, and progress monitoring.

---

## What I Do

I provide a command-line interface for managing task breakdowns created by the TaskManager subagent. I help you:

- **Track progress** - See status of all features and their subtasks
- **Find next tasks** - Show eligible tasks (dependencies satisfied)
- **Identify blocked tasks** - See what's blocked and why
- **Manage verification** - Save deterministic verification evidence before completion
- **Manage completion** - Close subtasks only after fresh verification
- **Validate integrity** - Check JSON files and dependency trees

---

## How to Use Me

### Quick Start

```bash
# Show all task statuses
bash skills/task-management/router.sh status

# Show next eligible tasks
bash skills/task-management/router.sh next

# Show blocked tasks
bash skills/task-management/router.sh blocked

# Verify a task
bash skills/task-management/router.sh verify <feature> <seq>

# Complete a verified task
bash skills/task-management/router.sh complete <feature> <seq> "summary"

# Verify the whole feature
bash skills/task-management/router.sh verify-feature <feature>

# Archive the verified feature
bash skills/task-management/router.sh archive <feature>

# Validate all tasks
bash skills/task-management/router.sh validate
```

### Command Reference

| Command | Description |
|---------|-------------|
| `status [feature]` | Show task status summary for all features or specific one |
| `next [feature]` | Show next eligible tasks (dependencies satisfied) |
| `parallel [feature]` | Show parallelizable tasks ready to run |
| `deps <feature> <seq>` | Show dependency tree for a specific subtask |
| `blocked [feature]` | Show blocked tasks and why |
| `verify <feature> <seq>` | Run verification gate and save evidence |
| `complete <feature> <seq> "summary"` | Complete subtask using saved verification evidence |
| `verify-feature <feature>` | Run feature-level verification and save evidence |
| `archive <feature>` | Archive feature after successful feature verification |
| `validate [feature]` | Validate JSON files and dependencies |
| `help` | Show help message |

---

## Examples

### Check Overall Progress

```bash
$ bash skills/task-management/router.sh status

[my-feature] My Feature Implementation
  Status: active | Progress: 45% (5/11)
  Pending: 3 | In Progress: 2 | Completed: 5 | Blocked: 1
```

### Find What's Next

```bash
$ bash skills/task-management/router.sh next

=== Ready Tasks (deps satisfied) ===

[my-feature]
  06 - Implement API endpoint [sequential]
  08 - Write unit tests [parallel]
```

### Verify Then Complete

```bash
$ bash skills/task-management/router.sh verify my-feature 05

✅ VERIFIED: my-feature/05
  Spec Hash: sha256:...
  Next step: run complete with a summary to close the subtask.

$ bash skills/task-management/router.sh complete my-feature 05 "Implemented authentication module"

✅ COMPLETED: my-feature/05
  Summary: Implemented authentication module
  Progress: 6/11
```

### Check Dependencies

```bash
$ bash skills/task-management/router.sh deps my-feature 07

=== Dependency Tree: my-feature/07 ===

07 - Write integration tests [pending]
  ├── ✓ 05 - Implement authentication module [completed]
  └── ○ 06 - Implement API endpoint [in_progress]
```

### Validate Everything

```bash
$ bash skills/task-management/router.sh validate

=== Validation Results ===

[my-feature]
  ✓ All checks passed
```

---

## Architecture

```
skills/task-management/
├── SKILL.md                          # This file
├── router.sh                         # CLI router (entry point)
└── scripts/
    └── task-cli.ts                   # Task management CLI implementation
```

---

## Task File Structure

Tasks are stored in `.tmp/tasks/` at the project root:

```
.tmp/tasks/
├── {feature-slug}/
│   ├── task.json                     # Feature-level metadata
│   ├── subtask_01.json               # Subtask definitions
│   ├── subtask_02.json
│   └── ...
└── completed/
    └── {feature-slug}/               # Completed tasks
```

### task.json Schema

```json
{
  "id": "my-feature",
  "name": "My Feature",
  "status": "active",
  "objective": "Implement X",
  "context_files": ["docs/spec.md"],
  "reference_files": ["src/existing.ts"],
  "exit_criteria": ["Tests pass", "Code reviewed"],
  "verification_spec": {
    "commands": [
      { "id": "feature-tests", "run": "npm test", "expect_exit_code": 0 }
    ]
  },
  "subtask_count": 5,
  "completed_count": 2,
  "created_at": "2026-01-11T10:00:00Z",
  "completed_at": null,
  "verification": null
}
```

### subtask_##.json Schema

```json
{
  "id": "my-feature-05",
  "seq": "05",
  "title": "Implement authentication",
  "status": "pending",
  "depends_on": ["03", "04"],
  "parallel": false,
  "suggested_agent": "coder-agent",
  "context_files": ["docs/auth.md"],
  "reference_files": ["src/auth-old.ts"],
  "acceptance_criteria": ["Login works", "JWT tokens valid"],
  "deliverables": ["auth.ts", "auth.test.ts"],
  "verification_spec": {
    "deliverables_must_exist": ["auth.ts", "auth.test.ts"],
    "deliverables_must_change": ["auth.ts", "auth.test.ts"],
    "commands": [
      { "id": "unit-tests", "run": "npm test -- auth", "expect_exit_code": 0 }
    ],
    "checks": [
      { "id": "no-todo", "type": "grep_absent", "path": "auth.ts", "pattern": "TODO|FIXME" }
    ]
  },
  "started_at": null,
  "completed_at": null,
  "completion_summary": null
}
```

---

## Integration with TaskManager

The TaskManager subagent creates task files using this format. When you delegate to TaskManager:

```javascript
task(
  subagent_type="TaskManager",
  description="Implement feature X",
  prompt="Break down this feature into atomic subtasks..."
)
```

TaskManager creates:
1. `.tmp/tasks/{feature}/task.json` - Feature metadata
2. `.tmp/tasks/{feature}/subtask_XX.json` - Individual subtasks

You can then use this skill to track and manage progress.

---

## Key Concepts

### 1. Dependency Resolution
Subtasks can depend on other subtasks. A task is "ready" only when all its dependencies are complete.

### 2. Parallel Execution
Set `parallel: true` to indicate a subtask can run alongside other parallel tasks with satisfied dependencies.

### 3. Status Tracking
- **pending** - Not started, waiting for dependencies
- **in_progress** - Currently being worked on
- **completed** - Finished and successfully verified
- **blocked** - Explicitly blocked (not waiting for deps)

### 4. Exit Criteria
Each feature has exit_criteria that must be met before marking the feature complete.

### 5. Validation Rules

The `validate` command performs comprehensive checks on task files:

**Task-Level Validation:**
- ✅ task.json file exists for the feature
- ✅ Task ID matches feature slug
- ✅ Subtask count in task.json matches actual subtask files
- ✅ All required fields are present
- ✅ task.json has feature-level verification_spec

**Subtask-Level Validation:**
- ✅ All subtask IDs start with feature name (e.g., "my-feature-01")
- ✅ Sequence numbers are unique and properly formatted (01, 02, etc.)
- ✅ All dependencies reference existing subtasks
- ✅ No circular dependencies exist
- ✅ Each subtask has acceptance criteria defined
- ✅ Each subtask has deliverables specified
- ✅ Each subtask has deterministic verification_spec
- ✅ Status values are valid (pending, in_progress, completed, blocked)
- ✅ Completed subtasks have successful verification data

**Dependency Validation:**
- ✅ All depends_on references point to existing subtasks
- ✅ No task depends on itself
- ✅ No circular dependency chains
- ✅ Dependency graph is acyclic

Run `validate` regularly to catch issues early:
```bash
bash skills/task-management/router.sh validate my-feature
```

### 6. Context and Reference Files
- **context_files** - Standards, conventions, and guidelines to follow
- **reference_files** - Existing project files to look at or build upon

---

## Workflow Integration

### With TaskManager Subagent

1. **TaskManager creates tasks** → Generates `.tmp/tasks/{feature}/` structure
2. **You use this skill to track** → Monitor progress with `status`, `next`, `blocked`
3. **You verify tasks** → Use `verify` to save deterministic evidence
4. **You close verified tasks** → Use `complete` with a summary
5. **You verify the whole feature** → Use `verify-feature`
6. **You archive the verified feature** → Use `archive`
7. **Skill validates integrity** → Use `validate` to check consistency

### With Other Subagents

Working agents (CoderAgent, PlaywrightTestGenerator, etc.) execute subtasks and report completion. Use this skill to:
- Find next available tasks with `next`
- Check what's blocking progress with `blocked`
- Validate task definitions with `validate`

---

## Common Workflows

### Starting a New Feature

```bash
# 1. TaskManager creates the task structure
task(subagent_type="TaskManager", description="Implement feature X", ...)

# 2. Check what's ready
bash skills/task-management/router.sh next

# 3. Delegate first task to working agent
task(subagent_type="CoderAgent", description="Implement subtask 01", ...)
```

### Tracking Progress

```bash
# Check overall status
bash skills/task-management/router.sh status my-feature

# See what's next
bash skills/task-management/router.sh next my-feature

# Check what's blocked
bash skills/task-management/router.sh blocked my-feature
```

### Completing Tasks

```bash
# After working agent finishes and task is in_progress
bash skills/task-management/router.sh verify my-feature 05

# Then close the verified task
bash skills/task-management/router.sh complete my-feature 05 "Implemented auth module with JWT support"

# Verify the whole feature when all subtasks are done
bash skills/task-management/router.sh verify-feature my-feature

# Archive it only after feature verification succeeds
bash skills/task-management/router.sh archive my-feature

# Check progress
bash skills/task-management/router.sh status my-feature

# Find next task
bash skills/task-management/router.sh next my-feature
```

### Validating Everything

```bash
# Validate all tasks
bash skills/task-management/router.sh validate

# Validate specific feature
bash skills/task-management/router.sh validate my-feature
```

---

## Tips & Best Practices

### 1. Use Meaningful Summaries
When marking tasks complete, provide clear summaries after verification succeeds:
```bash
# Good
complete my-feature 05 "Implemented JWT authentication with refresh tokens and error handling"

# Avoid
complete my-feature 05 "Done"
```

### 2. Always Add `verification_spec`
- Each `subtask_XX.json` must define deterministic verification checks
- Each `task.json` must define feature-level verification before `archive`

### 2. Check Dependencies Before Starting
```bash
# See what a task depends on
bash skills/task-management/router.sh deps my-feature 07
```

### 3. Identify Parallelizable Work
```bash
# Find tasks that can run in parallel
bash skills/task-management/router.sh parallel my-feature
```

### 4. Regular Validation
```bash
# Validate regularly to catch issues early
bash skills/task-management/router.sh validate
```

---

## Troubleshooting

### "task-cli.ts not found"
Make sure you're running from the project root or the router.sh can find it.

### "No tasks found"
Run `status` to see if any tasks have been created yet. Use TaskManager to create tasks first.

### "Dependency not satisfied"
Check the dependency tree with `deps` to see what's blocking the task.

### "Validation failed"
Run `validate` to see specific issues, then check the JSON files in `.tmp/tasks/`.

---

## File Locations

- **Skill**: `skills/task-management/`
- **Router**: `skills/task-management/router.sh`
- **CLI**: `skills/task-management/scripts/task-cli.ts`
- **Tasks**: `.tmp/tasks/` (created by TaskManager)
- **Documentation**: `skills/task-management/SKILL.md` (this file)

---

**Task Management Skill** - Track, manage, and validate your feature implementations!
