# Labyrinth Scout - Plan Addendum & Corrections

**Date:** 2026-06-04
**Purpose:** Correction to the initial plan assessment before build begins.

---

## Correction: Build Order

The previous assessment recommended building the HTTP proxy mode before the dashboard on the grounds that "you should not build a dashboard before you have paying customers."

**That advice was wrong for this context and should be disregarded.**

The actual intent is:

> Build Labyrinth Scout as a tool VERLOX needs for its own Carina deployment. After it is built and running in production for VERLOX, sell it to others. The paying customer problem does not apply at this stage because the builder is the customer.

This is the correct approach. You are not building speculatively for an unknown customer. You are building something you will use every day to monitor your own autonomous agent. The dashboard is not a nice-to-have - it is the primary interface for your own operations. Build it first.

---

## The Actual Model

```
Phase 1: Build for VERLOX
  - Carina runs on the VPS serving VERLOX work
  - Labyrinth Scout monitors that Carina instance
  - You use the dashboard daily for your own operations
  - You find and fix real problems from real use
  - Zero external customers needed at this stage

Phase 2: Productise what you built
  - The product is already battle-tested on real workloads
  - You know exactly what works because you use it
  - You sell a copy of what you built for yourself
  - Repeat revenue from a single build effort
```

This is a stronger foundation than the reverse order. Products built for the builder's own genuine need are almost always better products than those built speculatively for an imagined customer.

---

## Revised Build Order

| Step | What | Why |
|---|---|---|
| 1 | **Labyrinth Scout dashboard** | You need this for VERLOX. Your primary interface. Build it fully. |
| 2 | **Carina-to-Scout integration** | Wire your existing Carina instance to report events. Real data in the dashboard immediately. |
| 3 | **Alert channels** | Telegram and email alerts to you personally when something happens with your own agent. |
| 4 | **Kill switch** | Remote control of your own Carina from the Scout dashboard. |
| 5 | **Prompt injection detection** | Protect your own VERLOX workflows from injection attacks. |
| 6 | **Anomaly detection + honeypots** | Run these on your own instance. Learn from real patterns. |
| 7 | **HTTP proxy mode** | Add this when you are ready to sell to OpenClaw/Hermes users. Not before. |
| 8 | **SDK + documentation** | When the product is ready to ship to others. |

---

## What Stays Correct from the Original Assessment

The following points from the prior assessment remain valid and are not changed:

- **The business model is correct.** Free agent, paid security control plane. Open core. The comparison to GitLab/Hashicorp/Elastic holds.
- **Agent-agnostic is the right strategic position.** Scout monitors any agent. Carina gets the native integration and 20% discount.
- **Stack mismatch is a real concern.** The spec calls for Laravel. The correct stack is Node.js to match Carina. One codebase, one deployment pipeline, one language.
- **The waitlist form needs to be wired to a real backend before sharing the URL.** Currently writes to localStorage only.
- **Moving target deception needs a concrete technical definition** before build begins. Define exactly what rotates, on what schedule, and what triggers rotation in the agent security context.
- **The pricing on the landing page (£99 Standard, £79 Carina Bundle) is canonical.** Earlier figures in the spec document from the design conversation are discarded.

---

## Stack Decision: Node.js, Not Laravel

The spec document specifies Laravel as the Labyrinth backend. This decision is overridden here.

**Labyrinth Scout backend will be Node.js/TypeScript.**

Reasons:
- Carina is Node.js/TypeScript. One language across both products.
- All the infrastructure is already in place: PostgreSQL pool, Redis pub/sub, Express, Resend, WebSocket patterns.
- You can share code between Carina and Scout (types, database helpers, Redis client).
- Single Docker Compose file for the full stack on your VPS.
- You do not need to run PHP and Node.js side by side.

The Laravel code in the spec document is reference material for the logic and architecture, not the implementation language. Translate the patterns, not the code.

---

## The One-Build-Many-Sales Principle

The revenue model is: build something you genuinely need, then sell it repeatedly.

This means:
- Every hour spent building Scout is justified by your own operational need, independent of whether anyone else ever buys it.
- You will not cut corners because you have to live with what you build.
- The product will reflect real operational experience, not guesswork about what enterprise customers want.
- When you do sell it, you sell with authority because you run it yourself.

Do not let "getting paying customers first" logic distort the build order. Build the dashboard. Use it for VERLOX. Then sell it.

---

## What Labyrinth Scout Does for VERLOX Right Now

Once built and connected to your Carina instance:

- You see every tool call Carina makes on your behalf in real time.
- You get a Telegram alert if Carina tries to access an unusual domain or runs a suspicious shell command.
- You can kill your Carina session remotely if something looks wrong.
- You have a full audit log of every action Carina took for any VERLOX client or project.
- Honeypots sit quietly in your filesystem; if anything reads them, you know immediately.

This is the product. Build it for yourself first.
