# Domain pack template

Copy this folder to start a new `@carina/pack-*` npm package.

See also:

- `core.carinaai.uk/docs/kernel/good-first-issues/02-pack-template-hello-world.md`
- [Creating packs](/docs/user/skill-packs/creating-packs)
- [Publishing a pack](/docs/developer/publishing-a-pack)

## Checklist

1. Rename folder and set `pack.json` `name` slug (kebab-case).
2. Add `package.json` with `"carina": { "pack": "./pack.json", "slug": "your-slug" }`.
3. Implement `skills.ts` and optional `src/index.ts` exports (`skills`, `systemSuffix`).
4. Add knowledge markdown under `knowledge/` for RAG ingest.
5. Publish: `npm publish` for npm; `carina pack publish .` for Hub listing.

## Minimal `package.json`

```json
{
  "name": "@carina/pack-example",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "carina": { "pack": "./pack.json", "slug": "example" },
  "peerDependencies": { "@verlox/carina-core": "^0.2.0" }
}
```
