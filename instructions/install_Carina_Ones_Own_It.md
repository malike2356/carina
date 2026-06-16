# Install Carina - Own It

Architecture decision record for the install-and-own pattern: how a product (distro)
built on the Carina kernel installs Carina as a pinned npm dependency, runs it as an
internal supervised service, survives Carina crashes, and controls its own update cycle.

## Summary

A Carina distro (example: ABBIS) does NOT call carinaai.uk at runtime. It installs
`carina-agent` at an exact version into its own `node_modules/`, runs it as an internal
Docker service on the same server, and manages updates as a deliberate team action.

Three tools solve three problems:

| Problem | Solution |
|---------|----------|
| Dependency on carinaai.uk being up | npm lockfile: Carina code lives in node_modules/ after install |
| Crash recovery | Docker restart: supervisor restarts from installed code, no download |
| Update awareness | Daily BullMQ job: polls npm registry, creates admin notification |

## Implementation prompts

All implementation work is in `action-prompts/carina-distro/`:

| Prompt | What it builds |
|--------|---------------|
| `00-distro-workspace-scaffold.md` | ABBIS pnpm monorepo skeleton |
| `01-pin-carina-dependency.md` | Carina pinned in apps/carina with lockfile |
| `02-docker-sidecar.md` | Docker Compose with Carina as internal supervised service |
| `03-graceful-degradation.md` | ABBIS API health check and AI feature fallback |
| `04-version-check-job.md` | Daily BullMQ job to detect Carina updates |
| `05-admin-update-ui.md` | Admin dashboard notification and controlled update flow |

Run prompts in order. Each is self-contained; read its Dependencies section before starting.

## Key rule

Never import Carina TypeScript into the ABBIS API. Carina is a service. ABBIS API speaks
HTTP to it. The boundary is the network interface between the two Docker containers.
