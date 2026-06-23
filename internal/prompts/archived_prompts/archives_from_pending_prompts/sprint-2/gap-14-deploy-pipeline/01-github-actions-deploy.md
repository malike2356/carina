# Gap 14 - Prompt 01: GitHub Actions Deploy Job

**Status: COMPLETED 2026-06-21**

**Gap:** 14 Deploy Pipeline
**Prompt number:** 01 of 03
**Name:** Add deploy workflow to GitHub Actions
**Primary agent:** Claude Code
**Estimated hours:** 1-2 h
**Depends on:** gap-13-docker-migration prompts 01-03 COMPLETED (they are); VPS has Docker stacks ready

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `.github/workflows/ci.yml` - the existing CI; deploy job must depend on it
2. `scripts/deploy-carina.sh` - the current manual deploy script (rsync + SSH)
3. `internal/servers/core.carinaai.uk/docker/scripts/deploy-prod.sh` - the on-VPS deploy script

---

## Context

CI tests pass on every push to `main`. Nothing goes to prod automatically. The deploy requires
a developer to run `bash scripts/deploy-carina.sh` from their machine, which means:
- Deploys only happen when a dev is available
- Multi-agent workflows (Cursor + Claude Code + Codex) can merge to main without triggering a deploy
- No audit trail of who triggered which deploy

## Goal

Add a GitHub Actions workflow (`.github/workflows/deploy.yml`) that:
1. Triggers automatically after `ci.yml` succeeds on the `main` branch
2. Can also be triggered manually via `workflow_dispatch` (with an optional `force` flag to skip CI check)
3. SSHes to the VPS and runs the deploy steps
4. Posts a deploy summary (success or failure) as a workflow annotation

The deploy job should NOT run on pull requests or on branches other than `main`.

---

## Step 1: Store the VPS SSH key as a GitHub Actions secret

Add these secrets to the GitHub repo (`Settings > Secrets and variables > Actions`):

| Secret name | Value |
|---|---|
| `VPS_SSH_KEY` | Private key for `malike@80.190.81.208` (the key already in `~/.ssh/`) |
| `VPS_HOST` | `80.190.81.208` |
| `VPS_USER` | `malike` |

These are used by the deploy job only. Do not hardcode them in the workflow file.

---

## Step 2: Create `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      force:
        description: "Deploy even if CI did not run (use with caution)"
        type: boolean
        default: false

concurrency:
  group: deploy-production
  cancel-in-progress: false  # Never cancel an in-progress deploy

