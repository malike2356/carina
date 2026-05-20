# Git ↔ production mirror policy

Goal: **application code** on GitHub, your dev machine (**tsalach**), and MIS production (**aman**) always represent the same release. If you lose one copy, you can rebuild from another.

This does **not** mirror databases, `.env` secrets, uploaded files in `storage/app`, or `vendor/` (those are rebuilt or backed up separately).

---

## The three copies (MIS v2)

| Copy | Location | Role |
|------|----------|------|
| **GitHub** | `malike2356/propreneur-v2` | Canonical history, branches, PRs, CI |
| **Local dev** | tsalach clone (e.g. `/opt/lampp/htdocs/VERLOX/propreneur/propreneur-v2`) | Edit, test, deploy |
| **Production** | aman `/www/wwwroot/propreneur-v2` | Live `propreneur.uk` (no `.git` on server — by design) |

**Marketing** (`propreneur.co.uk` on HostGator) is a separate repo path; it uses `git pull` on HostGator only. See `propreneur.co.uk/README.md`.

---

## Golden rules

1. **Every production deploy starts from Git** — commit locally → `git push origin main` → `./scripts/deploy-to-production.sh`.
2. **Never edit PHP/Blade/JS on aman for “real” fixes** — patch on tsalach, push, deploy. Emergency server edits must be synced back (below) the same day.
3. **Production records which commit it is** — after each deploy, `storage/app/deploy-manifest.json` on aman stores commit SHA, branch, and timestamp.
4. **Check mirror before/after releases** — `./scripts/check-production-mirror.sh`.

---

## Normal flow (Git → production)

```bash
cd /path/to/propreneur-v2
git status                    # must be clean (or use --allow-dirty only for emergencies)
git add … && git commit -m "…"
git push origin main
./scripts/deploy-to-production.sh
./scripts/check-production-mirror.sh   # should say IN SYNC
```

Deploy script behaviour:

- `git pull origin main` on tsalach
- Fails if local is **behind** or **ahead of** `origin/main` (unpushed commits)
- Fails if working tree is dirty (unless `--allow-dirty`)
- Rsyncs code to aman (excludes `.env`, `vendor`, runtime storage)
- Writes `storage/app/deploy-manifest.json` on the server

---

## Recovery: production → Git (lost laptop or corrupt clone)

If aman still runs but GitHub or your clone is wrong:

```bash
cd /path/to/propreneur-v2
./scripts/sync-from-production.sh          # prompts for confirmation
composer install
git checkout -b recovery/from-production-$(date +%Y%m%d)
git add -A && git status                   # review!
git commit -m "Recovery: sync application code from production"
git push -u origin recovery/from-production-…
# merge to main via PR after review
```

---

## Recovery: Git → production (lost VPS tree)

If GitHub is good but aman was wiped or broken:

```bash
# On tsalach
git clone git@github.com:malike2356/propreneur-v2.git
cd propreneur-v2
cp scripts/deploy.env.example scripts/deploy.env
./scripts/deploy-to-production.sh --build-assets
```

Restore `.env`, databases, and SSL from backups (see `docs/DEPLOYMENT.md`).

---

## Recovery: GitHub lost

1. Push from **any** machine that still has a full clone: `git push origin main --force` (only if you trust that clone).
2. Or run `sync-from-production.sh` on a fresh clone, commit, push to a new GitHub repo, update remotes.

---

## Scripts

| Script | Direction | Purpose |
|--------|-----------|---------|
| `deploy-to-production.sh` | Git → aman | Standard release |
| `sync-from-production.sh` | aman → local | Disaster recovery into Git |
| `check-production-mirror.sh` | compare | Local HEAD vs production manifest |

---

## What is intentionally not mirrored

| Item | Why |
|------|-----|
| `.env` | Different per environment; never rsync to production |
| `vendor/` | Built with `composer install` on each side |
| `node_modules/` | Built with `npm ci` |
| `storage/logs`, sessions, cache | Runtime only |
| PostgreSQL / tenant DBs | Use DB backups (migrations + dumps) |
| `.git` on aman | Removed for security; use manifest + GitHub instead |

---

## Related

- Full deploy runbook: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- Monorepo Git/deploy standards: `/.documentations/GIT_GITHUB_AND_DEPLOY_STANDARD.md` (on machines with `_local` docs symlink)
