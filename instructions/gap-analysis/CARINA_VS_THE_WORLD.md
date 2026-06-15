# Hermes vs OpenClaw vs Carina -- An Honest Assessment

**Source:** Transcript comparison of Hermes and OpenClaw (video/podcast)
**Analysis:** How Carina stacks up against both

---

## What The Transcript Says

### OpenClaw's Strengths

| Strength | Detail |
|----------|--------|
| **Channel breadth** | 50+ messaging integrations -- WhatsApp, Telegram, Discord, Slack, iMessage, Matrix, WeChat, LINE, Signal, Google Chat, email, browser |
| **Multi-agent routing** | Different agent personalities for different channels/contacts/groups. One gateway, multiple agents. |
| **Ecosystem** | ClawHub: 40,000 community-built skills. 370,000 GitHub stars. |
| **Explicit control** | Every behavior is a file you wrote. Nothing happens you didn't configure. Audit-friendly. |
| **Architecture** | Gateway-first. Messaging came first, agent lives inside it. |

### Hermes' Strengths

| Strength | Detail |
|----------|--------|
| **Self-improving learning loop** | Agent creates its own skills from completed tasks. Executes, evaluates, extracts, refines. Compounds over time. |
| **Autonomous curator** | Reviews skills on a 7-day cycle. Consolidates overlapping ones, removes unused ones. Library stays clean. |
| **Session search** | Full-text search across all past conversations. Better than OpenClaw's vector search over memory files. |
| **Development pace** | v0.1 to v0.8 in 2 months. 209 PRs. Fastest-moving open-source agent. |
| **Less manual configuration** | Learns preferences over time. Less setup overhead than OpenClaw. |
| **Compounding performance** | Agents with 20+ self-created skills complete similar tasks 40% faster than a fresh instance. |

### The Verdict From The Transcript

> OpenClaw if you need multi-platform coordination across 50+ channels with different agent personalities.
> Hermes if you want one personal agent that gets better the longer you use it, with less manual configuration.
> Run both if you can -- OpenClaw for routing, Hermes for execution.

---

## Where Carina Sits

Carina isn't mentioned in the transcript (nobody knows about it yet). But here's how it stacks up:

### Carina vs OpenClaw

| Dimension | OpenClaw | Carina | Winner |
|-----------|----------|--------|--------|
| **Channel adapters** | 50+ | 18 | OpenClaw |
| **Multi-agent routing** | Different agents per channel | One agent, one identity (subagents for delegation) | OpenClaw |
| **Ecosystem (community skills)** | 40,000 on ClawHub | 96 curated, 0 community | OpenClaw |
| **GitHub stars** | 370,000 | ~0 | OpenClaw |
| **Security** | None built-in | Scout -- injection shield, kill switch, audit, blockchain trust | Carina |
| **SaaS billing** | No built-in billing | Stripe billing, multi-tenant, hosted mode | Carina |
| **Domain packs** | No vertical organization | 16 domain packs organized into verticals | Carina |
| **MIT license** | Yes | Yes | Tie |
| **Browser automation** | Built-in | 9 Playwright tools | Tie |
| **Explicit control** | Every file you write | Memory + skills + workspace files | Tie (different approaches) |

**Carina wins on:** security, billing, domain organization.
**OpenClaw wins on:** channel breadth, community, multi-agent routing.

### Carina vs Hermes

| Dimension | Hermes | Carina | Winner |
|-----------|--------|--------|--------|
| **Self-improving skills** | Mature -- auto-writer + 7-day curator | Skill auto-writer exists, curator less mature | Hermes |
| **Session search** | Full-text across all past conversations | Postgres FTS across sessions | Tie |
| **Development pace** | v0.1 to v0.8 in 2 months, 209 PRs | Steady pace, smaller team | Hermes |
| **Manual configuration** | Learns preferences over time | Workspace files require some setup | Hermes |
| **Compounding** | 40% faster with 20+ self-skills | Not yet benchmarked | Hermes |
| **Security** | Partial (Tirith) | Scout -- full security suite | Carina |
| **SaaS billing** | None | Stripe built-in | Carina |
| **Domain packs** | No equivalent | 16 vertical packs | Carina |
| **Channel adapters** | 20+ | 18 | Tie |
| **Tools** | 99+ | 71 | Hermes |
| **Provider count** | 20+ | 23 | Tie |
| **MIT license** | Yes | Yes | Tie |
| **npm install** | Binary (bash install) | npm package | Carina |

