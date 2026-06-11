# Contributing and community

Carina core is MIT licensed. You can install from npm, clone source, and contribute without a contributor agreement.

## Start here

| Resource | Link |
|----------|------|
| Source (core only) | [github.com/malike2356/carina-agent](https://github.com/malike2356/carina-agent) |
| npm package | [carina-agent](https://www.npmjs.com/package/carina-agent) |
| Community hub | [carinaai.uk/community](https://carinaai.uk/community) |
| Questions and ideas | [GitHub Discussions](https://github.com/malike2356/carina-agent/discussions) |
| Bugs and features | [Issues](https://github.com/malike2356/carina-agent/issues/new/choose) |
| Conduct | [CODE_OF_CONDUCT](https://github.com/malike2356/carina-agent/blob/main/CODE_OF_CONDUCT.md) |

The private `carina-ai` monorepo is VERLOX internal (ops, Scout server, deploy). Contributors work in **`carina-agent`** only.

## Best first contribution: a skill pack

Skill packs are the lowest barrier and highest leverage path. You add domain workflows and knowledge without changing the agent core.

1. Read [Creating packs](/docs/user/skill-packs/creating-packs)
2. Study `property-uk` in the public repo under `src/skills/packs/property-uk/`
3. Propose your pack with the [skill pack issue template](https://github.com/malike2356/carina-agent/issues/new?template=skill_pack.yml)
4. Open a PR or publish to [skills.carinaai.uk](https://skills.carinaai.uk)

## Development from source

```bash
git clone https://github.com/malike2356/carina-agent.git
cd carina-agent
pnpm install
pnpm build
pnpm test
```

See [Getting started](/docs/user/getting-started) for Postgres, Redis, and first-run setup.

## Code contributions

- Fork `carina-agent`, branch from `main`
- Run `pnpm test` and `pnpm build` before opening a PR
- One focused change per PR when possible
- Full guide: [CONTRIBUTING.md](https://github.com/malike2356/carina-agent/blob/main/CONTRIBUTING.md)

Look for issues labeled **`good first issue`**.

## What to build together

| Area | Examples |
|------|----------|
| Skill packs | Finance, legal, healthcare workflows (your domain expertise) |
| Tools | New MCP-compatible tools with tests |
| Gateways | Channel adapter improvements, docs for setup |
| Providers | New LLM provider wiring |
| Docs | Tutorials, troubleshooting, examples |

## Commercial vs open source

| Open (MIT) | Commercial (VERLOX) |
|------------|---------------------|
| `carina-agent` core | [Carina Cloud](https://app.carinaai.uk) hosted SaaS |
| Skill packs you author | [Labyrinth Scout](https://labyrinthscout.com) security monitoring |
| Self-host with Docker/npm | Enterprise trust and provisioning |

You can self-host Carina for free under MIT and optionally add Scout or Cloud later.

## Security

Report vulnerabilities privately per [SECURITY.md](https://github.com/malike2356/carina-agent/blob/main/SECURITY.md). Do not open public issues for security bugs.
