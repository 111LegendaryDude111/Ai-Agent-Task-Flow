# Testing

Run the MVP validation suite from repository root:

```bash
python3 scripts/validate_routing_rules.py --context-root context/core
python3 scripts/validate_memory_routing_policy.py --config-root context/core/config
python3 scripts/lint_json.py --context-root context/core
python3 scripts/generate_coverage_report.py --context-root context/core
python3 scripts/run_task_cli_e2e.py
```

Expected result:

- routing schema valid;
- all routing scenarios pass;
- routing coverage is 100%;
- memory/source policy scenarios pass;
- task CLI E2E passes.