**Carina wins on:** security, billing, domain packs, npm distribution.
**Hermes wins on:** skill maturity, community, development pace, raw tool count.

---

## The Honest Assessment

### What the comparison misses

The transcript frames this as a two-player game. It's not. Carina exists and brings something neither competitor has: **security as a differentiator.**

OpenClaw has the channels. Hermes has the brain. Carina has the **trust**.

For anyone running AI agents in production -- handling customer data, making financial decisions, operating in regulated industries -- Scout security is not a nice-to-have. It's the reason you can deploy at all. Neither OpenClaw nor Hermes gives you:
- Prompt injection shielding
- A kill switch with forensic snapshots
- Immutable audit logging
- Egress filtering (DLP)
- Honeypots and deception
- Blockchain-verified trust attestations
- Compliance report generation (SOC2, ISO27001, EU AI Act)

Carina is the only open-source agent you can put in front of an enterprise security review and pass.

### What Carina should adopt from each

**From OpenClaw:**
- Multi-agent routing across channels (different personalities per channel)
- The Hub marketplace model (ClawHub has 40K skills -- that's the goal for Carina Hub)
- The "every behavior is a file you wrote" transparency story for enterprise

**From Hermes:**
- The autonomous curator cadence (7-day cycle -- Carina's curator exists but isn't scheduled)
- Session search UX (Carina has the backend, needs the frontend)
- The compounding performance benchmark story ("40% faster after 20 skills")
- The "less manual configuration" narrative for personal use

### What Carina has that neither has

**1. Security-first architecture.** Scout is not an add-on. It's the other half of the kernel. This is Carina's moat. Neither competitor can bolt this on quickly -- it requires rearchitecting the tool pipeline.

**2. Domain pack structure.** Both have "skills." Neither organizes them into coherent vertical packs (property-uk, healthcare-uk, finance-uk) with domain-specific tools, data, and knowledge. This makes Carina sellable to specific industries.

**3. Commercial model.** MIT license + Stripe billing + hosted SaaS. Like Red Hat for Linux. OpenClaw and Hermes are free but have no built-in path to revenue.

**4. Blockchain trust verification.** ERC-8004 identity + ERC-8126 verification on Base. Nobody else has on-chain verifiable agent trust. This is a unique selling point for regulated industries.

**5. npm distribution.** `npm install -g carina-agent` is a lower-friction install than curl-pipe-bash.

### The positioning

Carina is not "better than Hermes" or "better than OpenClaw." It's different:

- If you need maximum channels and community: OpenClaw
- If you want an agent that learns and compounds: Hermes
- If you need an agent you can deploy in production with enterprise security: **Carina**

The transcript ends by saying you could run both OpenClaw and Hermes together. The same is true for Carina + either. But Carina is the only one you'd trust with customer data, financial transactions, or regulated workflows.

---

## What This Means For Carina's Roadmap

### Immediate (reinforce the differentiator)
- Make the Scout security story the FIRST thing anyone sees about Carina
- "Carina is the only open-source agent with built-in enterprise security"
- Every demo starts with: "Here's what happens when someone tries to inject a prompt -- Scout blocks it"

### Short-term (close the gap)
- Autonomous curator cadence (7-day review cycle, like Hermes)
- Session search UI (backend exists, needs frontend)
- Multi-agent routing research (can we route different personalities per channel?)

### Long-term (ecosystem)
- Carina Hub with community-contributed domain packs
- "Built on Carina" case studies (Propreneur, Fleetz, COMPASS)
- The compounding story: benchmark how much faster Carina gets over time

### What NOT to chase
- 50 channel adapters (18 is enough. Depth over breadth.)
- 40,000 skills (curated quality over quantity)
- GitHub stars vanity metric (paying customers over stars)
