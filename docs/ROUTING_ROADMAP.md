# Routing and Subagent Expansion Roadmap

This roadmap is intentionally separate from MVP runtime docs. Add scenarios before enabling new production routing rules.

## Prioritized candidate domains

| Priority | Domain | Expected facts | Owner subagent |
| --- | --- | --- | --- |
| 1 | Python/data engineering | `repo_type=python`, `.py`, data pipeline context | future PythonDataDeveloper |
| 2 | SQL/migrations | `.sql`, migration path, schema change context | future SqlMigrationDeveloper |
| 3 | DevOps/CI | workflow files, build/deploy context | future DevOpsCiDeveloper |
| 4 | API/spec design | OpenAPI/contract files, endpoint design context | future ApiSpecDesigner |
| 5 | Dependency update | package manifests, lockfiles, update request | future DependencyMaintainer |
| 6 | Security review | security-sensitive prompt, auth/crypto/secrets context | future SecurityReviewer |
| 7 | RAG/evaluation ML flows | retrieval/eval datasets, model eval context | extend `MLDeveloper` or future RagEvaluator |
| 8 | Node.js backend | server framework files, backend JS/TS context | future NodeBackendDeveloper |

## Scenario-first process

For each domain:

1. Add positive route scenario.
2. Add negative scenario for unknown/unsupported stack.
3. Add conflict scenario against approval, docs, review, and build rules.
4. Add permission profile.
5. Add subagent prompt contract.
6. Run:

   ```bash
   npm run validate:routing
   npm run coverage:routing
   ```

## Non-regression rule

Do not enable a new routing domain unless existing routing coverage remains 100% and approval-gate priority still wins for risky operations.
