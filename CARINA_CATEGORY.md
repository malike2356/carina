# Making Carina the Best Kernel -- Category Design

**Date:** 14 June 2026
**Premise:** Carina must not compete. Carina must absorb and transcend.

---

## The Endgame

Carina does not compete with Hermes. Does not compete with OpenClaw. Does not compete with Odysseus. Does not compete with ChatGPT.

Carina forms her own category where she is the only option.

That category is: **the enterprise-grade, self-improving AI agent kernel that ships with security by default, is commercially viable under MIT, and runs anywhere.**

Nobody else has all of these. Nobody else can get all of these quickly:

| Capability | Hermes | OpenClaw | Odysseus | ChatGPT | **Carina target** |
|-----------|--------|----------|----------|---------|-------------------|
| Self-improving | Yes | Partial | Coming | No | **Yes (done)** |
| Channel breadth | 20+ | 50+ | Web only | Web/App | **50+ (roadmap)** |
| Model serving (Cookbook) | No | No | Yes | N/A | **Yes (steal)** |
| Deep Research | No | No | Yes | Yes | **Yes (steal)** |
| Security (Scout) | No | No | No | Enterprise only | **Yes (unique)** |
| Domain packs | No | No | No | No | **Yes (unique)** |
| MIT license | Yes | Yes | No (AGPL) | No | **Yes** |
| SaaS billing | No | No | No | Built-in | **Yes (unique)** |
| Blockchain trust | No | No | No | No | **Yes (unique)** |
| npm install | No | No | No | No | **Yes** |
| Windows (no WSL) | Partial | Partial | Yes (Docker) | Yes | **Yes (planned)** |

When Carina has all of these, the question is not "which agent is best?" The question is "why would you use anything else?"

---

## What To Copy, What To Invent

### From Hermes -- Already copied, now surpass

Done this week: learning loop, skill maturity, session search, cron workflows, background processes, kanban, webhooks, TUI, profiles.

**What to surpass:** Hermes' curator runs on a 7-day cycle. Carina's should run continuously -- evaluate every task, not wait a week. Hermes overwrites skills on recency. Carina overwrites on evidence (already built). Hermes removes unused skills. Carina archives them (already built).

Carina's learning loop is now architecturally superior to Hermes'. The copy phase is complete. The surpass phase begins.

### From OpenClaw -- Multi-agent routing and Hub

**What to copy:**
- Multi-agent routing: different agent profiles per channel/contact/group. One gateway, many agents.
- The Hub marketplace model: ClawHub has 40K community skills. Carina Hub should have domain packs, tools, and channel adapters discoverable and installable.

**What to surpass:**
- OpenClaw routes agents but doesn't make them learn from each other. Carina should: agents share skills across profiles. What Propreneur-Carina learns about property negotiations, Fleetz-Carina can apply to fleet contracts. Same kernel, shared learning, different faces.
- OpenClaw's Hub is skills-only. Carina's Hub should be: domain packs, tools, channel adapters, themes, workflows, and MCP servers. One marketplace for everything.

### From Odysseus -- Cookbook and Deep Research

**What to copy:**
- The Cookbook: hardware detection, VRAM estimation, model recommendations, one-click download and serve. This removes the single biggest barrier to self-hosted AI.
- Deep Research as a named feature: multi-step research runs that gather, read, synthesize sources into cited reports. Beautiful visual output.
- The landing page strategy: hover-to-play GIFs of every feature. Show, don't tell.

**What to surpass:**
- Odysseus's Cookbook is local-only. Carina's should work for both local models AND cloud APIs. "Here are the models you can run on your hardware. Here are the cloud models that fill the gaps."
- Odysseus's research is single-agent. Carina should do multi-agent research -- one agent searches, another synthesizes, a third fact-checks. Three agents, one report.

### From ChatGPT/Claude -- Polish and UX

**What to copy:**
- The "it just works" factor. One command, one interface, zero configuration needed to start.
- Beautiful document rendering. Code blocks, tables, citations, images -- all rendered natively.
- The streaming experience. No flicker. No lag. Tokens appear like thought.

**What to surpass:**
- ChatGPT is a product. Carina is a platform. ChatGPT's UX is the ceiling for a product. Carina's UX should be the floor for a platform -- customizable, extendable, themeable.
- Claude's artifacts are single-session. Carina's should persist, be shareable, be editable by multiple agents across sessions.

---

## The Category Name

"AI agent platform" is a feature list. "Open-source AI agent" is a license. Neither is a category.

The category Carina defines should be named something that makes comparison impossible. Suggestions:

