#!/usr/bin/env python3
"""Lightweight repository scan for secrets and non-portable local paths."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKIP_DIRS = {".git", "node_modules", ".tmp", "dist", "build", "coverage", "__pycache__", ".pytest_cache"}
SKIP_FILES = {"package-lock.json"}
TEXT_EXTENSIONS = {
    "",
    ".bash",
    ".cjs",
    ".env",
    ".example",
    ".js",
    ".json",
    ".jsonc",
    ".md",
    ".mjs",
    ".py",
    ".sh",
    ".ts",
    ".txt",
    ".yaml",
    ".yml",
}

SECRET_PATTERNS = [
    ("personal macOS path", re.compile("/" + r"Users/[^\s\"'`]+")),
    ("legacy OpenRouter env name", re.compile(r"\b" + "OPEN_" + r"ROUTER_KEY\b")),
    ("placeholder apiKey literal", re.compile(r'"apiKey"\s*:\s*"apiKey"')),
    ("OpenAI-style key", re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b")),
    ("GitHub token", re.compile(r"\bghp_[A-Za-z0-9_]{16,}\b")),
    ("Google API key", re.compile(r"\bAIza[A-Za-z0-9_-]{20,}\b")),
]

ENV_ASSIGNMENT = re.compile(r"(?:^|\b)(?:export\s+)?OPENROUTER_API_KEY\s*=\s*(?P<value>[^\s#]+)?")
SAFE_ENV_VALUES = {None, "", "\"\"", "''", "\"...\"", "'...'", "...", "<set-locally>", "<redacted>", "REDACTED", "CHANGE_ME"}


def is_probably_text(path: Path) -> bool:
    if path.name in SKIP_FILES:
        return False
    if path.name == ".env" or (path.name.startswith(".env.") and path.name != ".env.example"):
        return False
    if path.suffix in TEXT_EXTENSIONS:
        return True
    return path.name in {".gitignore", "Makefile"}


def iter_files(root: Path):
    for path in root.rglob("*"):
        if any(part in SKIP_DIRS for part in path.relative_to(root).parts):
            continue
        if path.is_file() and is_probably_text(path):
            yield path


def safe_openrouter_assignment(value: str | None) -> bool:
    if value is None:
        return True
    normalized = value.strip().strip(";")
    if normalized in SAFE_ENV_VALUES:
        return True
    if normalized.startswith("#"):
        return True
    if normalized.startswith("<") and normalized.endswith(">"):
        return True
    if normalized.lower().startswith(("your-", "replace-")):
        return True
    return False


def scan_file(path: Path) -> list[str]:
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return []

    findings: list[str] = []
    rel_path = path.relative_to(ROOT)

    for line_no, line in enumerate(content.splitlines(), start=1):
        for label, pattern in SECRET_PATTERNS:
            if pattern.search(line):
                findings.append(f"{rel_path}:{line_no}: {label}")

        match = ENV_ASSIGNMENT.search(line)
        if match and not safe_openrouter_assignment(match.group("value")):
            findings.append(f"{rel_path}:{line_no}: possible inline OPENROUTER_API_KEY value")

    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan tracked source files for obvious secrets/local paths")
    parser.add_argument("--root", default=str(ROOT), help="Repository root to scan")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    findings: list[str] = []
    for path in iter_files(root):
        findings.extend(scan_file(path))

    if findings:
        print("Secret/path scan failed:")
        for finding in findings:
            print(f"  - {finding}")
        return 1

    print("Secret/path scan passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
