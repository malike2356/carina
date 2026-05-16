#!/usr/bin/env python3
"""Split brain/reference/carina-knowledgebase-final-packed.md and
08-carina-2-0-complete.md into brain/masterbrain/* chunks.
Run from repo root: python3 scripts/split-carina-packed-to-masterbrain.py
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROMPTS = ROOT / "brain" / "prompts"
MB = ROOT / "brain" / "masterbrain"

HEADER = """---
source: `{src}`
extracted: 2026-05-15
note: Auto-split for Carina RAG / masterbrain. Verify against live code if implementing.
---

"""


def write_slice(
    rel_src: str,
    dst: Path,
    lines: list[str],
    extra_header: str = "",
) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    body = "".join(lines)
    src = rel_src if rel_src.startswith("brain/") else f"brain/prompts/{rel_src}"
    dst.write_text(HEADER.format(src=src) + extra_header + body, encoding="utf-8")
    print(f"Wrote {dst.relative_to(ROOT)} ({len(lines)} lines)")


def main() -> None:
    REFERENCE = ROOT / "brain" / "reference"
    packed = (REFERENCE / "carina-knowledgebase-final-packed.md").read_text(encoding="utf-8").splitlines(
        keepends=True
    )
    complete = (PROMPTS / "08-carina-2-0-complete.md").read_text(encoding="utf-8").splitlines(keepends=True)

    # --- Packed knowledgebase (1-based line numbers from prior grep) ---
    write_slice(
        "brain/reference/carina-knowledgebase-final-packed.md",
        MB / "Carina_RAG" / "16-packed-kb-preamble-and-codebase-alignment.md",
        packed[0:27],
    )
    write_slice(
        "brain/reference/carina-knowledgebase-final-packed.md",
        MB / "Carina_RAG" / "17-packed-kb-carina-module-prompts-1-through-7.md",
        packed[28:201],
    )
    write_slice(
        "brain/reference/carina-knowledgebase-final-packed.md",
        MB / "legal" / "21-sourcing-aml-onboarding-templates-from-packed-kb.md",
        packed[200:768],
    )
    write_slice(
        "brain/reference/carina-knowledgebase-final-packed.md",
        MB / "algorithms" / "07-e-resources-calculators-and-dd-pack-from-packed-kb.md",
        packed[768:949],
    )
    write_slice(
        "brain/reference/carina-knowledgebase-final-packed.md",
        MB / "deals" / "25-property-viewing-guide-abridged-from-packed-kb.md",
        packed[955:1036],
    )
    write_slice(
        "brain/reference/carina-knowledgebase-final-packed.md",
        MB / "deals" / "26-area-due-diligence-guide-from-packed-kb.md",
        packed[1036:1107],
    )
    write_slice(
        "brain/reference/carina-knowledgebase-final-packed.md",
        MB / "deals" / "27-deal-packaging-guide-from-packed-kb.md",
        packed[1107:1192],
    )
    write_slice(
        "brain/reference/carina-knowledgebase-final-packed.md",
        MB / "legal" / "22-hmo-compliance-manchester-extract-from-packed-kb.md",
        packed[1192:1266],
    )
    write_slice(
        "brain/reference/carina-knowledgebase-final-packed.md",
        MB / "Carina_RAG" / "18-packed-kb-carina-user-guide-by-portal.md",
        packed[1266:1310],
    )
    write_slice(
        "brain/reference/carina-knowledgebase-final-packed.md",
        MB / "marketing" / "29-social-media-content-guide-from-packed-kb.md",
        packed[1310:1393],
    )

    # --- CARINA 2.0 COMPLETE (product + security + capabilities; omit migrations block) ---
    write_slice(
        "08-carina-2-0-complete.md",
        MB / "Carina_RAG" / "19-carina-2-sections-1-3-identity-environment-read-order.md",
        complete[18:188],
    )
    write_slice(
        "08-carina-2-0-complete.md",
        MB / "Carina_RAG" / "20-carina-2-sections-14-15-security-and-incognito.md",
        complete[1308:1439],
    )
    write_slice(
        "08-carina-2-0-complete.md",
        MB / "process_and_workflow" / "51-masterbrain-folder-map-and-organisation-format.md",
        complete[1440:1499],
    )
    write_slice(
        "08-carina-2-0-complete.md",
        MB / "Carina_RAG" / "21-carina-2-section-17-capability-specifications-cap-01-through-17.md",
        complete[1500:2120],
    )
    write_slice(
        "08-carina-2-0-complete.md",
        MB / "Carina_RAG" / "22-carina-2-sections-18-19-output-rules-and-baseline-system-prompt.md",
        complete[2121:2211],
    )

    index_body = """# Carina 2.0 build prompt — implementation sections index

**Full source:** `brain/prompts/08-carina-2-0-complete.md`

The following sections are **implementation specifications** (migrations, models, services, controllers, routes, tests, Filament, `carina:verify`, brain modifier file bodies, rate limits). They were **not** duplicated into `brain/masterbrain/` to avoid multi-thousand-line drift from the canonical prompt.

| Sections | Topics |
|----------|--------|
| 4–13 | Database migrations through Pest tests |
| 20 | Implementation sequence checklist |
| 21–28 (and duplicate block after line ~2255) | `carina:verify`, `_folder_index`, ethics log, brain modifiers, `CarinaAccessGate`, seeders, Filament, corrections |

**Extracted to masterbrain:** Sections 1–3, 14–15, 16 (folder map), 17 (CAP-01–17), 18–19 — see `Carina_RAG/19-*.md` through `22-*.md`.

For **Carina product behaviour**, prefer `brain/knowledge/08-carina.md`, `config/ai.php`, and shipped `App\\Services\\Carina\\` over this build prompt when they disagree.
"""
    idx = MB / "Carina_RAG" / "23-carina-2-build-prompt-implementation-sections-index.md"
    idx.write_text(HEADER.format(src="brain/prompts/08-carina-2-0-complete.md") + index_body, encoding="utf-8")
    print(f"Wrote {idx.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
