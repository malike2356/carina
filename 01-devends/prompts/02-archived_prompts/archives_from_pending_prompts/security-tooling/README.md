# Security tooling (FEAT-001)

**Status: FULLY BUILT (COMPLETED 2026-06-26)**

| Prompt | What shipped |
|--------|--------------|
| `feat-001-cyber-tools-api-backend.md` | Carina backend `GET /api/tools/cyber` and `GET /api/tools/cyber/health` |
| `feat-002-cyber-tools-cheatsheet-frontend.md` | app.carinaai.uk `/security/tools` cheatsheet (live core proxy only) |

**Runtime requirement:** `CARINA_USE_CORE_PROXY=true`, `CARINA_CORE_URL`, and `CARINA_INTERNAL_KEY` on app.carinaai.uk for live health and core catalogue. Local dev without core uses `src/lib/cyber-tools-stub.generated.ts` (regenerate via `pnpm cyber-tools:sync` in app.carinaai.uk).

**Tool count:** Driven by `CYBER_TOOLS` in `02-backends/core.carinaai.uk/src/tools/cyber-tools-registry.ts` (77 at completion). Stub file is generated from that registry on each app build.
