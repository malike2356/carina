#!/usr/bin/env python3
"""Add Post-build (MANDATORY) section to pending prompts that are not yet completed."""

from __future__ import annotations

import re
from pathlib import Path

PROMPTS_ROOT = Path(__file__).resolve().parents[1]
PENDING = PROMPTS_ROOT / "pending_prompts"

POST_BUILD_SECTION = """## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

"""

SKIP_NAMES = {
    "POST-BUILD-CHECKLIST.md",
    "AUDIT-STATE-2026-06-20.md",
    "00-PRE-WORK-ALIGNMENT.md",
}

SKIP_PREFIXES = (
    "ADDENDUM-",
)

SKIP_PATTERNS = (
    re.compile(r"^\*\*Status:\s*COMPLETED\b", re.M | re.I),
    re.compile(r"^## Status:\s*FULLY BUILT\b", re.M | re.I),
    re.compile(r"^\*\*STATUS:\s*FULLY BUILT\b", re.M | re.I),
    re.compile(r"^\*\*Status:\s*SUPERSEDED\b", re.M | re.I),
    re.compile(r"^## Post-build \(MANDATORY\)", re.M),
)

# North-star / reference docs, not single-shot build prompts
REFERENCE_DOCS = {
    "CARINA_VOICE_AGENT_ROADMAP.md",
    "IMPLEMENTATION_PLAN.md",
    "GOLD-STANDARD-TUI-CLI.md",
    "GOLD-STANDARD-ONBOARDING-AESTHETICS.md",
    "SCOUT-CARINA-ARCHITECTURE.md",
    "OBSIDIAN-INTEGRATION.md",
    "MIGRATION-STRATEGY.md",
    "MIGRATION-IMPLEMENTATION.md",
    "CROSS-AGENT-SKILL-CONSUMPTION.md",
    "REUSE-RULES.md",
}


def is_completed_or_skip(path: Path, text: str) -> bool:
    if path.name in SKIP_NAMES or path.name in REFERENCE_DOCS:
        return True
    if any(path.name.startswith(p) for p in SKIP_PREFIXES):
        return True
    if any(p.search(text) for p in SKIP_PATTERNS):
        return True
    return False


def insert_section(text: str) -> str:
    if "## Post-build (MANDATORY)" in text:
        return text

    # Prefer inserting after the first metadata block ending with --- on its own line
    match = re.search(r"\n---\n", text)
    if match:
        pos = match.end()
        return text[:pos] + "\n" + POST_BUILD_SECTION + text[pos:]

    # Fallback: after the first heading block (first blank line after line 1)
    lines = text.splitlines(keepends=True)
    if len(lines) >= 2:
        # Find first blank line after title
        for i, line in enumerate(lines[1:], start=1):
            if line.strip() == "":
                insert_at = i + 1
                return "".join(lines[:insert_at]) + "\n" + POST_BUILD_SECTION + "".join(lines[insert_at:])

    return POST_BUILD_SECTION + "\n" + text


def main() -> None:
    updated: list[str] = []
    skipped: list[str] = []

    for path in sorted(PENDING.rglob("*.md")):
        rel = path.relative_to(PENDING)
        text = path.read_text(encoding="utf-8")
        if is_completed_or_skip(path, text):
            skipped.append(str(rel))
            continue
        new_text = insert_section(text)
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            updated.append(str(rel))

    print(f"Updated {len(updated)} files")
    for name in updated[:20]:
        print(f"  + {name}")
    if len(updated) > 20:
        print(f"  ... and {len(updated) - 20} more")
    print(f"Skipped {len(skipped)} files (completed, addendum, or reference)")


if __name__ == "__main__":
    main()
