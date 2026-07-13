# Pending Prompt Index

Updated: 2026-07-13

This folder is for **executable** pending prompts only. Reference specs and architecture docs live in `../reference-prompts/`. Completed build prompts live in `../archived/`.

The folder is flat. Groups use filename prefixes: `<group>--<name>.md`.

## Groups

| Prefix | Product or area | Use |
|---|---|---|
| `knime-adoption--` | KNIME visual workflow adoption | **01-05 archived 2026-07-09**; refs in `reference-prompts/` |
| `scout-console--` | Labyrinth Scout (Carina mutual arch) | **34-36 archived 2026-07-09** |
| `aiva-provisioning--` | Aiva hire flow | **01 archived 2026-07-09** (NL role to live worker; Prompt 37) |
| `aiva-marketplace--` | Aiva templates | **01 archived 2026-07-09** (template marketplace; Prompt 38) |
| `aiva-onboarding--` | Aiva onboarding UX | **01-03 archived** (Prompts 39-41; 03 completed 2026-07-09) |
| `carina-capabilities--` | Carina runtime self-knowledge | **Pack complete 2026-07-09** (01-02 archived; Prompts 42-43) |
| `mutation-engine--` | Mutation engine | **Pack complete 2026-07-06** (01-06 archived). Ref: `reference-prompts/mutation-engine--00-architecture-reference.md` |
| `core-carina--` | Carina core | Core runtime, hosted SaaS, memory, tools, gateways, multi-agent, release, platform admin |
| `ops-admin--` | Ops admin | VERLOX operator panel prompts (archived 2026-07-04; see gap 07) |
| `carina-mobile--` | Mobile app | **Pack complete 2026-07-04**; index in `archived/carina-mobile--README.md` |
| `carina-mobile-aiva-parity--` | Expo Aiva parity | **Pack complete 2026-07-11**; index in `archived/carina-mobile-aiva-parity--README.md`; APK deployed 2026-07-12 |
| `keys-server--` | Keys server | **ARCHIVED 2026-07-06** |
| `platform-gap-pack--` | Cross-platform gaps | **ARCHIVED 2026-07-04** (00-15 in `archived/`) |
| `aiva-business-plan--` | Aiva business plan | Paddle guide in `reference-prompts/`; prompts 01-05 archived 2026-07-04 |
| `aiva-support-refund-readiness--` | Aiva support | **Pack complete 2026-07-04** in `archived/` |
| `propreneur-v3--` | Propreneur v3 | Prompts 01-09 archived 2026-07-06 |
| `propreneur-integration--` | Propreneur bridge | **ARCHIVED 2026-07-04** |
| `contacts-platform-sync--` | Contacts integration | **ARCHIVED 2026-07-04** |
| `aiva-social-channels--` | Aiva native social | **Build prompts 01-07 archived 2026-07-09**; refs in `reference-prompts/` |
| `carina-agent-os--` | Carina Agent OS glass (Julian blueprint) | **01-09 COMPLETED 2026-07-12**; parent archived |
| `carina-tui-command-center--` | Carina TUI Command Center | **Pack complete 2026-07-13**; archived under `../archived/` |
| `carina-aiva-cost-workspace-comms--` | Carina and Aiva commercial control, workspace, comms, and channel friction | **Pack complete 2026-07-13**; archived under `../archived/` |

## Root pending files

No executable build prompts are pending as of 2026-07-13.

Parent + children 01-09 archived under `../archived/carina-agent-os--*.md` (2026-07-12).

Carina TUI Command Center prompts archived under `../archived/carina-tui-command-center--*.md` (2026-07-13).

Carina Aiva cost, workspace, comms, and WhatsApp prompts archived under `../archived/carina-aiva-cost-workspace-comms--*.md` (2026-07-13).

Build order for 39-41: `../reference-prompts/aiva-onboarding--BUILD-ORDER.md` (all build prompts archived).

Recently archived: `core-carina--conversational-config.md` (2026-07-11). Operator SOP: `../../SOP/043-conversational-configuration.md`.

**Propreneur v3 10-32:** executable prompts live in `propreneur/v3-prompts/` (not in `archived/`). Move to `pending/` when you start Phase 3 tool bridge.

## Reference prompts (`../reference-prompts/`)

| File | Use |
|---|---|
| `aiva-launch-readiness.md` | Launch gate checklist (NOT READY) |
| `aiva-launch-readiness-AUDIT.md` | Per-item readiness audit |
| `aiva-social-channels--00-spec-channel-matrix.md` | Social channel contract |
| `aiva-social-channels--BUILD-ORDER.md` | Deploy verification |
| `knime-adoption--00-architecture-reference.md` | KNIME adoption map |
| `knime-adoption--BUILD-ORDER.md` | KNIME cross-product order |
| `mutation-engine--00-architecture-reference.md` | Mutation engine map |
| `pricing-strategy.md` | Pricing + Stripe ops |
| `aiva-business-plan--00-paddle-registration-guide.md` | Manual Paddle setup |

## Library docs (`../docs/`)

| File | Use |
|---|---|
| [PENDING-STATUS.md](PENDING-STATUS.md) | Active work summary |
| [PATH-MAP.md](PATH-MAP.md) | Old prompt paths mapped to the actual repo tree |
| [POST-BUILD-CHECKLIST.md](POST-BUILD-CHECKLIST.md) | Mandatory archive steps after finishing a prompt |
| [REUSE-RULES.md](REUSE-RULES.md) | Carina voice and naming rules |
| [AGENT-RULES.md](AGENT-RULES.md) | Folder rules and completion standard |

## Cleanup rules

| Outcome | Destination |
|---|---|
| Build prompt complete and verified | `../archived/` |
| Reference spec, architecture, or checklist (not a build prompt) | `../reference-prompts/` |
| Still to implement | stay in `pending/` |

Do not archive partial work or gate checklists that still have open manual items.

After moving or adding prompts:

```bash
python3 01-devends/prompts-library/scripts/build-prompt-index.py
```
