# Carina Clinicom pack

Carina domain pack implementing the Clinicom product surface sidecar contract (`/clinicom/tools/*`). Clinicom routes AI work here when `CLINICOM_SIDECAR_PROFILE=carina`.

Per [CARINA-AIVA soft separation](https://github.com/verlox/verlox/blob/main/shared/workspace-governance/CARINA-AIVA-SOFT-SEPARATION.md), Clinicom is a product surface on Carina; this pack owns the HTTP contract and agent tools, not a second runtime.

**Contabo:** Clinicom live profile is Carina via Docker `carina-sidecar` (`:3010`). Keprix is a prepared later switch only. Agent note: `/opt/lampp/htdocs/verlox/shared/workspace-governance/CLINICOM-CONTABO-SIDECAR.md`.

## Agent tools

| Tool | HTTP route |
| --- | --- |
| `clinicom-transcribe` | `POST /clinicom/tools/transcribe` |
| `clinicom-translate` | `POST /clinicom/tools/translate` |
| `clinicom-simplify` | `POST /clinicom/tools/simplify` |
| `clinicom-speak` | `POST /clinicom/tools/speak` |

Tools call the same handler module as the HTTP sidecar (`tools/handlers.ts`).

## Run standalone sidecar

From `core.carinaai.uk`:

```bash
cd /opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk
npx tsx scripts/clinicom-sidecar.ts
```

Default listen: `http://0.0.0.0:3000` (override with `CLINICOM_CARINA_SIDECAR_PORT`).

Point Clinicom:

```bash
export CLINICOM_SIDECAR_PROFILE=carina
export CLINICOM_CARINA_SIDECAR_URL=http://127.0.0.1:3000
export CLINICOM_SIDECAR_TOKEN=your-shared-token   # optional
```

## Enable pack in Carina

Add `clinicom` to the active pack list in your Carina profile or workspace config. Tools register when the pack is active via `registerActivePackTools()`.

Build the pack (optional for tsx dev):

```bash
cd packages/packs/clinicom
pnpm build
```

## Auth

When `CLINICOM_SHARED_TOKEN` or `CLINICOM_SIDECAR_TOKEN` is set, requests must include `Authorization: Bearer <token>`.
