# Creating Skill Packs

Publish vertical packs to the Skills Hub or ship them privately with your Carina deployment.

:::tip Community contribution
Skill packs are the recommended first contribution to Carina. Propose a pack on [GitHub](https://github.com/malike2356/carina-mutant/issues/new?template=skill_pack.yml) or read the [contributing guide](/docs/user/contributing).
:::

## Pack layout

```
my-pack/
├── pack.json
├── skills.ts          # export SkillDefinition[]
├── prompts/
│   └── system.ts      # getPackSystemSuffix()
├── knowledge/         # .md files for RAG
└── tools/             # optional Tool implementations
```

### `pack.json`

```json
{
  "name": "my-pack",
  "version": "1.0.0",
  "description": "Short description for the hub",
  "author": "Your Org",
  "minCarinaVersion": "0.1.0"
}
```

## Skills format

Each skill needs `name`, `description`, `trigger` (keyword array), and `content` (markdown body). Follow the six skills in `src/skills/packs/property-uk/skills.ts` as a template.

## Ingestion

Point ingestion at your pack directory:

```bash
tsx src/skills/ingestion.ts --pack my-pack
```

Knowledge files should be plain markdown without embedded credentials. The hub validator rejects packs that scan positive for API key patterns.

## Validation before publish

```bash
pnpm hub
# POST /packs with SKILLS_HUB_PUBLISH_KEY
```

Hub validation checks `pack.json`, minimum knowledge document count, and credential scans.

## Export / import

Use `exportPack()` and `importPack()` from `src/skills/index.ts` for tarball distribution outside the hub.

## Testing

Run Carina locally with:

```
ACTIVE_SKILL_PACK=my-pack
```

Confirm triggers fire and RAG retrieves chunks via domain-specific questions.

## Share with the community

1. Open a PR adding your pack under `src/skills/packs/` in [carina-mutant](https://github.com/malike2356/carina-mutant), or
2. Publish to [skills.carinaai.uk](https://skills.carinaai.uk) with a hub publish key, or
3. Post in [GitHub Discussions](https://github.com/malike2356/carina-mutant/discussions/categories/show-and-tell) to get feedback before publishing
