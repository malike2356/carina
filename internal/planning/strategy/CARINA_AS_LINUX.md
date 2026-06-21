# Carina as the Linux Kernel for AI Agents

**Thought experiment:** 14 June 2026
**Context:** Carina is already MIT-licensed on npm (carina-agent@0.1.0). Could it become the foundational layer everyone builds AI agents on top of -- the way Linux is the kernel under every distro?

**Action prompts:** `instructions/action-prompts/carina-kernel/` (23 Cursor-ready tasks, `00` through `22`; see README there for build order).

**Brand locked:** See `core.carinaai.uk/docs/kernel/BRAND_RULES.md` (prompt `carina-kernel/00`).

---

## The Analogy

The core is free. The security layer is commercial.

| Layer | Linux World | Carina World | Model |
|-------|------------|-------------|-------|
| **Kernel** | Linux kernel (GPL, free) | **Carina (MIT, free)** -- agent engine: tools, memory, model routing, channels, skill system, domain packs. Always free. Always open. | Free |
| **Security** | SELinux, AppArmor (free) | **Labyrinth Scout (commercial)** -- injection shield, audit, kill switch, trust verification, compliance exports. Commercial add-on. | Paid |
| **Enterprise** | RHEL, SUSE (paid) | **Carina Ops** -- hosted SaaS, multi-tenant, billing, support. | Paid |
| **Distros** | Ubuntu, Fedora (free/paid) | Products built on Carina: Propreneur, Flitz, COMPASS, domain packs | Mixed |
| **Package manager** | apt, pacman (free) | Carina Hub -- discoverable domain pack marketplace | Free |
| **Desktop** | GNOME, KDE (free) | CLI + Web UI + Mobile app | Free |
| **Kernel modules** | Drivers (free) | 71 built-in tools, community plugins, MCP servers | Free |

**The rule:** Carina the agent is free. Forever. MIT license. Scout the security layer is commercial. You can run Carina without Scout. But if you want the security kernel -- injection protection, audit logging, kill switch, blockchain trust verification -- you pay for Scout.

This is the Red Hat model: the software is open source and free. The enterprise-grade security and support layer is paid.

---

## Why This Could Work

### 1. The timing is right

AI agents are where Linux was in 1994. Everyone is building their own -- OpenAI, Anthropic, Google, startups. But nobody has created the **standard platform** underneath them. The market is fragmented. Every company reinvents tools, memory, channels, security.

Linux won because it was free, open, and anyone could build on it. The same logic applies to AI agent platforms.

### 2. Carina already has the architecture

Carina wasn't built as a monolithic chatbot. It was built as a platform:

- **71 tools** -- pluggable, registry-based. Add your own.
- **23 LLM providers** -- not tied to any one vendor. BYOK.
- **18 channel adapters** -- not tied to any one interface.
- **16 domain packs** -- the "distro" concept already exists and works.
- **Skill system** -- self-improving, auto-writing, packable.
- **MCP client/server** -- standard protocol support.
- **Scout security** -- built-in governance, not bolted on.
- **Multi-tenant SaaS** -- ready for commercial hosting.

Nobody else has this combination. Hermes and OpenClaw are the closest, but they're frameworks for personal use, not platforms for building an ecosystem.

### 3. MIT license is the right license

GPL forced contributions back. MIT lets people build commercial products on top. That's how you get a Red Hat (Carina Ops Enterprise) AND an Ubuntu (free community distros) from the same kernel.

### 4. Built in the UK, open to the world

Carina was built in Portsmouth, UK -- outside the Silicon Valley bubble. It's provider-agnostic by design: not tied to OpenAI, not tied to Anthropic, not tied to any cloud. That independence is the kernel's value proposition. Products built on Carina (Flitz, Propreneur) can target any geography -- Africa, Europe, anywhere -- while running on the same core.

---

## What Stands In The Way

### 1. Nobody knows about it

Linux had Linus Torvalds' famous Usenet post. Where's Carina's moment? No DevRel, no conference talks, no blog posts, no Hacker News launches, no YouTube content. The product exists; the story doesn't.

### 2. Documentation is operational, not aspirational

The docs tell you how to use Carina. They don't tell you WHY to build on Carina, or HOW to build your own domain pack, or what the vision is. Compare to: "Linux is a free Unix-type operating system originally created by Linus Torvalds with assistance from developers around the world."

