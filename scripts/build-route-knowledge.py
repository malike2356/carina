#!/usr/bin/env python3
"""
Read `php artisan route:list --json` from stdin; write split route knowledge files.

Outputs (paths relative to repo root):
  brain/knowledge/64-api-route-consolidated.md  — short index + counts + links (RAG-friendly)
  brain/knowledge/66-api-routes-tenant-subdomain.md — tenant.api.* + tenant web
  brain/knowledge/67-api-routes-central-filament-misc.md — admin, platform auth, Filament, other

Security: stdin is route metadata only; no .env reads. Do not paste secrets into markdown.

Regenerate:
  php artisan route:list --json | python3 scripts/build-route-knowledge.py
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict


def method_str(route: dict) -> str:
    """Laravel `route:list --json` uses singular `method` (e.g. GET|HEAD)."""
    m = route.get("method")
    if isinstance(m, str) and m:
        parts = [x.strip() for x in m.split("|") if x.strip() and x.strip() != "HEAD"]
        return ",".join(parts) if parts else m.replace("|HEAD", "").replace("HEAD|", "")
    methods = route.get("methods")
    if isinstance(methods, list) and methods:
        return ",".join(sorted(x for x in methods if x != "HEAD"))
    return ""


def group_key(name: str, uri: str, action: str) -> str:
    if name.startswith("tenant.api."):
        return "tenant JSON API"
    if name.startswith("admin."):
        return "platform admin (central)"
    if name.startswith("central.") or uri.startswith("platform/"):
        return "platform auth (central)"
    if name.startswith("tenant.") and not uri.startswith("api/"):
        return "tenant web (Blade)"
    if uri.startswith("api/") or "/api/" in uri:
        return "other API"
    al = (action or "").lower()
    if "filament" in uri.lower() or "livewire" in al:
        return "Filament / Livewire"
    return "other"


def render_tables(
    by_section: dict[str, list[tuple[str, str, str]]],
    order: list[str],
) -> list[str]:
    lines: list[str] = []
    for sec in order:
        if sec not in by_section:
            continue
        items = sorted(by_section[sec], key=lambda x: (x[1], x[2]))
        lines.append(f"## {sec}")
        lines.append("")
        lines.append("| Methods | URI | Route name |")
        lines.append("| --- | --- | --- |")
        for m, uri, name in items:
            m = m or "GET"
            uri = uri.replace("|", "\\|")
            name = name.replace("|", "\\|")
            lines.append(f"| {m} | `{uri}` | `{name}` |")
        lines.append("")
    return lines


def main() -> int:
    data = json.load(sys.stdin)
    rows: list[tuple[str, str, str, str]] = []
    for r in data:
        uri = r.get("uri") or ""
        name = (r.get("name") or "").strip()
        action = r.get("action") or ""
        m = method_str(r)
        rows.append((m, uri, name, action))

    by_section: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for m, uri, name, action in rows:
        by_section[group_key(name, uri, action)].append((m, uri, name))

    full_order = [
        "tenant JSON API",
        "tenant web (Blade)",
        "platform admin (central)",
        "platform auth (central)",
        "Filament / Livewire",
        "other API",
        "other",
    ]
    tenant_order = ["tenant JSON API", "tenant web (Blade)"]
    central_order = [
        "platform admin (central)",
        "platform auth (central)",
        "Filament / Livewire",
        "other API",
        "other",
    ]

    total = len(rows)
    # No calendar date here: CI uses git diff --exit-code; a changing date would fail every run.

    def common_header(title: str, slug: str) -> list[str]:
        return [
            f"# {title}",
            "",
            "**Generated:** `scripts/build-route-knowledge.py` from `php artisan route:list --json` (commit regenerated files with route changes).",
            "",
            "**Security:** Route tables contain no credentials. URIs and route names only.",
            "",
            "**Regenerate:**",
            "",
            "```bash",
            "php artisan route:list --json | python3 scripts/build-route-knowledge.py",
            "```",
            "",
            f"**Split:** `{slug}` (see `64-api-route-consolidated.md` for index).",
            "",
            "---",
            "",
        ]

    # --- 66 tenant ---
    t_lines = common_header("HTTP routes: tenant subdomain", "66-api-routes-tenant-subdomain.md")
    t_lines.extend(render_tables(by_section, tenant_order))
    path_t = "brain/knowledge/66-api-routes-tenant-subdomain.md"
    with open(path_t, "w", encoding="utf-8") as f:
        f.write("\n".join(t_lines).rstrip() + "\n")

    # --- 67 central / misc ---
    c_lines = common_header("HTTP routes: central, Filament, and other", "67-api-routes-central-filament-misc.md")
    c_lines.extend(render_tables(by_section, central_order))
    path_c = "brain/knowledge/67-api-routes-central-filament-misc.md"
    with open(path_c, "w", encoding="utf-8") as f:
        f.write("\n".join(c_lines).rstrip() + "\n")

    # --- 64 index (small; best for RAG chunking) ---
    n_tenant = sum(len(by_section[s]) for s in tenant_order if s in by_section)
    n_central = sum(len(by_section[s]) for s in central_order if s in by_section)

    idx: list[str] = [
        "# HTTP route knowledge (index)",
        "",
        "**Generated:** `scripts/build-route-knowledge.py` (stable for CI `git diff`; no timestamps).",
        "",
        "**Purpose:** Point Carina and humans to split route tables so RAG chunks stay smaller and reviews stay focused. **No secrets** belong in these files (URIs and named routes only).",
        "",
        "## Regenerate locally",
        "",
        "```bash",
        "php artisan route:list --json | python3 scripts/build-route-knowledge.py",
        "```",
        "",
        "## Route counts",
        "",
        "| Scope | File | Approx. rows |",
        "| --- | --- | --- |",
        f"| Tenant subdomain (`tenant.*`, `tenant.api.*`) | `66-api-routes-tenant-subdomain.md` | {n_tenant} |",
        f"| Central admin, platform auth, Filament, other API | `67-api-routes-central-filament-misc.md` | {n_central} |",
        f"| **Total** | | **{total}** |",
        "",
        "## CI drift check",
        "",
        "Pull requests run `.github/workflows/test.yml` which regenerates these three files and fails if `git diff` is non-empty. Commit regenerated markdown whenever routes change.",
        "",
        "## Related",
        "",
        "- `22-tenant-route-map.md`, `13-routes.md`",
        "- `59-carina-propreneur-full-codex.md`",
        "",
    ]
    path_i = "brain/knowledge/64-api-route-consolidated.md"
    with open(path_i, "w", encoding="utf-8") as f:
        f.write("\n".join(idx).rstrip() + "\n")

    print(f"Wrote {path_i}, {path_t}, {path_c}", file=sys.stderr)
    print(f"  total={total} tenant_split={n_tenant} central_split={n_central}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
