# Provider and Data Classification Policy

## Data classes

| Class | Examples | Allowed providers |
| --- | --- | --- |
| public | OSS docs, public code, public package metadata | OpenRouter, Ollama, optional providers |
| internal | non-secret repo code, internal docs approved for model use | OpenRouter with approval, Ollama |
| confidential | customer data, private business logic, unreleased strategy | Ollama/local only unless explicit human approval |
| secret | API keys, tokens, passwords, private keys, env values | no model provider; never log or store |

## Provider matrix

| Provider | Default | Suitable data | Notes |
| --- | --- | --- | --- |
| OpenRouter | enabled by config, requires env key | public; internal after approval | External provider risk. Do not send secrets. |
| Ollama | fallback | public/internal/confidential | Local runtime; still avoid secrets in prompts/logs. |
| Brave Search MCP | disabled | public queries only | Requires `BRAVE_API_KEY` env. |
| DuckDuckGo MCP | disabled | public queries only | Network dependency, no secrets. |
| Browser/Colab/Obsidian MCP | disabled | local opt-in only | User must approve local path/data exposure. |

## Approval gate

Approval is required before sending confidential/internal-sensitive data to an external provider. Secret data must be blocked, not approved.

Approval must record:

- data class;
- provider;
- reason;
- scope;
- whether redaction is applied.

## Runtime rules

- Secrets only through env and local config.
- Never write env values to docs, audit, task files, memory, or verification artifacts.
- If classification is unclear, treat as confidential and stop in `blocked`.
- Use Ollama/local flow for confidential code/data when possible.

## Validation

```bash
npm run scan:secrets
npm run validate:audit
```
