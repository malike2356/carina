# Skill Packs

:::info Canonical inventory
Pack count and optional status: [Capability inventory](/docs/capabilities). Per-pack tables below are domain detail only.
:::

Skill packs bundle domain knowledge (RAG corpus), pre-built skills (structured playbooks), optional tools, and a system prompt suffix.

## What a pack contains

| Component | Location | Purpose |
|---|---|---|
| `pack.json` | Pack root | Metadata, version, triggers |
| Skills | `skills.ts` or `skills/` | Named procedures Carina can invoke |
| Knowledge | `knowledge/` or `brain/` corpus | Markdown ingested into pgvector |
| Tools | `tools/` | Optional MCP tools (e.g. PropertyData) |
| System suffix | `prompts/system.ts` | Extra instructions appended to the agent prompt |

## Active packs

Carina is **general-purpose by default** (no pack loaded). Enable packs without editing `.env` on operator hosts:

- Web UI: open `/packs` and click **Enable** on a pack card
- CLI: `carina pack install <name>` (see [Carina Hub](/docs/user/hub))
- Hub: browse at [hub.carinaai.uk](https://hub.carinaai.uk)

For `.env` or global CLI installs, set `ACTIVE_SKILL_PACKS=core-engineering,finance` (comma-separated). On first wizard run, Carina can install selected packs into `~/.carina/packs/`. Full catalogue: [carinaai.uk/skill-packs](https://carinaai.uk/skill-packs/).

## Shipped packs (16)

| Pack | Skills | Domain |
|---|---:|---|
| core-engineering | 18 | Coding, GitHub, debugging |
| creative-basics | 7 | Design, diagrams, mockups |
| productivity | 8 | Google, Notion, OCR, news |
| healthcare | 5 | Clinical notes, scheduling |
| finance | 5 | Cashflow, VAT, invoicing |
| research-basics | 5 | arXiv, RSS, investigation |
| data-science | 8 | Pandas, SQL, geospatial |
| mlops | 6 | Training, MLflow, evaluation |
| media-extended | 6 | Spotify, video, podcast |
| email-extended | 5 | Inbox triage, templates |
| smart-home | 5 | Home Assistant, Hue |
| social-extended | 6 | X, Discord, Slack |
| devops | 6 | CI, Docker, K8s |
| legal-uk | 4 | GDPR, contracts, filings |
| sales-crm | 4 | Pipeline, proposals |
| property-uk | 6 | UK property workflows |

## Community Skills Hub

The public registry lists every published pack and individual skill. Browse at [hub.carinaai.uk](https://hub.carinaai.uk/) or query from the CLI:

```bash
carina hub browse          # hub URL and install hint
carina hub status          # pack/skill counts
carina hub packs           # list packs (optional search term)
carina hub skills stamp    # search skills by name or trigger
carina hub install property-uk
```

Self-host with `carina hub start` (or `pnpm hub`) and `SKILLS_HUB_*` env vars. The hub seeds built-in packs from the repo on startup and serves a web UI plus JSON APIs at `/api/packs`, `/api/skills`, and `/api/registry`.

## Auto-written skills

When `SKILL_AUTO_WRITE` is not `false`, Carina evaluates completed tasks and may save new skills to Postgres with Jaccard deduplication (80% overlap threshold). List them with `/skills` in the CLI.

## Learn more

- [All packs (marketing)](https://carinaai.uk/skill-packs/) - visual catalogue at carinaai.uk
- [property-uk](/docs/user/skill-packs/property-uk) - optional UK property vertical
- [Creating packs](/docs/user/skill-packs/creating-packs) - author and publish your own
