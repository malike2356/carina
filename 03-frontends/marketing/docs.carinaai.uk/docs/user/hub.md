# Carina Hub

The **Carina Hub** at [hub.carinaai.uk](https://hub.carinaai.uk) is the public registry for domain packs: optional skill and knowledge bundles that extend the free Carina kernel.

Think of it like a package index for the agent kernel. The current public package (`carina-agent`) ships without domain packs; you choose what to install.

## Hub vs kernel vs packs

| Layer | What it is | Cost |
|-------|------------|------|
| **Carina kernel** | Tools, memory, routing, channels, CLI (`carina-agent`) | Free, MIT |
| **Domain packs** | Optional bundles (skills + knowledge + prompts) | Free or premium on Hub |
| **Labyrinth Scout** | Separate commercial security product for production agent deployments | Paid plans |

Installing the kernel does **not** enable any domain pack. Packs are opt-in via Hub install, web UI, or `ACTIVE_SKILL_PACKS` in config.

## Browse and install

### Web

1. Open [hub.carinaai.uk](https://hub.carinaai.uk)
2. Search or browse packs
3. Open a pack for version, author, skill count, and verified badge (official VERLOX packs)
4. Run the install command shown on the pack page

### CLI

Install the kernel first:

```bash
npm install -g carina-agent
carina setup
```

Then install a pack:

```bash
carina pack search property
carina pack install property-uk
carina pack list
```

Set `HUB_URL` or `SKILLS_HUB_URL` if you use a local hub during development (`pnpm hub` in the monorepo).

## Verified badge

Official VERLOX-maintained packs (for example `property-uk`, `core-engineering`) show a **verified** badge on the Hub. Community submissions are welcome; verification is manual in v1.

## Publish a pack (authors)

Free to publish. You need a Hub publish token (`CARINA_HUB_TOKEN` or `SKILLS_HUB_PUBLISH_KEY`).

```bash
carina pack publish ./my-healthcare-pack
```

Requirements:

- Valid `pack.json` (see [Creating packs](/docs/user/skill-packs/creating-packs))
- At least one `.md` knowledge file
- No `.env` or secrets in the pack directory

Developer reference: [Stable public API](/docs/developer/stable-api).

Hub v1 supports **free** and **premium** packs. Premium packs use Stripe Checkout on the Hub; free packs install with `carina pack install` only.

Developer guide: [Selling a pack](/docs/developer/selling-a-pack).

## Hub vs in-app pack UI

| Surface | Where | Use case |
|---------|-------|----------|
| **Hub** | hub.carinaai.uk | Public discovery, CLI tarball downloads, author publish |
| **Web `/packs`** | Your Carina instance | Enable/disable packs already installed on that host |
| **Ops panel** | ops.carinaai.uk (VERLOX internal) | Operator pack audit, not public |

## Self-hosting the Hub

Production Docker stack: `docker-compose.prod.yml` includes a `carina-hub` service on port 3001, proxied by nginx at `hub.carinaai.uk`.

Local dev:

```bash
cd core.carinaai.uk
pnpm hub
curl -s http://localhost:3001/api/packs | jq .
```

DNS checklist for production:

1. `hub.carinaai.uk` A/AAAA record to your VPS
2. TLS certificate (certbot or existing `carinaai.uk` SAN)
3. `skills.carinaai.uk` redirects to `hub.carinaai.uk` for backward compatibility

## Related docs

- [Skill packs overview](/docs/user/skill-packs/overview)
- [Creating packs](/docs/user/skill-packs/creating-packs)
- [Stable public API](/docs/developer/stable-api)
