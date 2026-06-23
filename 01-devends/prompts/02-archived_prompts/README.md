# archived_prompts

Completed and superseded prompt work for the Carina/Verlox platform.
All prompts here have been built, merged, or deliberately retired.

---

## Directory map

```
archived_prompts/
|
|- _reference/              Audit snapshots, build queues, and pre-work alignment docs
|                           used to plan sprint-4 and later work.
|
|- _superseded/             Confirmed duplicates, renamed entities, and retired docs.
|                           Safe to ignore; kept only for forensic reference.
|
|- agent-research/          Pre-Carina research docs (Hermes, Odysseus, Karina era):
|                           architecture studies, gap reports, prompt block drafts.
|                           Context only; nothing here is actionable.
|
|- carina-kernel/           Prompts for Carina as open-source kernel: brand boundaries,
|                           manifesto, package splitting, community infra, Windows support,
|                           partner program, marketplace.
|
|- carina-distro/           Prompts for the Carina distribution/embedding layer:
|                           workspace scaffold, Docker sidecar, version checks, abbis
|                           domain modules (boreholes, CRM, jobs, billing, association),
|                           deployment validation, auth/JWT.
|
|- carina-ops/              Prompts for the Verlox SaaS ops layer: multi-tenancy/RBAC,
|                           org migrations, Stripe billing, onboarding wizard, admin
|                           control plane, support impersonation, audit exports.
|
|- completed/               Core agent prompt series (01-20), cursor-specific build prompts,
|                           and one-off operational prompts that have been executed.
|
|- gaps-closing/            Gap-numbered prompts that addressed product gaps after the
|                           initial platform build. Grouped by gap number range:
|   |- 1-9/                 Gaps 1-9: tool hardening, metering, Scout fleet view
|   |- 10-21/               Gaps 10-21: research workspace, providers, channels, tasks,
|   |                       plugins, approvals, enterprise, ops admin
|   |- 22-30/               Gaps 22-30: global install, learning loop, Scout trust,
|   |                       host/app split
|   |- ui-redesign/         app.carinaai.uk workspace UI redesign (00-17 series)
|   |- marketing-sites/     Marketing site upgrades
|   |   |- carina/          carinaai.uk site upgrade prompts
|   |   `- scout/           labyrinthscout.com site upgrade prompts
|   `- playbook/            Playbook feature gap closure (00-27 series)
|
|- labyrinth/               Labyrinth Scout SDK and Magister implementation plan.
|
|- phase1-core/             First prompt set: email pipeline, Telegram, daily briefing,
|                           TTS delivery, floor plan, Scout integration.
|
|- phase2-gap-closure/      Phase 2 gap-closure series: carina-core-gaps,
|                           Scout injection dashboard, detection/killswitch,
|                           audit/deploy, website promises.
|
|- phase2-tools/            Tool build series: terminal, process, file-system,
|                           execute-code, browser, delegate-task, cronjob,
|                           memory/session, all-missing-hermes-tools.
|
|- phase3-skills/           Skills system: autonomous agents, creative, devops/GitHub,
|                           data science/MLops, productivity/media, domain-pack system.
|
|- phase4-workspace/        Workspace features: files, heartbeat, group chat.
|
|- phase5-advanced/         Advanced features: model routing, cross-agent, Scout
|                           dashboard, features/marketplace.
|
|- scout-features/          Standalone Scout feature prompts: governance dashboard,
|                           approval workflow, BYOK ops UI, industry policy templates,
|                           Labyrinth Scout SDK, regulatory risk classification.
|
|- sprint-1/                Sprint 1 archived prompts (incident blog gap).
|
|- sprint-2/                Sprint 2 archived prompts (gap-01 through gap-33,
|                           superseded early drafts, troubleshooting gaps).
|
|- sprint-3/                Sprint 3 archived prompts (white-label, branding, custom
|                           domains, billing/reseller, packs, Docker/ops scoping,
|                           docs/handoff, brand migration, smoke tests).
|
`- sprint-5/                Sprint 5 archived prompts (support agent: product overview,
    `- support-agent/       getting started, features, billing, Scout, troubleshooting,
                            response templates, knowledge sync, full implementation).
```

---

## What to look for

- **Current pending work**: see `../pending_prompts/` instead.
- **Sprint-4 action prompts (active)**: `../pending_prompts/sprint-4/action/`.
- **Most recent gap analysis**: `_reference/AUDIT-STATE-2026-06-20.md`.
- **Build sequence for sprint-2**: `sprint-2/` gap dirs are numbered and contain
  `_superseded/` sub-dirs for anything replaced mid-sprint.
