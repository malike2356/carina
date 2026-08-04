# Research tools in Carina Docker

Research tools are kernel tools in toolset `research`. They are registered at startup
but hidden until the toolset is enabled.

## Image requirements (Dockerfile.carina)

- `COPY src/tools/research` (Python and R scripts; not emitted to `dist/`)
- `pip install -r src/tools/research/requirements.txt` for Python stats and `.sav` I/O
- Compiled JS uses `resolveResearchAsset()` to find scripts under `src/tools/research`

PSPP, R, and Jamovi are **not** installed in the default image (size and security).
Those tools return graceful fallbacks; use Python `stats_*` and `sav_*` in Docker.

## Enable for agents

Copy `docker/toolsets-research.example.yaml` to `/data/.carina/toolsets.yaml` or merge
the `research` entry into your existing file. Restart is not required; toolsets reload
on the next agent session.

Install the skill pack (guides the agent):

```bash
carina pack install research-analysis
# enable pack in ops panel or active packs list
```

## Verify inside a running container

```bash
docker exec corecarinaaiuk-carina-web-1 python3 /app/src/tools/research/stats-analysis.py deps
docker exec corecarinaaiuk-carina-web-1 node --input-type=module -e "
  import '/app/dist/src/tools/index.js';
  import { resolveToolset } from '/app/dist/src/tools/toolset.js';
  console.log(resolveToolset(['research']).length, 'research tools');
"
```

## Host-only PSPP/R (optional)

To use PSPP or R from Carina in Docker without rebuilding the image, mount host binaries
(not configured by default). Prefer Python path in production containers.