### 3. The brand is fragmented -- here's the fix

The problem: "Carina" means different things in different places. The fix: everything traces back to a single, clear hierarchy:

```
                     Carina (THE KERNEL; free, MIT)
                     Agent engine: tools, memory, channels, skills, packs
                              |
         ┌────────────────────┼────────────────────┐
         |                    |                    |
    DOMAIN PACKS          PRODUCTS              SCOUT
    (free, open)       (built on Carina)     (commercial)
         |                    |                    |
    property-uk          Propreneur          Injection shield
    healthcare-uk        Flitz               Audit logging
    finance-uk           COMPASS (NHS)       Kill switch
    legal-uk             Carina Ops          Trust verification
```

One platform. One free kernel. One commercial security layer. Everything else is built on top.

This means:
- Carina is always free. MIT license. No exceptions.
- Scout is always commercial. The security layer that pays the bills.
- Products say "powered by Carina" -- the free kernel
- Products can add "secured by Scout" if they use the commercial security layer
- Domain packs are free and open, like Linux distros
- The Hub (marketplace) is free -- discover and install packs at no cost

### 4. No community contribution path

There's no CONTRIBUTING.md with clear "good first issues." No RFC process for new tools or domain packs. No community maintainers. No Discord/Slack for developers. It's a one-person codebase (with AI assistance). Linux became Linux because thousands contributed.

### 5. The modularity isn't clean enough

Right now, installing Carina gives you everything -- all 71 tools, all 16 packs available, all channels registered. To be a kernel, you need to be able to install JUST the core and then opt into everything:

```
npm install @verlox/carina-core          # Just the kernel -- tools, memory, routing
carina pack install property-uk   # Add the property domain pack
carina scout enable               # Add security layer
```

---

## What We Would Need To Do

### Phase 1: Nuclear Clarity (Next 30 Days)

**1. Write the manifesto.**

A single page that answers: "What is Carina? Why does it exist? Why build on it?"

Something like:

> Carina is the free, open-source kernel for building AI agents. It provides everything an agent needs -- tools, memory, channels, model routing -- so you can focus on what your agent does, not how it runs. MIT licensed. Provider-agnostic. Channel-agnostic. Domain-agnostic. Built in the UK. Free forever. Scout is the commercial security layer for when you need enterprise protection.

**2. Clean the brand.**

| Today | Should Be |
|-------|-----------|
| carina-agent (npm) | @verlox/carina-core |
| core.carinaai.uk | The reference implementation |
| Propreneur Carina | "Propreneur, powered by Carina" |
| Labyrinth Scout | "Scout, the security layer for Carina" |
| Flitz | "Flitz, built on Carina" |

Everything traces back to one thing: **Carina is the platform.**

**3. Create the canonical landing page.**

`carinaai.uk` should scream: "Build AI agents. On anything. For anything."

- Hero: "The open-source platform for AI agents"
- Three-column: "Any model. Any channel. Any domain."
- Code block: `npm install -g carina-agent`
- Trust badges: MIT | 71 tools | 23 providers | 18 channels | Scout-secured
- "Built on Carina" showcase: Propreneur, Flitz, COMPASS (NHS)
- "Build your own: domain packs, tools, channels"

### Phase 2: Radical Modularity (Months 2-3)

**4. Split the monolith.**

```
@verlox/carina-core          # Tools, memory, model routing, CLI. No domain packs.
@verlox/carina-web           # Web gateway + dashboard
@carina/mobile         # React Native companion
@verlox/carina-scout          # Security layer
@carina/ops            # SaaS hosting
@verlox/pack-property  # Property-UK domain pack
@verlox/pack-health    # Healthcare domain pack
```

Each installable independently. `@verlox/carina-core` is the kernel.

**5. Stable public API with semver.**

Domain pack authors need to know their pack won't break when Carina updates. Define the stable interfaces:

- Tool registration API
- Skill pack manifest format
- Channel adapter interface
- Memory backend interface
- Provider registration API

Version them. Document them. Never break them without a major version bump.

**6. The Hub.**

`hub.carinaai.uk` -- discover, install, publish domain packs.

```
carina pack search property
carina pack install property-uk
carina pack publish ./my-healthcare-pack
```

