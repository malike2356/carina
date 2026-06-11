# Contributing to Carina

Carina core is **MIT licensed**. You can use it, fork it, and contribute back without a CLA.

**Public repo:** [github.com/malike2356/carina-agent](https://github.com/malike2356/carina-agent)  
**npm:** [carina-agent](https://www.npmjs.com/package/carina-agent)  
**Docs:** [carinaai.uk/docs](https://carinaai.uk/docs/)  
**Community chat:** [GitHub Discussions](https://github.com/malike2356/carina-agent/discussions)

## Ways to contribute

| Path | Best for | Start here |
|------|----------|------------|
| **Skill packs** | Domain experts, lowest code barrier | [Creating packs](https://carinaai.uk/docs/user/skill-packs/creating-packs) |
| **Issues** | Bugs and ideas | [New issue](https://github.com/malike2356/carina-agent/issues/new/choose) |
| **Pull requests** | Code, tests, docs | This file + `pnpm test` |
| **Discussions** | Questions, show-and-tell | [Discussions](https://github.com/malike2356/carina-agent/discussions) |

New contributors: look for issues labeled **`good first issue`**.

## Development setup

1. **Node.js 22+** and **pnpm 9+**
2. **PostgreSQL 16** with pgvector and **Redis 7** (for full memory and gateway features)
3. Clone and build:

```bash
git clone https://github.com/malike2356/carina-agent.git
cd carina-agent
pnpm install
pnpm build
pnpm test
```

Run locally:

```bash
pnpm dev          # watch mode
pnpm cli          # interactive CLI + gateway
pnpm hub          # Skills Hub on :3001
```

Copy `.env.example` to `.env` for provider keys. Never commit `.env`.

## Code style

- Match existing TypeScript in `src/`: two-space indent, semicolons, ESM imports
- Functions stay focused; avoid drive-by refactors in bug-fix PRs
- Tool names: kebab-case; MCP-compatible JSON Schema
- Tests document behaviour; run `pnpm test` before every PR

## Adding a tool

1. Create `src/tools/your-tool.ts` with schema and handler
2. Register in `src/tools/toolset.ts` / registry as per neighbouring tools
3. Add a Vitest test beside the tool or under `src/tools/*.test.ts`
4. Document at [carinaai.uk/docs](https://carinaai.uk/docs/) (open a docs PR in the main docs site or describe in PR)

## Publishing a skill pack (recommended first contribution)

Skill packs add domain workflows, RAG knowledge, and prompt suffixes without changing core.

1. Copy layout from `src/skills/packs/property-uk/`
2. Add `pack.json`, `skills.ts`, optional `knowledge/**/*.md`
3. Validate locally:

```bash
pnpm ingest --pack your-pack-name
ACTIVE_SKILL_PACKS=your-pack-name pnpm cli
```

4. Open a PR adding the pack under `src/skills/packs/your-pack/` **or** publish to [skills.carinaai.uk](https://skills.carinaai.uk) with a hub key
5. No API keys, credentials, or private customer data in pack content

Full guide: [Creating skill packs](https://carinaai.uk/docs/user/skill-packs/creating-packs).

## Pull requests

- One logical change per PR when possible
- `pnpm test` and `pnpm build` must pass
- Link related issues (`Fixes #123`)
- User-facing changes need README or docs updates

## Community standards

Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report conduct issues to **conduct@carinaai.uk**.

## Security

Do not file public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## What is out of scope for this repo

This repository is **Carina core only**. These live in separate VERLOX products:

- Labyrinth Scout server (`console.labyrinthscout.com`)
- VERLOX ops admin panel
- Hosted Carina Cloud operations

Integrations with Scout are documented at [carinaai.uk/docs](https://carinaai.uk/docs/user/security/labyrinth-scout).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
