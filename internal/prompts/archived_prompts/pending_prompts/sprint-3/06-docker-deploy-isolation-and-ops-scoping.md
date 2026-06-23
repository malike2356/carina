# COMPLETED

## What was built

- `docker-compose.white-label.yml` overlay with per-stack network naming (`<stack>_net`, `<stack>_carina`).
- `scripts/deploy-white-label-stack.sh` and `scripts/smoke-docker-scope.sh` deploy/smoke helpers.
- `docker/white-label/stack.env.example` template env file.
- Ops scoping: `getDockerScopeInfo()`, `CARINA_WHITE_LABEL_STACK` support, project column in services UI, scope in API JSON.
- Extended `server-services.test.ts` for white-label stack filtering.
- `OPS_DOCKER_PROJECTS` / `CARINA_WHITE_LABEL_STACK` documented in ops `.env.example`.

---

# Prompt 06 - Docker Deploy Isolation and Ops Scoping

## Objective

Make white-label deployments behave like separate products on the same host. Each tenant or product line should run in its own Docker stack, own its own network, and stay invisible to unrelated stacks in the ops tooling unless explicitly allowed.

---

## Context

**Working areas:**

- `backends/servers/core.carinaai.uk/docker-compose.prod.yml`
- `backends/servers/core.carinaai.uk/docker/`
- `backends/servers/core.carinaai.uk/deploy.sh`
- `backends/servers/core.carinaai.uk/start.sh`
- `backends/admin/ops.carinaai.uk/lib/server-services.ts`
- `backends/admin/ops.carinaai.uk/routes/server-panel.ts`
- `backends/admin/ops.carinaai.uk/views/server/services.ejs`
- `internal/prompts/pending_prompts/README.md`

The repo already has Dockerized Carina, Scout, and ops tooling. This prompt should extend that approach to white-label customers without reintroducing host-wide coupling.

---

## Required Work

1. Define per-tenant or per-product Docker stack conventions for white-label installs.
2. Make the ops service list respect an allowlist or project scope instead of exposing every host container.
3. Add explicit network naming and stack isolation rules for customer deployments.
4. Add deploy helpers or scripts that can create and update a branded tenant stack without manual container edits.
5. Make sure restart and health check behavior stays scoped to the relevant stack.
6. Add tests or smoke scripts that prove unrelated containers stay hidden from the white-label deployment view.

---

## Key Files to Update

- `backends/servers/core.carinaai.uk/docker-compose.prod.yml`
- `backends/servers/core.carinaai.uk/docker/nginx/`
- `backends/admin/ops.carinaai.uk/lib/server-services.ts`
- `backends/admin/ops.carinaai.uk/routes/server-panel.ts`
- `backends/admin/ops.carinaai.uk/views/server/services.ejs`
- `backends/servers/core.carinaai.uk/scripts/`

---

## Constraints

- Do not let the ops console show unrelated customer stacks by default.
- Do not rely on manual container naming conventions alone.
- Keep the current Carina and Scout stacks working while adding white-label scope.
- Use deliberate shared resources only where the platform truly needs them.

---

## Done When

- white-label stacks can be deployed without manual Docker surgery
- ops views are scoped and policy driven
- unrelated project containers stay hidden unless explicitly allowed
- deploy and smoke scripts exist for customer stacks
