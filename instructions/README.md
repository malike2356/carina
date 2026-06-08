# chat.carinaai.uk — Carina Build Workspace

This directory contains everything needed to build Carina into the product promised on carinaai.uk and labyrinthscout.com.

## Structure

```
chat.carinaai.uk/
  README.md                     ← You are here
  
  strategy/                     ← High-level planning and decision docs
    4AS.md                      — SaaS architecture analysis (Claude)
    carina_as_autonomous_agent_service.md
    carina_core_engine_cli_saas_workflow.md
    carina_scout_empty_promises_gap.md
    carina_workspace_and_tenant_isolation.md
  
  build-plan/                   ← Reference documents (read first)
    README.md                   — Build plan entry point
    AGENTS.md                   — Rules for Claude + Cursor
    ROADMAP.md                  — 5-phase build plan (28 weeks)
    TARGET.md                   — What we are building toward
    TOOLS.md                    — Complete tool list (40+)
    UNIQUE.md                   — What makes Carina different
    COMPARISON.md               — Carina vs Hermes vs OpenClaw
    WORKFLOW.md                 — How Claude, Cursor, Hermes collaborate
    archive/                    — Raw conversation dumps (reference)
  
  prompts/                      ← Spec files for Claude to READ
    phase1-core/                (6) — Email, Telegram, Briefing, TTS, Floor Plan, Scout
    phase2-tools/               (8) — Terminal, Process, File, Code, Browser, Subagents, Cron, Memory
    phase3-skills/              (6) — AI Agents, Creative, DevOps, Data Science, Productivity, Packs
    phase4-workspace/           (3) — Workspace Files, Heartbeat, Group Chat
    phase5-advanced/            (4) — Model Routing, Cross-Agent, Scout Dashboard, Unique Features
    phase2-gap-closure/         (17) — Everything carinaai.uk promises but doesn't have yet
      01-carina-core-gaps/      (3) — CLI packaging, Provider switching, Multi-channel
      02-scout-injection/       (4) — Injection Shield, Moving Target, Dashboard, Alerting
      03-scout-detection/       (4) — Honeypots, Anomaly Detection, Allowlisting, Kill Switch
      04-scout-audit-deploy/    (3) — Audit Log, Egress Filtering, Agent Integration
      05-website-promises/      (3) — Memory UI, Skill Packs, Pricing Checkout
  
  action-prompts/               ← Cursor-ready build instructions (for EXECUTION)
    AGENTS.md                   — Format spec for Claude to write action prompts
    phase1-core/                (6) — Cursor-ready prompts
    phase2-tools/               (8) — Cursor-ready prompts
    phase3-skills/              (6) — Cursor-ready prompts
    phase4-workspace/           (3) — Cursor-ready prompts
    phase5-advanced/            (4) — Cursor-ready prompts
```

## How to use

### For Claude
1. Read `build-plan/README.md` first
2. Read `prompts/` files — these are the specifications
3. Write `action-prompts/` files — convert each spec into a Cursor-ready prompt
4. Format follows `action-prompts/AGENTS.md`

### For Cursor
1. Read one file from `action-prompts/`
2. Build exactly what it describes
3. Commit and hand off to Claude for review

### For Hermes (me)
1. Pull Cursor's commits
2. Run tests, verify, deploy
3. Report results

## File counts
- Strategy docs: 5
- Build-plan: 8 (+ 11 archive)
- Prompts (specs): 44 (6+8+6+3+4+17)
- Action prompts: 27 (+ 1 AGENTS.md)
- **Total: 85+ files**
