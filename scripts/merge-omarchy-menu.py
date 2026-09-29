#!/usr/bin/env python3
"""Add or remove the DeepSeek Harness row in the user's Omarchy menu extension.

The Omarchy shell reads a single JSONC file at
`~/.config/omarchy/extensions/omarchy-menu.jsonc`. Adding inserts one row after
the opening brace so existing comments and entries are preserved. Removing
re-emits the remaining entries as valid JSONC, so a hand-reformatted or
multi-line row can never leave orphan fields behind. Both directions are
idempotent and back up the file.

Usage:
    merge-omarchy-menu.py [--remove]
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys

KEY = "setup.default.agent.dsh"
MARKER = "DeepSeek Harness agent row (added by dsh-omarchy-agent)"
ROW = {
    "icon": "\U000f06a9",
    "label": "DeepSeek Harness",
    "description": "General-purpose Omarchy agent powered by dsh",
    "checked": '[[ "$(omarchy-default-agent)" == "dsh" ]]',
    "action": "dsh-agent",
}


def menu_path() -> str:
    base = os.environ.get("XDG_CONFIG_HOME") or os.path.join(os.path.expanduser("~"), ".config")
    return os.path.join(base, "omarchy", "extensions", "omarchy-menu.jsonc")


def strip_jsonc(raw: str) -> str:
    """Remove line comments and trailing commas without touching URLs in strings."""
    without_comments = re.sub(r"(^|\s)//[^\n]*", lambda match: match.group(1), raw)
    return re.sub(r",(\s*[}\]])", r"\1", without_comments)


def read(path: str) -> str:
    if not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def backup(path: str) -> None:
    if os.path.exists(path):
        shutil.copy2(path, f"{path}.bak")


def add(path: str) -> int:
    text = read(path)
    if KEY in text:
        print("menu: DeepSeek Harness row already present")
        return 0
    if not text.strip():
        text = "{\n}\n"
    elif not text.lstrip().startswith("{"):
        print(f"menu: {path} is not a JSON object; leaving it unchanged", file=sys.stderr)
        return 1
    backup(path)
    row = json.dumps(ROW, ensure_ascii=False, separators=(", ", ": "))
    insert = f'\n  // {MARKER}.\n  "{KEY}": {row},\n'
    brace = text.index("{")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text[: brace + 1] + insert + text[brace + 1 :])
    print(f"menu: added DeepSeek Harness row to {path}")
    return 0


def remove(path: str) -> int:
    text = read(path)
    if not text:
        print("menu: no menu extension file; nothing to remove")
        return 0
    try:
        parsed = json.loads(strip_jsonc(text))
    except json.JSONDecodeError as error:
        print(f"menu: {path} is not valid JSONC ({error}); leaving it unchanged", file=sys.stderr)
        return 1
    if not isinstance(parsed, dict) or KEY not in parsed:
        print("menu: DeepSeek Harness row not present")
        return 0
    backup(path)
    del parsed[KEY]
    body = json.dumps(parsed, ensure_ascii=False, indent=2)[1:-1].strip()
    header = "{\n  // Omarchy menu extension. Managed by dsh-omarchy-agent.\n"
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(f"{header}{body}\n}}\n" if body else f"{header}}}\n")
    print(f"menu: removed DeepSeek Harness row from {path}")
    return 0


def main() -> int:
    path = menu_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if "--remove" in sys.argv[1:]:
        return remove(path)
    return add(path)


if __name__ == "__main__":
    sys.exit(main())