Like npm for agent capabilities. Free to publish. Free to install. Verified badge for official packs.

### Phase 3: Community Building (Months 3-6)

**7. Contribution infrastructure.**

- CONTRIBUTING.md with "good first issue" tags
- RFC process for new tools and domain packs: `carina rfc propose`
- Discord server for developers
- GitHub Discussions for Q&A
- Monthly community call

**8. "Build Your First Domain Pack" guide.**

A step-by-step tutorial that takes someone from zero to a working domain pack in 30 minutes. The "Hello World" of Carina.

**9. University partnerships.**

University of Portsmouth is right there. Carina as a platform for student projects:
- MSc dissertations building domain packs
- Undergraduate AI coursework using Carina
- Research papers on agent platforms

**10. Reference implementations as marketing.**

Each product you build becomes proof:
- "Propreneur -- property investment platform, powered by Carina"
- "Flitz -- fleet tracking for Africa, powered by Carina"
- "COMPASS -- NHS compliance copilot, powered by Carina"
- "Labyrinth Scout -- security governance, built on Carina"

Each one has a case study page on carinaai.uk: "Built on Carina: [Product]"

### Phase 4: Commercial Ecosystem (Months 6-12)

**11. Carina Cloud (hosted Carina).**

Like MongoDB Atlas or Vercel -- deploy a Carina agent in one click. Free tier + paid plans. This already exists in the codebase (hosted mode, Stripe billing).

**12. Carina Enterprise.**

Support contracts for companies building on Carina. SLAs, dedicated instances, custom domain packs, compliance assistance. Like Red Hat for Linux.

**13. Domain pack marketplace revenue.**

Community packs: free. Premium packs: 70% to author, 20% to Carina, 10% platform. Carina-certified packs: official verification badge.

**14. "Built on Carina" partner program.**

Companies that build products on Carina get:
- Co-marketing (featured on carinaai.uk, case studies)
- Priority support
- Early access to new features
- "Built on Carina" badge for their website

---

## The Honest Assessment

### What makes this realistic:

- The code actually exists. 5,369 tests. Production-deployed. Not vaporware.
- MIT license is perfect for ecosystem building.
- Domain pack system already proves the "distro" concept works.
- Scout provides security-by-default -- no other open-source agent platform has this.
- Built in the UK, provider-agnostic, geography-agnostic. The kernel doesn't care where you deploy or what market you serve.

### What makes this hard:

- Solo founder with existing products (Propreneur, Flitz, COMPASS) splitting attention.
- No community yet. Zero contributors outside VERLOX.
- No brand recognition. Nobody searches for "Carina AI platform."
- Documentation gap between "here's how to use it" and "here's why to build on it."
- Racing against well-funded competitors who could become the standard first (OpenAI plugins, Anthropic MCP, LangChain ecosystem).

### The honest path:

You don't need to "become Linux" tomorrow. You need to:

1. Ship Compass (NHS compliance) as the next "Built on Carina" proof point
2. Write the manifesto and clean the brand
3. Split the monolith into `@verlox/carina-core` + packs
4. Launch the Hub
5. Create the "Build your first domain pack" guide
6. Get 3-5 external contributors through university partnerships
7. THEN tell the Linux kernel story publicly

The kernel story is more powerful AFTER you have 3-4 "distros" running in production (Propreneur, Flitz, Compass, Scout) than it is as a vision alone. Let the proof lead, then the story.

---

## One Sentence Positioning

> Carina is the free, open-source kernel for AI agents. MIT licensed. Scout is the commercial security layer. Build on Carina for free. Pay for Scout when you need enterprise security.

---

## What To Do This Week

1. [ ] Write the Carina manifesto (one page, saved as `carina/MANIFESTO.md`)
2. [ ] Update carinaai.uk hero to: "The free, open-source kernel for AI agents"
3. [ ] Add clear pricing boundary: "Carina is free. Scout is commercial."
4. [ ] Add "Powered by Carina" section to carinaai.uk with Propreneur + Flitz + COMPASS
5. [ ] Create the brand hierarchy diagram (Carina at center, Scout as commercial layer, products radiating out)
6. [ ] Create CONTRIBUTING.md in the carina-agent-public repo
7. [ ] Tag 5 "good first issues" on GitHub for new contributors
8. [ ] Write the "Build Your First Domain Pack" tutorial outline
