# Carina Go Live Audit

Date: 2026-06-17

## Verdict

Not fully, but the main kernel and pricing blockers from the first pass are now resolved.

The stack is usable in parts, and some surfaces are healthy, but the repo still has three classes of problems:

1. A few public and internal docs still mention partials or old plan names.
2. Some features remain intentionally partial or infra dependent.
3. Cloud and Scout still depend on correct deployment state, keys, and env configuration.

## What I verified

- `app.carinaai.uk` production build succeeds.
- `console.labyrinthscout.com` typecheck succeeds.
- `core.carinaai.uk` `pnpm check` now succeeds.
- Carina research, memory, and RAG paths are real code, not placeholder shells.
- Scout dashboard deployment is functioning, but its public copy still needs cleanup.

## Resolved blockers

### 1. Core kernel typecheck failure

Resolved. The previous `pnpm check` failures in `prompt-tiers.ts`, `openai-compatible-provider.ts`, `tui/data-provider.ts`, `learning-api.ts`, and `marketplace-api.ts` have been fixed.

### 2. Public product copy

Mostly resolved. The main marketing and billing surfaces now use the current Carina / Cloud / Scout Monitor / Scout Govern story. A few deeper docs still need a final consistency sweep.

## Surface-by-surface status

| Surface | Status | Assessment |
|---|---|---|
| Carina core kernel | Ready | Build/typecheck clean |
| Carina Cloud app | Mostly ready | Build passes, routes are present, but it depends on core and still needs copy cleanup |
| RAG and knowledge | Operational, but conditional | Real embedding, memory, and research code exists, but it needs DB and embedding keys to be fully live |
| Scout console | Operational | Console build is healthy, pricing pages now reflect the current Monitor / Govern model |
| Public docs | Partial | Still contains some intentional partials and rollout notes |
| Marketing sites | Mostly aligned | The main surfaces now match the current pricing position |

## RAG and knowledge assessment

This part is real. It is not a stub.

Carina has:

- a platform knowledge loader in `core.carinaai.uk/src/platform/knowledge.ts`
- an embeddings chain in `core.carinaai.uk/src/memory/embeddings.ts`
- a persisted research store in `core.carinaai.uk/src/research/research-store.ts`
- research API routes in `core.carinaai.uk/src/api/research-api.ts` and `core.carinaai.uk/src/api/internal-research-api.ts`
- CLI support in `core.carinaai.uk/src/cli/commands/research-cli.ts`
- memory and session search tools in `core.carinaai.uk/src/tools/memory.ts` and `core.carinaai.uk/src/tools/session-search.ts`

The gap is not existence. The gap is readiness:

- no `DATABASE_URL` means chat-only mode
- no embedding provider means `embed()` returns an empty vector and RAG degrades
- no `CARINA_INTERNAL_KEY` breaks cloud to core research jobs

So the RAG stack is real, but it is not universally live without correct infra.

## Scout assessment

Scout is further along than the copy suggests:

- the dashboard is documented and wired
- the fleet tab now has live loading and error handling
- the console build/typecheck path is healthy
- the public trust and governance surfaces exist

But Scout is still not "fully clean" for go-live because some internal docs still carry partial labels and rollout notes.

Relevant docs still call out partial or stub states:

- [docs/user/gateways/irc.md](./docs.carinaai.uk/docs/user/gateways/irc.md:3) explicitly says IRC is a stub.
- [docs/user/capability-inventory.md](./docs.carinaai.uk/docs/user/capability-inventory.md:100) still labels IRC as a stub.
- [docs/ops/PLATFORM_OPS.md](./core.carinaai.uk/docs/ops/PLATFORM_OPS.md) still marks ACP, billing, and mobile items as partial.
- [docs/ecosystem/DOMAIN_PACKS.md](./core.carinaai.uk/docs/ecosystem/DOMAIN_PACKS.md) still marks Stripe checkout and verified badge as partial.
- [docs/gateways/channel-setup.md](./core.carinaai.uk/docs/gateways/channel-setup.md) still marks WhatsApp and channel ingress enforcement as partial.

Those are acceptable as honest internal docs, but they are not compatible with the claim that everything is fully up to date and stub-free.

## Go live gaps

### P1

- Sweep the remaining docs that still mention old plan names or rollout notes.
- Make the RAG readiness bar explicit: DB, embeddings, and internal key requirements should be documented as launch prerequisites, not implied defaults.
- Keep the intentional stubs, like IRC sidecar mode, but move them into clear compatibility or extension docs rather than front-line product copy.

### P2

- Keep the pricing model parametric in code and env, not embedded in prose.
- Confirm production deployment state for the hosted app and Scout console before treating the whole stack as live.

## Readiness summary

| Area | Ready now? | Notes |
|---|---|---|
| Core runtime | Yes | Typecheck clean |
| Hosted app | Mostly | Build passes, but it depends on core and on correct infra |
| RAG / memory / research | Partial | Real features exist, but they are infra dependent |
| Scout console | Mostly | Works, and the main pricing pages are aligned |
| Public marketing | Mostly | Main pages are aligned; a few nested docs still need edits |
| Public docs | Partial | Still contain explicit stubs and partials |

## Bottom line

Carina is not in a bad state. It is in a mixed state.

The product exists, the major surfaces are real, and several pieces are already production grade. But the repository is not yet clean enough to say "no stales and stubs" or "go live on all fronts" without qualification.

The next work should be a documentation and deployment hygiene pass, not another feature pass.
