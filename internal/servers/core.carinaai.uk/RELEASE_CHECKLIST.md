# carina-agent release checklist

Use this before publishing `carina-agent` to npm. Run commands from `core.carinaai.uk/`.

## Pre-release

- [ ] Bump `version` in `package.json` (semver)
- [ ] Update `README.md` and `docs/getting-started.md` if install or first-run behavior changed
- [ ] Confirm `bin`, `files`, `publishConfig.access`, and `engines.node` in `package.json`
- [ ] No secrets in the tarball (`.env`, `.npmrc.publish`, tokens)

## Build and test

```bash
pnpm build
pnpm test
pnpm test:smoke
```

`prepublishOnly` runs `pnpm build && pnpm test` automatically on `npm publish`.

## Smoke install (manual)

```bash
bash scripts/smoke-install.sh
```

Verifies: `npm pack`, global-style install in a temp home, `carina --version`, non-interactive `carina setup`, CLI banner, `carina doctor`, and `npx carina-agent --version`.

## Publish

```bash
# from repo root (uses NPM_TOKEN or npm login)
bash ../scripts/publish-carina-agent.sh
```

Or from this directory:

```bash
npm publish --access public
```

## Post-publish

- [ ] `npm view carina-agent version` matches the release
- [ ] Fresh machine: `npm install -g carina-agent && carina --version`
- [ ] Optional: `npx carina-agent --version`
- [ ] Git tag: `git tag v0.1.x && git push origin v0.1.x`
- [ ] Release notes on GitHub (install paths, breaking changes, Node 22+ requirement)

## Install paths (document in release notes)

| Path | Command |
|---|---|
| Global CLI | `npm install -g carina-agent` then `carina` |
| One-shot | `npx carina-agent` |
| curl installer | `curl -fsSL https://install.carinaai.uk \| sh` (when host is live) |
| First-run setup | `carina setup` or automatic on first `carina` / `carina tui` |
