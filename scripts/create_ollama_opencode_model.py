#!/usr/bin/env python3
"""Create an OpenCode-compatible Ollama model from gpt-oss:20b.

The base gpt-oss:20b model can fail when OpenCode sends tool schemas that
contain properties without a simple JSON Schema `type`. This script creates a
local derived model with the same weights and a safer template fallback.
"""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

BASE_MODEL = "gpt-oss:20b"
TARGET_MODEL = "gpt-oss-opencode:20b"

OLD_TEMPLATE_FRAGMENT = "{{ if gt (len $prop.Type) 1 }}{{ range $i, $t := $prop.Type }}{{ if $i }} | {{ end }}{{ $t }}{{ end }}{{ else }}{{ index $prop.Type 0 }}{{ end }}"
NEW_TEMPLATE_FRAGMENT = "{{ if gt (len $prop.Type) 1 }}{{ range $i, $t := $prop.Type }}{{ if $i }} | {{ end }}{{ $t }}{{ end }}{{ else if eq (len $prop.Type) 1 }}{{ index $prop.Type 0 }}{{ else }}any{{ end }}"


def run(command: list[str]) -> str:
    return subprocess.check_output(command, text=True)


def main() -> int:
    modelfile = run(["ollama", "show", BASE_MODEL, "--modelfile"])

    lines = modelfile.splitlines()
    for index, line in enumerate(lines):
        if line.startswith("FROM "):
            lines[index] = f"FROM {BASE_MODEL}"
            break
    modelfile = "\n".join(lines) + "\n"

    if OLD_TEMPLATE_FRAGMENT not in modelfile:
        raise SystemExit("Expected template fragment not found. Ollama model template may have changed.")

    modelfile = modelfile.replace(OLD_TEMPLATE_FRAGMENT, NEW_TEMPLATE_FRAGMENT)

    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as handle:
        handle.write(modelfile)
        temp_path = Path(handle.name)

    try:
        subprocess.check_call(["ollama", "create", TARGET_MODEL, "-f", str(temp_path)])
    finally:
        temp_path.unlink(missing_ok=True)

    print(f"Created {TARGET_MODEL} from {BASE_MODEL}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
