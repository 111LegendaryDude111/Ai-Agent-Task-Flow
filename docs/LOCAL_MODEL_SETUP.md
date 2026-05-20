# Model Setup

Текущий runtime по умолчанию использует OpenRouter, а локальный Ollama оставлен как fallback.

## Default: OpenRouter

В актуальном `opencode.jsonc` используется:

```text
model: openrouter/deepseek/deepseek-v4-flash
provider: openrouter
baseURL: https://openrouter.ai/api/v1
apiKey: {env:OPENROUTER_API_KEY}
```

Ключ не хранится в репозитории. Добавь его локально:

```bash
export OPENROUTER_API_KEY="..."
```

Smoke test:

```bash
opencode run --agent synapse 'Ответь одним словом: ok'
```

Если модель не отвечает, проверь баланс/credit limit в OpenRouter и точный model id в каталоге OpenRouter.

## Permissions profile

Конфиг настроен на более автономную работу:

- `read`, `list`, `glob`, `grep` — `allow`;
- `edit`, `write` внутри проекта — `allow` для implementation/documentation/test agents;
- read-only agents сохраняют `edit/write: deny`;
- safe read-only `bash` allowlist — `allow`: `pwd`, `ls *`, `find *`, `rg *`, `grep *`, `git status*`, `git diff*`;
- остальной `bash` — `ask`;
- `task` — `allow` для вызова subagents без лишних подтверждений.

Такой режим уменьшает запросы на правку файлов, но не дает агенту свободный shell-доступ ко всему компьютеру.

## Internet search MCP

### DuckDuckGo MCP

Для бесплатного поиска добавлен MCP server `duckduckgo-search` в `opencode.jsonc` и `opencode.jsonc.example`. Он включен по умолчанию и не требует API key:

```jsonc
"duckduckgo-search": {
  "type": "local",
  "command": ["npx", "-y", "duckduckgo-mcp-server"],
  "enabled": true
}
```

Минусы бесплатного варианта: возможны rate limits, нестабильная выдача и зависимость от доступности DuckDuckGo. Для стабильного поиска оставлен Brave fallback.

### Brave Search MCP

Для более стабильного поиска добавлен MCP server `brave-search` в `opencode.jsonc` и `opencode.jsonc.example`.

По умолчанию он выключен, чтобы OpenCode не падал без ключа:

```jsonc
"brave-search": {
  "type": "local",
  "command": ["npx", "-y", "@modelcontextprotocol/server-brave-search"],
  "enabled": false,
  "environment": {
    "BRAVE_API_KEY": "{env:BRAVE_API_KEY}"
  }
}
```

Чтобы включить поиск:

```bash
export BRAVE_API_KEY="..."
```

Затем поменяй в `opencode.jsonc`:

```text
enabled: true
```

Не коммить реальный `BRAVE_API_KEY`.

## Google Colab MCP

Для подключения AI-агента к Google Colab добавлен официальный Colab MCP server от Google:

```jsonc
"colab-proxy-mcp": {
  "type": "local",
  "command": ["uvx", "git+https://github.com/googlecolab/colab-mcp"],
  "enabled": true
}
```

Prerequisites по Google: Python, git и `uv`/`uvx`. Если `uvx` отсутствует, установи `uv`:

```bash
pip install uv
```

После запуска OpenCode открой любой Google Colab notebook в браузере и проси агента работать с ним через MCP.

## Fallback: local Ollama

Локальный provider `local-ollama` сохранен в конфиге как fallback.

Проверить Ollama:

```bash
ollama --version
ollama list
curl http://127.0.0.1:11434/v1/models
```

Если Ollama не запущен:

```bash
ollama serve
```

Если нужной модели нет локально:

```bash
ollama pull qwen3:4b
```

Опционально для `gpt-oss:20b`:

```bash
ollama pull gpt-oss:20b
```

Чтобы временно переключиться на local Ollama, поменяй в `opencode.jsonc`:

```text
model: local-ollama/qwen3:4b
```

## Опционально: patched gpt-oss для OpenCode

В репозитории есть скрипт:

```text
scripts/create_ollama_opencode_model.py
```

Он создает локальную derived model:

```text
gpt-oss-opencode:20b
```

Зачем это нужно: сырой `gpt-oss:20b` может падать при tool schemas от OpenCode с ошибкой шаблона вида:

```text
template ... <index $prop.Type 0>: error calling index: reflect: slice index out of range
```

Скрипт меняет только fallback в Ollama template для schema properties без простого `type`.

Создать patched model можно так:

```bash
python3 scripts/create_ollama_opencode_model.py
```

После этого можно переключить модель в `opencode.jsonc`:

```text
model: local-ollama/gpt-oss-opencode:20b
```

## Валидация playbook после настройки

```bash
python3 scripts/validate_routing_rules.py --context-root context/core
python3 scripts/validate_memory_routing_policy.py --config-root context/core/config
python3 scripts/lint_json.py --context-root context/core
python3 scripts/generate_coverage_report.py --context-root context/core
python3 scripts/run_task_cli_e2e.py
```

## Секреты

Не коммить API keys. Используй только переменные окружения:

```bash
export OPENROUTER_API_KEY="..."
```
