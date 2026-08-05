# Carina Migration Strategy; Converting OpenClaw, Hermes & Odysseus Users

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Date:** 2026-06-17
**Type:** Competitive Strategy
**Audience:** Product, Marketing, Engineering

---

## THE PROBLEM

A user with 2 years of Hermes chat history, 50 custom skills, a tuned config, and muscle memory for `hermes do X` has zero reason to install Carina. Switching costs are: lost history, lost skills, lost workflows, learning curve, trust reset.

**The wrong approach:** "Carina is better." Nobody cares. They already have something that works.

**The right approach:** Carina doesn't ask them to leave. Carina gives them something their current agent literally cannot do.

---

## STRATEGY 1: IMPORT EVERYTHING; ZERO SWITCHING COST

One command. Their entire agent life comes to Carina.

```
carina import from-hermes    → Skills, config, chat history, memory
carina import from-openclaw  → Skills, config, chat history, agents
carina import from-odysseus  → Prompts, config
```

**What gets imported:**

| Source | What Carina Pulls |
|--------|-------------------|
| Hermes | `.skills/` → Carina skills, `config.yaml` → mapped, `sessions.db` → Carina memory, `.env` → profile, cron jobs → Carina cron |
| OpenClaw | `~/.openclaw/agents/` → Carina agents, skills → Carina skills, config → mapped, chat history → Carina sessions |
| Odysseus | Prompts → Carina instructions, config → mapped, `.odysseus/` state |

**The psychology:** "I don't have to lose anything. One command and my 2 years of Hermes work runs in Carina. Now let me see what else Carina has."

### Implementation

```
carina import detect                    → Scans machine for Hermes/OpenClaw/Odysseus installations
carina import from-hermes               → Full migration wizard
carina import from-hermes --dry-run     → Preview what will be imported
carina import from-hermes --skills-only → Just skills
carina import from-openclaw --all       → Everything OpenClaw has
```

**Effort:** 2 weeks. Read three config/skill/DB formats. Map to Carina's equivalents. Write migration scripts.

---

## STRATEGY 2: THE SECURITY LAYER; DON'T REPLACE, GOVERN

This is the wedge. Carina doesn't compete with Hermes as an agent. Carina is what the CISO buys to govern whatever agents the team uses.

```
                         ┌─────────────────┐
   Developer uses        │    Hermes       │  "hermes build the API"
   whatever agent        │    OpenClaw     │  "openclaw review this PR"
   they already know     │    Odysseus     │  "odysseus deploy to staging"
                         └───────┬─────────┘
                                 │
                    ┌────────────▼────────────┐
   Carina sits      │       CARINA SCOUT      │
   on top as        │                         │
   governance       │  • Audits agent actions │
                    │  • Scans deployed infra │
                    │  • Enforces policies    │
                    │  • Chain of custody     │
                    │  • Compliance reports   │
                    └─────────────────────────┘
```

**Carina monitors Hermes.** When a Hermes agent deploys something, Scout scans it. When an OpenClaw agent accesses a server, Carina logs it. Carina becomes the security governance layer on top of whatever agents the team already uses.

**The pitch to the CISO:** "Your developers love Hermes. Great. Carina ensures nothing Hermes does exposes your company. One dashboard. All agents governed."

**The pitch to the developer:** "Keep using Hermes. Carina is just the security scanner that runs in the background. You don't have to change anything."

Once they're using Carina for security, migration to full Carina is a natural next step; but it's not required.

---

## STRATEGY 3: THE SECURITY DIFFERENTIATOR; DO WHAT THEY CANNOT

No competing agent has:

| Capability | Hermes | OpenClaw | Odysseus | Carina |
|-----------|--------|----------|----------|--------|
| 72 integrated security tools | Failed:  | Failed:  | Failed:  | Done:  |
| Standalone security product (Scout) | Failed:  | Failed:  | Failed:  | Done:  |
| Forensic chain of custody | Failed:  | Failed:  | Failed:  | Done:  |
| Autonomous pentesting | Failed:  | Failed:  | Failed:  | Done:  |
| Memory forensics (Volatility) | Failed:  | Failed:  | Failed:  | Done:  |
| Disk imaging (dc3dd) | Failed:  | Failed:  | Failed:  | Done:  |
| SOC2/ISO27001 compliance reports | Failed:  | Failed:  | Failed:  | Done:  |
| Enterprise RBAC + immutable audit | Failed:  | Failed:  | Failed:  | Done:  |
| Multi-tenancy + billing | Failed:  | Failed:  | Failed:  | Done:  |
| Obsidian vault integration | Failed:  | Failed:  | Failed:  | Done:  |
| STIX threat intel export | Failed:  | Failed:  | Failed:  | Done:  |

