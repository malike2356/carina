#!/usr/bin/env python3
"""Ensure VERLOX ecosystem product links exist in marketing site footers."""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SITES = [
    REPO / "shared/marketing-sites/carinaai.uk",
    REPO / "03-frontends/marketing/hireaiva",
]

# Scout (labyrinthscout.com) removed 2026-10-22: re-scoped from a commercial product to a
# personal research project, no longer part of the cross-promoted ecosystem.
LINKS = (
    ("github.com/malike2356/keprix", '        <a href="https://github.com/malike2356/keprix">Keprix</a>\n'),
    ("carinaai.uk", '        <a href="https://carinaai.uk/">Carina</a>\n'),
    ("hireaiva.co.uk", '        <a href="https://hireaiva.co.uk/">Aiva</a>\n'),
    ("propreneur.uk", '        <a href="https://propreneur.uk/">Propreneur</a>\n'),
    ("tuinapp.uk", '        <a href="https://tuinapp.uk/">TuinApp</a>\n'),
    ("propcalc.uk", '        <a href="https://propcalc.uk/">PropCalc</a>\n'),
)

SITE_FOOTER_MARKERS = (
    'class="site-footer"',
    'class="ir-footer"',
    '<footer>\n  <div class="container">',
)


def site_footer_block(html: str) -> tuple[int, int, str] | None:
    candidates: list[tuple[int, int, str]] = []
    for match in re.finditer(r"<footer\b[\s\S]*?</footer>", html, re.I):
        block = match.group(0)
        if "ir-incident-footer" in block:
            continue
        if any(marker in block for marker in SITE_FOOTER_MARKERS) or (
            "footer-inner" in block and "ir-footer-inner" not in block
        ):
            candidates.append((match.start(), match.end(), block))
    return candidates[-1] if candidates else None


def has_link(block: str, host: str) -> bool:
    return bool(re.search(rf'href="https://{re.escape(host)}', block, re.I))


def missing_trio_lines(block: str) -> str:
    return "".join(line for host, line in LINKS if not has_link(block, host))


def injection_point(block: str) -> int | None:
    patterns = [
        r'<div class="footer-links"[^>]*>\s*\n',
        r'<div class="ir-footer-links">\s*\n',
        r'<div class="footer-col">\s*\n\s*<h4>Ecosystem</h4>\s*\n',
        r'<div class="footer-col">\s*\n\s*<h4>Product</h4>\s*\n',
    ]
    for pattern in patterns:
        match = re.search(pattern, block, re.I)
        if match:
            return match.end()
    return None


def process_file(path: Path) -> bool:
    html = path.read_text(encoding="utf-8")
    found = site_footer_block(html)
    if not found:
        return False
    start, end, block = found
    to_add = missing_trio_lines(block)
    if not to_add:
        return False
    point = injection_point(block)
    if point is None:
        return False
    updated = block[:point] + to_add + block[point:]
    path.write_text(html[:start] + updated + html[end:], encoding="utf-8")
    return True


def main() -> int:
    changed: list[str] = []
    for site in SITES:
        if not site.is_dir():
            continue
        for path in sorted(site.rglob("*.html")):
            if "/docs/" in path.as_posix():
                continue
            if process_file(path):
                changed.append(str(path.relative_to(REPO)))
    for item in changed:
        print(f"updated: {item}")
    print(f"Done. {len(changed)} file(s) updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
