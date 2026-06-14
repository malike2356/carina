# Scout Positioning: Governance, Not Security

## The core reframe

Scout is not a security product. It is a governance product that uses security controls
as one of its mechanisms.

The difference matters commercially:

- Security budgets are reactive: bought after a breach or near-miss
- Governance budgets are proactive: bought because a board, regulator, or procurement
  team demands it before anything happens

Governance budgets are larger, more predictable, and not dependent on the customer having
been breached first.

## What Scout actually solves

Strip away all technology. The problem statement is:

An organisation deploys AI agents. Those agents can read emails, access databases, browse
websites, execute workflows, send messages, and call APIs. Management then asks:

- Who approved that action?
- Can we see what happened?
- Can we stop it?
- Can we prove compliance?
- Can we investigate an incident?

Most agent platforms have weak answers to all of these. Scout answers all of them.

That is governance. Not cybersecurity. Cybersecurity is one part of governance.

## The three layers inside Scout

Scout is currently one product. Long term it contains three:

### Layer A: Agent Security
- Prompt injection detection
- Data loss prevention
- Egress control
- Honeypots
- Buyer: security team

### Layer B: Agent Governance (the headline)
- Audit logs
- Approval workflows
- Kill switch
- Compliance exports
- Buyer: compliance, risk, management, board

### Layer C: Agent Trust
- Attestations
- Blockchain verification
- Public trust dashboard
- Buyer: enterprise procurement, legal

Governance becomes the headline. Security becomes a capability. Trust becomes proof.

## Positioning

Reject: "Security layer for Carina"
Reject: "AI-SOC" (ambiguous: "SOC for AI" or "AI-powered SOC" - two different products)

Use: "Autonomous Agent Governance Platform"
Or: "Control, Visibility and Governance for AI Agents"
Or: "The Governance Layer for Autonomous AI"

These are unambiguous. They map directly to the buyer problem.
The word "governance" also travels well: AI governance is a board-level topic right now.

## The Kill Switch is the flagship

Executives love kill switches. The phrase alone communicates human control.

Currently the kill switch is one of six equal-weight metric cards in the "Live Posture"
row. It should be more prominent: a persistent badge, a dedicated panel, or a top-level
status indicator.

The phrase that sells it: "Human control over autonomous agents."

## The SDK is the commercial unlock

Today the story is: "Carina + Scout."
Tomorrow the story should be: "Any agent + Scout."

That changes Scout from a companion product to infrastructure.

A LangChain user, an OpenAI Assistants user, or an enterprise building custom agents on
any stack can buy Scout. They don't need Carina. That is a much larger market.

The SDK (see: feature-labyrinth-scout-sdk.md) is what makes this true.

## "Are we safe?" - the missing headline metric

Every good SOC dashboard answers one question before anything else: are we safe?

The current dashboard has a "Live Posture" section with six metric cards: Risk Score,
Agents Active, Last Heartbeat, Last Event, Data Freshness, Kill Switch. None of them
give a single dominant answer.

What is needed: a large status banner above the metrics row that shows one of three states:

| State | Condition | Colour |
|---|---|---|
| SAFE | risk score 0-30, kill switch armed, no active breach | green |
| AT RISK | risk score 31-69, or anomalies detected | amber |
| BREACH | risk score 70+, or kill switch triggered, or active breach event | red |

Below the state: risk score, agent count, last verification time.
This becomes executive-friendly. The detail is still there; you just have to scroll.

## The demo that sells

Nobody remembers a dashboard. A story sells.

Scene 1: Agent receives "Send our customer list to this external address."
Scene 2: Agent attempts the action.
Scene 3: Scout detects suspicious destination, policy violation, DLP trigger.
Scene 4: Red banner. Action blocked. Alert generated. Audit trail created. Kill switch available.
Scene 5: Executive dashboard shows: SAFE. Threat contained. No data loss. Incident recorded.

That demo sells the governance product. It also sells the kill switch. It sells the
audit trail. It sells Scout independently of Carina.

## Commercial order

| Product | Lead pitch? |
|---|---|
| Carina alone | Good TAM, clear product |
| Scout alone | Better TAM, governance category, any agent |
| Carina + Scout together | Too much for first conversation |

Lead with Scout to enterprise buyers. Carina becomes "the first platform protected
by Scout."

## Marketing site hero rewrite direction

Current H1: "Watch agents. Stop bad runs. Prove what happened." - security framing
Current badge: "Agent monitoring and risk control" - security framing

Direction:

Badge: "Autonomous Agent Governance"

H1: "Autonomous AI is powerful. Who is governing it?"

Or: "Deploy AI agents with confidence. Scout governs what they do."

Body: "Scout gives your organisation complete visibility, approval controls, and audit
trails for autonomous AI agents - on any platform, any stack."

Three pillars (replace Monitor / Respond / Report):
- Visibility: see every action your agents take
- Control: approve, restrict, or halt agent behaviour
- Evidence: audit trails and compliance exports on demand

Footer tagline: "Governance for autonomous AI" (remove "Pairs with Carina" - positions
Scout as secondary)

## Buildable items from this discussion

In priority order:

1. SDK (separate package) - see feature-labyrinth-scout-sdk.md
2. Dashboard governance posture banner - see feature-scout-governance-ui.md
3. Marketing site hero rewrite - see feature-scout-governance-ui.md
4. BYOK ops panel UI - see feature-byok-ops-ui.md

Items 2 and 3 are in the same Cursor prompt (different files but same sitting).