**Carina is not a better agent. Carina is a different category.**

The pitch isn't "switch from Hermes to Carina." The pitch is "Hermes is a great agent. Carina is a great security platform. They do different things. If security matters to you, you need both."

---

## STRATEGY 4: THE ENTERPRISE WEDGE

Sell to the CISO and compliance team, not the developer.

```
Developer org chart:    Dev → Tech Lead → Engineering Manager → CTO
Security org chart:     Analyst → SOC Manager → CISO → Board

Hermes/OpenClaw/Odysseus sell to the left column.
Carina sells to the right column.
```

**The CISO's pain points:**
- "My developers use AI agents. I have no visibility into what they're doing."
- "If an agent deploys vulnerable code, I'm responsible."
- "Auditors are asking for AI governance. I have nothing."
- "We need SOC2 certification. Our agent usage is a black box."

**Carina's answer:** "Scout monitors all agent activity across your organization. You get a compliance dashboard, audit trail, and automated security scanning. Your developers keep using whatever agent they want. You get governance."

**This is not a tool sale. This is a compliance sale.** Different buyer. Different budget. Different decision criteria. Zero competition from Hermes/OpenClaw/Odysseus because they don't sell to CISOs.

---

## STRATEGY 5: THE TROJAN HORSE; SCOUT AS FREE ENTRY POINT

Give Scout away for free for 1 target. The developer tries it on their side project. Sees:

- "3 critical CVEs found on your domain"
- "2 exposed admin panels discovered"
- "1 subdomain you didn't know existed"

Now they're curious. They try Carina. They import their Hermes skills. They realize Carina has everything Hermes has plus 72 security tools plus forensics plus Obsidian integration.

**Free Scout → paid Carina → Carina becomes primary agent.**

---

## STRATEGY 6: THE COMMUNITY BRIDGE

Carina publishes skills TO the other ecosystems:

```
Carina Skill Hub publishes:
  - carina-security-scanner (as Hermes skill)
  - carina-forensics-toolkit (as OpenClaw plugin)
  - carina-compliance-reporter (as Odysseus prompt pack)
```

A Hermes user installs `carina-security-scanner` skill. It works in Hermes. It says at the bottom: "Full Carina integration available. 71 more tools. Import your Hermes setup in one command."

Carina becomes a familiar name in their current tool before they ever install it.

---

## THE ORDERED PLAYBOOK

**Phase 1: Import tools (Weeks 1-2)**
Build `carina import from-hermes`, `carina import from-openclaw`, `carina import from-odysseus`. This eliminates the switching cost objection immediately.

**Phase 2: Free Scout (Week 3)**
Launch free single-target Scout. Marketing: "What's on your attack surface right now? Find out in 2 minutes." No signup wall. Just paste a domain.

**Phase 3: Community bridge (Week 4)**
Publish Carina skills to Hermes/OpenClaw skill ecosystems. Become visible where users already are.

**Phase 4: Enterprise CISO pitch (Week 5-6)**
Package Scout as "AI Agent Governance Platform." Target CISO buyers. "Your team uses AI agents. Govern them."

**Phase 5: Full migration push (Ongoing)**
Every free Scout user sees: "You found 3 CVEs. Want to exploit them? Carina can. Import your Hermes setup now."

---

## THE ONE-SENTENCE PITCHES

**To the developer:** "Carina imports everything you built in Hermes. One command. You lose nothing. You gain 72 security tools."

**To the CISO:** "Your developers already use AI agents. Scout shows you what those agents are exposing. No agent change required."

**To the pentester:** "Carina is the only agent that can go from reconnaissance to exploitation to forensic report autonomously. Hermes can't do that. Nobody else can."

**To the compliance officer:** "SOC2 requires AI governance. Carina generates the audit trail. Your auditors will love it."

---

## WHAT MAKES THIS WORK

People switch tools for one of three reasons:

1. **The old tool broke**; doesn't apply. Hermes/OpenClaw work fine.
2. **The new tool is 10x better**; Carina isn't 10x better at being an agent. It's a different category.
3. **The new tool does something the old tool literally cannot do**; **THIS IS THE PLAY.**

Carina doesn't win by being a better agent. Carina wins by being the only agent that is also a security platform. Nobody switches from Hermes to Carina because Carina is a better Hermes. They add Carina because Carina does security, forensics, compliance, and governance; things Hermes cannot and will never do.

**Don't compete on agent quality. Compete on a category Hermes doesn't play in.**