# Model Setup

Default runtime uses OpenRouter. Local Ollama is available as fallback.

## OpenRouter

`opencode.jsonc.example` uses:

```text
model: openrouter/deepseek/deepseek-v4-flash
provider: openrouter
baseURL: https://openrouter.ai/api/v1
apiKey: {env:OPENROUTER_API_KEY}
```

Set the key locally only:

```bash
export OPENROUTER_API_KEY="..."
```

Do not commit real keys.

## Portable config

Create local config from the portable example:

```bash
cp opencode.jsonc.example opencode.jsonc
```

Prompt paths are repository-relative (`{file:./agent/...}`). Optional MCP servers are disabled by default. Enable them only after local prerequisites and env placeholders are configured.

## Permissions profile

- `synapse`: orchestrates with `edit/write: deny`.
- Matched implementation/documentation/test subagents: `edit/write: allow` inside the target repo after task approval.
- Read-only agents: `edit/write: deny`.
- Safe read-only `bash`: `pwd`, `ls *`, `rg *`, `grep *`, `git status*`, `git diff*`.
- Other shell/delete/install/network/destructive git/outside-repo/secrets operations: approval required.

## Optional MCP servers

All optional MCP servers are opt-in:

- `browser` for Playwright MCP;
- `obsidian` with `OBSIDIAN_VAULT_PATH`;
- `colab-proxy-mcp` with local `uvx`;
- `brave-search` with `BRAVE_API_KEY`;
- `duckduckgo-search` without API key but with network/tooling risk.

Enable only in local config and never commit secrets.

## Ollama fallback

Check local Ollama:

```bash
ollama --version
ollama list
curl http://127.0.0.1:11434/v1/models
```

Pull a supported model if needed:

```bash
ollama pull qwen3:4b
```

Then switch local config model to:

```text
model: local-ollama/qwen3:4b
```

## Prerequisites

- Node.js 22+ for npm scripts and Task CLI.
- Python 3.11+ for validators.
- `pip install -r scripts/requirements.txt` for JSON Schema validation.
- `npm ci` for local `ts-node` / `typescript` runtime.

## Validation

```bash
npm run validate
```