jobs:
  deploy:
    name: Deploy to production VPS
    runs-on: ubuntu-latest
    if: >
      github.event_name == 'workflow_dispatch' ||
      (github.event.workflow_run.conclusion == 'success' &&
       github.event.workflow_run.head_branch == 'main')

    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

      - name: Set up SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.VPS_SSH_KEY }}" > ~/.ssh/vps_deploy
          chmod 600 ~/.ssh/vps_deploy
          ssh-keyscan -H "${{ secrets.VPS_HOST }}" >> ~/.ssh/known_hosts

      - name: Sync Carina core to VPS
        run: |
          rsync -az --delete \
            --exclude='.env' --exclude='.env.*' \
            --exclude='node_modules' --exclude='.git' --exclude='/data/' \
            -e "ssh -i ~/.ssh/vps_deploy" \
            internal/servers/core.carinaai.uk/ \
            "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/home/malike/apps/core.carinaai.uk/"

      - name: Sync ops to VPS
        run: |
          rsync -az --delete \
            --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='dist' \
            -e "ssh -i ~/.ssh/vps_deploy" \
            internal/admin/ops.carinaai.uk/ \
            "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/home/malike/apps/ops.carinaai.uk/"

      - name: Sync Cloud UI to VPS
        run: |
          rsync -az --delete \
            --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='.next' \
            -e "ssh -i ~/.ssh/vps_deploy" \
            external/client-apps/app.carinaai.uk/ \
            "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/home/malike/apps/app.carinaai.uk/"

      - name: Sync Scout console to VPS
        run: |
          rsync -az --delete \
            --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='dist' \
            -e "ssh -i ~/.ssh/vps_deploy" \
            internal/servers/console.labyrinthscout.com/ \
            "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/home/malike/apps/console.labyrinthscout.com/"

      - name: Sync Scout engine to VPS
        run: |
          rsync -az --delete \
            --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='dist' \
            -e "ssh -i ~/.ssh/vps_deploy" \
            internal/servers/scout-engine/ \
            "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/home/malike/apps/scout-engine/"

      - name: Run Carina deploy on VPS
        run: |
          ssh -i ~/.ssh/vps_deploy \
            "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}" bash <<'REMOTE'
          set -euo pipefail
          docker network inspect proxy >/dev/null 2>&1 || docker network create proxy
          cd /home/malike/apps/core.carinaai.uk
          export CARINA_OPS_CONTEXT=/home/malike/apps/ops.carinaai.uk
          export CARINA_OPS_DOCKERFILE=docker/Dockerfile.runtime
          export CARINA_CLOUD_CONTEXT=/home/malike/apps/app.carinaai.uk
          export CARINA_CLOUD_DOCKERFILE=docker/Dockerfile
          export CARINA_SSL_DIR=/etc/carina/ssl
          python3 docker/scripts/sync-docker-env.py
          python3 docker/scripts/sync-ops-env.py
          python3 docker/scripts/sync-cloud-env.py
          bash docker/scripts/stop-bare-metal-carina.sh
          bash docker/scripts/deploy-prod.sh
          REMOTE

      - name: Run Scout deploy on VPS
        run: |
          ssh -i ~/.ssh/vps_deploy \
            "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}" bash <<'REMOTE'
          set -euo pipefail
          cd /home/malike/apps/console.labyrinthscout.com
          export SCOUT_ENGINE_CONTEXT=/home/malike/apps/scout-engine
          docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
          REMOTE

      - name: Health check
        run: |
          sleep 15
          curl -fsS --retry 5 --retry-delay 5 https://core.carinaai.uk/api/health
          curl -fsS --retry 5 --retry-delay 5 https://console.labyrinthscout.com/api/health
          echo "Deploy successful"

      - name: Post deploy summary
        if: always()
        run: |
          if [ "${{ job.status }}" = "success" ]; then
            echo "## Deploy succeeded" >> $GITHUB_STEP_SUMMARY
            echo "Commit: ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
          else
            echo "## Deploy FAILED" >> $GITHUB_STEP_SUMMARY
            echo "Commit: ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
            echo "Check the steps above for the failure." >> $GITHUB_STEP_SUMMARY
          fi
```

---

## Step 3: Add SSH key to VPS authorised_keys

On the VPS, confirm the deploy key is authorised:
```bash
ssh malike@80.190.81.208
cat ~/.ssh/authorized_keys | grep -c "." && echo "keys exist"
```

If the key used to generate `VPS_SSH_KEY` is not in `authorized_keys`, add it:
```bash
echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

---

## Step 4: Scope permissions on the deploy key (optional but recommended)

Create a dedicated deploy keypair (separate from the developer SSH key):
```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/carina_deploy -N ""
cat ~/.ssh/carina_deploy.pub  # Add this to VPS authorized_keys
cat ~/.ssh/carina_deploy      # Add this to GitHub secret VPS_SSH_KEY
```

Restrict the key to specific commands if the SSH server supports it (add to `authorized_keys`):
```
restrict,command="/usr/bin/rsync --server ...",pty,no-agent-forwarding ssh-ed25519 AAAA...
```

---

## Verification

```bash
# Push to main and watch the Actions tab
git push origin main

# Manual trigger (deploy without a CI run):
# Go to Actions > Deploy > Run workflow
```

Expected result:
- `CI` workflow runs tests
- On success, `Deploy` workflow starts automatically
- All five rsync syncs complete
- Both docker compose stacks update in Docker
- Health checks return 200

---

## Verification checklist

- [ ] `.github/workflows/deploy.yml` created and pushed to main
- [ ] `VPS_SSH_KEY`, `VPS_HOST`, `VPS_USER` secrets added to GitHub repo
- [ ] First automatic deploy completes without error
- [ ] `curl https://core.carinaai.uk/api/health` returns 200 post-deploy
- [ ] `curl https://console.labyrinthscout.com/api/health` returns 200 post-deploy
- [ ] `workflow_dispatch` manual trigger works
