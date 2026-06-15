# Contributing to Carina

Thank you for contributing to the MIT kernel. Carina is the free, open-source agent engine; tools, memory, channels, model routing, and domain packs. You can use it, fork it, and contribute back without a CLA.

**Public repo:** [github.com/malike2356/carina-agent](https://github.com/malike2356/carina-agent)  
**npm:** [carina-agent](https://www.npmjs.com/package/carina-agent)  
**Docs:** [carinaai.uk/docs](https://carinaai.uk/docs/)  
**Manifesto:** [MANIFESTO.md](../MANIFESTO.md) (monorepo root) or [docs manifesto](https://carinaai.uk/docs/developer/manifesto)  
**Community:** [GitHub Discussions](https://github.com/malike2356/carina-agent/discussions) (Discord: TBD)

## What to contribute

| Area | Examples |
|------|----------|
| **Tools** | New tool handlers, MCP integrations, registry fixes |
| **Channels** | Gateway adapters (Telegram, Slack, web, API) |
| **Domain packs** | Vertical skill packs under `src/skills/packs/` |
| **Docs** | README, CONTRIBUTING, user-facing accuracy |
| **Tests** | Vitest coverage for tools, security policy, API handlers |

Look for issues labeled **`good first issue`**, **`help wanted`**, **`pack`**, **`tool`**, or **`channel`**.

Curated starter tasks: [good-first-issues index](docs/kernel/good-first-issues/README.md) (monorepo) or GitHub issues [#9](https://github.com/malike2356/carina-agent/issues/9) through [#13](https://github.com/malike2356/carina-agent/issues/13).

## What NOT to contribute here

This repository is **Carina core only**. Do not open PRs for:

- Labyrinth Scout server code (`console.labyrinthscout.com`)
- VERLOX ops admin panel (`ops.carinaai.uk`)
- Hosted Carina Cloud operations secrets or tenant data
- API keys, `.env` files, or VPS credentials

Scout integration in core is optional via `LABYRINTH_ENABLED` and the Scout client SDK only. See [Labyrinth Scout docs](https://carinaai.uk/docs/user/security/labyrinth-scout).

## Development setup

Requirements: **Node.js 22+**, **pnpm 9+**. For full memory and gateway features: **PostgreSQL 16** with pgvector and **Redis 7**.

```bash
git clone https://github.com/malike2356/carina-agent.git
cd carina-agent
pnpm install
cp .env.example .env
pnpm build
pnpm test
pnpm carina --help
```

Run locally:

```bash
pnpm dev          # watch mode
pnpm cli          # interactive CLI + gateway
pnpm hub          # Skills Hub on :3001
```

Never commit `.env`. Fill provider keys locally only.

## Code style

- TypeScript ESM, two-space indent, semicolons, single quotes
- Match existing patterns in `src/`; no drive-by refactors in bug-fix PRs
- Tool names: kebab-case; MCP-compatible JSON Schema
- **No emojis** in code, comments, commits, or docs
- **No em-dashes or en-dashes** in prose; use commas, colons, or sentence breaks
- Tests document behaviour; run `pnpm test` before every PR

## Adding a tool

1. Create `src/tools/your-tool.ts` with schema and handler
2. Register in `src/tools/toolset.ts` / registry as per neighbouring tools
3. Add a Vitest test beside the tool or under `src/tools/*.test.ts`
4. Document at [carinaai.uk/docs](https://carinaai.uk/docs/) or describe in PR

## Domain packs (recommended first contribution)

Skill packs add domain workflows, RAG knowledge, and prompt suffixes without changing core.

**Start here:** [Build your first domain pack](https://carinaai.uk/docs/developer/first-domain-pack) (30 min tutorial).

1. Copy layout from `src/skills/packs/template/` or `packages/packs/_template/`
2. Add `pack.json`, `skills.ts`, optional `knowledge/**/*.md`
3. Validate locally:

```bash
pnpm ingest --pack your-pack-name
ACTIVE_SKILL_PACKS=your-pack-name pnpm cli
```

4. Open a PR adding the pack under `src/skills/packs/your-pack/` **or** publish to [skills.carinaai.uk](https://skills.carinaai.uk) with a hub key
5. No API keys, credentials, or private customer data in pack content

Guides:

- [Creating skill packs](https://carinaai.uk/docs/user/skill-packs/creating-packs)
- [Build your first domain pack](https://carinaai.uk/docs/developer/first-domain-pack) (30 min tutorial)
- [Developer packs reference](https://carinaai.uk/docs/developer/skills/packs)

## Pull requests

- Fork, branch, test, open PR against `main`
- One logical change per PR when possible
- `pnpm test` and `pnpm build` must pass
- Link related issues (`Fixes #123`)
- User-facing changes need README or docs updates

Use the PR template: summary, test commands run, affected area (core / pack / docs / channel).

## RFC process (API and manifest changes)

For changes to the **stable public API**, tool registry contracts, or breaking `pack.json` fields, open an RFC before implementation:

```bash
carina rfc propose "Your change title"
carina rfc list
```

1. Edit `docs/rfc/NNNN-your-title.md` (Summary, Motivation, Design, Drawbacks, Alternatives).
2. Optional: post a draft in [GitHub Discussions](https://github.com/malike2356/carina-agent/discussions) (RFCs category).
3. Open a PR with the RFC file only; implementation follows after `Accepted`.

Full guide: [RFC process](https://carinaai.uk/docs/developer/rfc-process) and [STABLE_API.md](docs/kernel/STABLE_API.md).

Bug fixes, docs, and optional pack fields (minor semver) do not require an RFC.

## Community standards

Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report conduct issues to **conduct@carinaai.uk**.

## Security

Do not file public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
