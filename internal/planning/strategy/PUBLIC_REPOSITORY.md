# Public repository split (carina-agent core only)

The private monorepo `malike2356/carina-ai` contains VERLOX internal code that must **never** be made public:

| Keep private | Why |
|---|---|
| `ops.carinaai.uk/` | Internal admin panel |
| `console.labyrinthscout.com/` | Scout server product |
| `instructions/`, `prompts/` | Internal build prompts and strategy |
| `scripts/deploy-*.sh` | VPS hosts and deploy paths |
| `labyrinthscout.com/`, marketing trees | OK to deploy statically; source can stay private |
| Git history on `carina-ai` | May contain secrets, `.env` leaks, internal commits |

**Do not** flip `carina-ai` to public. Use a **new repo with fresh history** containing only `core.carinaai.uk`.

## Target layout

| Repo | Visibility | Contents |
|---|---|---|
| `malike2356/carina-ai` | **Private** | Full VERLOX monorepo (current workspace) |
| `malike2356/carina-agent` | **Public** | Exported `core.carinaai.uk` only (matches npm package name) |

npm package `carina-agent` is already live. Point its `repository` field at the public repo on the next publish.

## What the public export includes

- `src/`, `bin/`, `brain/`, `templates/`, `public/`, `docker/`
- `docker-compose.yml`, `docker-compose.prod.yml` (not `docker-compose.verlox.yml`)
- `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `install.sh`
- `README.md`, `README.cli.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`
- `docs/kernel/` (STABLE_API, brand rules), `docs/rfc/` (RFC proposals)
- `.env.example`, `.env.production.example`
- GitHub Actions CI + npm publish workflows

## What the export excludes

- `prompts/`, `CLAUDE.md`, `.agents/`, `.codex/`
- `docs/` (legacy VitePress; canonical docs live at [carinaai.uk/docs](https://carinaai.uk/docs/))
- `data/`, `dist/`, `node_modules/`, `.env`
- `deploy.sh` (VPS IP and operator paths)
- `docker-compose.verlox.yml` (references `ops.carinaai.uk` and Scout)
- Scout server tree (`console.labyrinthscout.com/`) is never inside `core.carinaai.uk`; boundary check runs before export

Edit `scripts/public-repo/.public-exportignore` to tune the list.

The export includes optional workspace packages under `packages/` (`@verlox/carina-web`, `@verlox/carina-scout`, `@carina/pack-*`). It does **not** include the Scout server or VERLOX ops panel.

## Export and push (one-time setup)

From the **private** monorepo root:

```bash
bash scripts/export-carina-core-public.sh
cd ../carina-agent-public
git init -b main
git add .
git commit -m "feat: initial public release of carina-agent core"
gh repo create malike2356/carina-agent --public --description "Carina AI agent core (npm: carina-agent)" --source=. --remote=origin --push
```

If the GitHub repo already exists empty:

```bash
git remote add origin git@github.com:malike2356/carina-agent.git
git push -u origin main
```

## After the public repo is live

1. **npm**; bump patch version and publish so `repository` on npm points at `carina-agent`:

   ```bash
   # In core.carinaai.uk/package.json, set:
   # "repository": { "type": "git", "url": "git+https://github.com/malike2356/carina-agent.git" }
   bash scripts/publish-carina-agent.sh
   ```

2. **Docs**; update clone URL in `docs.carinaai.uk/docs/user/getting-started.md`:

   ```bash
   git clone https://github.com/malike2356/carina-agent.git
   cd carina-agent
   pnpm install && pnpm build && pnpm cli
   ```

3. **Marketing**; point GitHub links at `carina-agent`, not `carina-ai`.

4. **GitHub repo settings** (public `carina-agent`):
   - Website: `https://carinaai.uk`
   - Topics: `ai`, `agent`, `llm`, `carina`
   - Add README description; enable Issues if you want community feedback

5. **Secrets**; add `NPM_TOKEN` to the public repo for release publishing (optional).

## Ongoing workflow

When you ship core changes from the private monorepo:

```bash
# 1. Develop and test in core.carinaai.uk (private monorepo)
cd core.carinaai.uk && pnpm test

# 2. Re-export and push public mirror
bash scripts/export-carina-core-public.sh
cd ../carina-agent-public
git add -A && git commit -m "chore: sync from private monorepo" && git push

# 3. Publish npm when ready
bash scripts/publish-carina-agent.sh
```

Longer term you can automate sync with a private GitHub Action that pushes to `carina-agent` on tags.

## Fix nested git in core (recommended)

`core.carinaai.uk/.git` duplicates the monorepo remote and confuses exports. After backing up, remove the nested repo so only the monorepo root tracks git:

```bash
rm -rf core.carinaai.uk/.git
```

Commit that removal in the **private** monorepo only.

## Pre-flight security checklist

Before the first public push:

- [ ] Run `git secrets` or `gitleaks` on the **export directory** (not only the monorepo)
- [ ] Confirm no `.env`, API keys, or VPS passwords in exported files
- [ ] Confirm `brain/` corpus has no customer PII you should not publish
- [ ] Review `src/` for hardcoded operator credentials
- [ ] Keep `carina-ai` private permanently