- **"Secure agent kernel"** -- emphasizes the Scout differentiator. But "kernel" is technical.
- **"Enterprise agent OS"** -- emphasizes the platform. But "OS" is claimed by others.
- **"Verifiable autonomous infrastructure"** -- emphasizes trust. Accurate but verbose.
- **"The agent platform you can trust in production"** -- one sentence. Clear. Memorable.

The right answer is probably the simplest one: **"Carina is the agent platform you can trust in production."**

Not "an" agent platform. "The" agent platform. Trust is the differentiator. Production is the context. Everything else -- tools, skills, channels, models -- are table stakes.

---

## What To Build Next (The Category-Forming Roadmap)

### Immediate (cement the leads already taken)

| # | What | Why |
|---|------|-----|
| 1 | Deploy the self-improvement loop to production (752 lines, built today) | The learning loop is built but not live. Ship it. |
| 2 | Cookbook: hardware detection + model recommendations | Single biggest UX gap. Odysseus nailed this. Steal it. |
| 3 | Deep Research as a named feature | Odysseus has it. ChatGPT has it. Carina needs it. |
| 4 | Multi-agent routing per channel | OpenClaw's best feature. Different agent per platform. |

### Short-term (close remaining parity gaps)

| # | What | Why |
|---|------|-----|
| 5 | Expand to 99+ tools | Close the tool count gap. No dimension should be behind. |
| 6 | Channel breadth to 30+ | WhatsApp, Signal, iMessage, Matrix, Mattermost -- the ones that matter. |
| 7 | TUI polish | Match Hermes' terminal experience. |
| 8 | Windows one-click installer | No WSL required. Ship the .exe. |

### Medium-term (build the moat)

| # | What | Why |
|---|------|-----|
| 9 | Cross-agent skill sharing | What one agent learns, all agents know. No competitor does this. |
| 10 | Carina Hub (domain pack marketplace) | OpenClaw has ClawHub. Carina needs discoverability. |
| 11 | Enterprise compliance suite (Scout + COMPASS) | The security story is the moat. Make it undeniable. |
| 12 | Benchmark Carina vs Hermes/OpenClaw on identical tasks | Prove the compounding advantage. Publish the results. |

### Long-term (define the category)

| # | What | Why |
|---|------|-----|
| 13 | Third-party domain pack ecosystem | When other companies build packs on Carina, the platform wins. |
| 14 | Carina Enterprise (Red Hat model) | MIT kernel stays free. Enterprise support, SLAs, managed hosting are paid. |
| 15 | "Built on Carina" certification | Like "Intel Inside." A badge that means security, trust, quality. |

---

## The Honest Assessment

Carina has gone from "a product" to "a platform" in one week. The gap-closing prompts deployed today brought parity with Hermes. The self-improvement loop gives Carina a learning capability that surpasses Hermes in architecture (correction priority, quality-gated refinement, never-deletes archival).

But "best" is not about features. It's about category. Linux didn't win by having more drivers than Windows. It won by being the only thing that was Linux.

Carina's category is not "open-source agent." It's "the agent platform you can trust in production." Nobody else can claim that. Not Hermes. Not OpenClaw. Not Odysseus. Not ChatGPT. Only Carina has Scout security. Only Carina has MIT + SaaS. Only Carina has domain packs. Only Carina has blockchain trust.

The job now is to make that category so obvious that comparison becomes irrelevant.

---

## Shipped status (core, June 2026)

Category-forming work now has concrete CLI, Hub API, and benchmark proof in `core.carinaai.uk`:

| Roadmap item | Shipped capability | Verify |
|--------------|-------------------|--------|
| Cross-agent skill sharing | `cross-agent-learning.ts` + `cross-agent-hub-sync.ts`; `carina learning shared\|share\|sync` | `pnpm exec vitest run src/skills/cross-agent-hub-sync.test.ts` |
| Carina Hub marketplace | Catalog, install, publish, ecosystem metrics; Hub `/api/ecosystem/metrics` | `carina hub ecosystem` |
| Third-party domain packs | `carina hub author init`; `docs/ecosystem/DOMAIN_PACKS.md` | `domain-pack-author.test.ts` |
| Enterprise (MIT kernel) | `carina enterprise status`; `docs/enterprise/README.md` | `kernel-support.test.ts` |
| Built on Carina certification | `carina certify built-on`; `docs/kernel/CERTIFICATION.md` | `built-on-carina.test.ts` |
| Category narrative | `docs/CATEGORY.md` (grounded claims + honest partials) | read + benchmark tasks |

**Still partial:** federated multi-org hub replication, production hub.carinaai.uk uptime, blockchain trust layer, 50+ channel adapters, published Hermes/OpenClaw benchmark shootout.

Full operator doc: `core.carinaai.uk/docs/CATEGORY.md`.
