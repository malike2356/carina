# Carina Kernel Phase 2: Hub site at hub.carinaai.uk

## Goal

Deploy the Carina Hub as a public registry UI at `hub.carinaai.uk` for discovering and installing domain packs (free browse/install; verified badge for official packs).

## Context

- Hub server: `core.carinaai.uk/src/skills/hub/server.ts`
- Hub static UI: `core.carinaai.uk/src/skills/hub/public/index.html`
- CLI from prompt `10` targets this hub
- Overlap: `phase2-gap-closure/05-website-promises/02-skill-packs-installable.md` (in-app marketplace); hub is the public npm-for-packs surface
- Nginx config: `core.carinaai.uk/docker/nginx/` (check for subdomain patterns)
- Deploy: `scripts/deploy-carina.sh` or marketing deploy scripts

## Dependencies

`10-hub-pack-cli-commands.md`

## Files to create

- `core.carinaai.uk/docker/nginx/hub.carinaai.uk.conf` (if not exists)
- `docs.carinaai.uk/docs/user/hub.md` (user guide for Hub)

## Files to modify

- `core.carinaai.uk/src/skills/hub/public/index.html` (kernel branding, search UI, install instructions)
- `core.carinaai.uk/src/skills/hub/server.ts` (CORS for carinaai.uk, public read endpoints)
- `core.carinaai.uk/docker-compose.prod.yml` (hub service + subdomain)
- `carinaai.uk/index.html` (nav link "Hub" to `https://hub.carinaai.uk`)
- Cloudflare/DNS docs in deploy script comments (hub subdomain)

## Step-by-step

1. Read existing hub UI and server. Identify gaps vs required features:
   - Pack search (name, description, category)
   - Pack detail page (version, author, skill count, verified badge)
   - Install instructions: `carina pack install <slug>`
   - Publish instructions for authors (link to developer docs)

2. Update hub public UI:
   - Hero: "Carina Hub; discover domain packs for the agent kernel"
   - Search box filtering registry from `GET /api/packs?q=`
   - Pack cards show `verified` badge for official VERLOX packs
   - No paid checkout on Hub in v1 (premium packs are prompt `21`)

3. Ensure public API routes (read-only, no auth):
   - `GET /api/packs`
   - `GET /api/packs/:slug`
   - `GET /api/packs/:slug/download` (tarball for CLI install)

4. Auth-required routes:
   - `POST /api/packs/publish` (Bearer `CARINA_HUB_TOKEN`)

5. Nginx: route `hub.carinaai.uk` to hub container port (check prod compose for hub service name).

6. Seed registry with official packs from `src/skills/packs/` via existing `hub/seed.ts`.

7. Add docs page `docs/user/hub.md` explaining Hub vs optional packs vs core install.

8. Add homepage nav link on carinaai.uk.

## Expected behavior

- `https://hub.carinaai.uk` lists official packs
- `carina pack search` against production hub returns seeded packs
- Browse works without login; publish requires token

## Test

```bash
cd core.carinaai.uk
pnpm hub
curl -s localhost:HUB_PORT/api/packs | jq .
curl -s localhost:HUB_PORT/api/packs/property-uk | jq .
```

- Staging deploy checklist: DNS `hub.carinaai.uk` points to VPS; TLS via existing certbot pattern

## Pitfalls

- Hub must not expose private monorepo paths or internal ops data
- Rate-limit publish endpoint
