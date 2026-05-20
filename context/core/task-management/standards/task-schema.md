# Task Schema

Task files live in `.tmp/tasks/{feature}/`.

Required files:

- `task.json`
- `subtask_NN.json`

JSON Schemas:

- `context/core/task-management/schemas/task.schema.json`
- `context/core/task-management/schemas/subtask.schema.json`

Runtime validation:

```bash
npm run task-cli -- validate <feature>
```

AutoFlow state is stored in the `autoflow` object on task/subtask artifacts. Required subtask gates before `verify` are:

- `context_discovery`
- `red`
- `green`
- `review`

`verify` records the verification gate; `complete` records the complete gate.
