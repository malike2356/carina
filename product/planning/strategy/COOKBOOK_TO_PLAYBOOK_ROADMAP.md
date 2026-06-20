# From Cookbook to Playbook: Full Roadmap

**Date:** 15 June 2026
**Context:** Carina's `cookbook/` module currently does hardware-aware model
recommendation; a deterministic look-up table. This roadmap transforms it
into a situational decision engine that powers every VERLOX product.

---

## Current State (The Cookbook)

```
src/cookbook/; 10 files, ~400 lines

  HardwareProfile → Recommender → Recommendation
  (CPU cores, RAM,   (VRAM/RAM    (model name,
   GPU VRAM, disk)    headroom,    serve command,
                      tier match)  notes)

One input shape. One output shape. No branches. No constraints.
No task context. No budget awareness. No risk model.
```

The cookbook answers exactly one question: "What model fits my hardware?"
It does not answer: "Given what I need to do, my budget, my deadline, my
privacy constraints, and my hardware; what should I do?"

---

## Target State (The Playbook)

```
TaskProfile + Constraints + HardwareProfile
         ↓
     Classifier  ←→  Domain Packs (vertical knowledge)
         ↓
    Capability Map
         ↓
   Path Generator  →  Path A (fastest)
                   →  Path B (cheapest)
                   →  Path C (safest)
                   →  Path D (balanced)
         ↓
   Path Scorer  (cost × speed × risk × quality)
         ↓
    Playbook Response
    │
    ├─ Recommended path with reasoning
    ├─ Tradeoff explanation
    ├─ "Execute this path?" prompt
    └─ Execution plan if confirmed
```

The playbook answers: "Given your situation; here are your options, here's
what I recommend, here's why, do you want me to do it?"

---

## Phase 1: Constraint Schema & Task Profiler (Week 1-2)

### Goal
Give the system the vocabulary to understand what the user actually needs.

### What to Build

**1.1 `src/playbook/constraints.ts`; Constraint Schema**

```typescript
interface TaskConstraints {
  // Time
  deadline?: string; // ISO 8601
  maxDurationMinutes?: number;

  // Money
  budgetHardLimit?: number; // in user's currency
  budgetPreference?: 'cheapest' | 'balanced' | 'unconstrained';

  // Privacy & Compliance
  containsPII?: boolean;
  requiresOffline?: boolean;
  dataResidencyCountry?: string; // GDPR jurisdiction
  maxDataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';

  // Quality
  qualityMinimum?: 'draft' | 'production' | 'compliance' | 'legal';
  requiresHumanReview?: boolean;

  // Execution
  maxConcurrency?: number;
  preferredProvider?: string;
  excludedProviders?: string[];
  requiresAuditTrail?: boolean;
}

interface TaskProfile {
  goal: string; // natural language; what the user wants done
  taskType: TaskType; // classified by the engine
  scale?: TaskScale; // volume estimate
  constraints: TaskConstraints;
}
```

**1.2 `src/playbook/task-classifier.ts`; Task Classifier**

Classifies incoming tasks into known types. Leverages the existing
`brain/task-classifier.ts` but extends it with domain specificity:

| TaskType | Examples |
|---|---|
| `document_analysis` | "Analyze 200 property documents" |
| `document_generation` | "Draft an offer letter" |
| `data_extraction` | "Extract all tenant contact details" |
| `summarization` | "Summarize this deal pipeline" |
| `code_generation` | "Build a Stripe integration" |
| `research_synthesis` | "Research rent-to-rent regulations in Portsmouth" |
| `compliance_check` | "Check if this HMO meets regulations" |
| `deal_analysis` | "Score this property deal" |
| `communication_draft` | "Draft an email to the vendor" |
| `scheduled_report` | "Generate monthly portfolio report" |

**1.3 `src/playbook/types.ts`; Unified Types**

All the playbook type definitions. Separated from cookbook types to avoid
breaking the existing module.

### Deliverables
- [ ] `src/playbook/` directory created
- [ ] `types.ts` with TaskProfile, TaskConstraints, TaskType, PlaybookResponse
- [ ] `constraints.ts` with validation and defaults
- [ ] `task-classifier.ts` extending brain/task-classifier
- [ ] Unit tests for constraint validation
- [ ] Unit tests for task classification (50+ sample tasks)

### State After Phase 1
The system can now take a user's goal + constraints and classify what kind
of task it is. Still returns a single recommendation, but the recommendation
now considers the task type when choosing models.

---

## Phase 2: Path Generator (Week 3-4)

### Goal
Generate multiple possible approaches to any task, not just one.

### What to Build

**2.1 `src/playbook/path-generator.ts`**

For any classified task, generate 3-4 distinct paths:

```
Path A; Fastest:   Cloud API, largest model, cost ignored
Path B; Cheapest:  Local model, max quantization, time ignored
Path C; Safest:    Local-only, PII redacted before any network call
Path D; Balanced:  Weighted multi-objective optimization
```

Path generation rules by task type:

| TaskType | Path variables |
|---|---|
| document_analysis | model, batch size, chunking strategy, cloud vs local |
| code_generation | model, agent delegation, test-after-write toggle |
| research_synthesis | model, search depth, source count, cross-reference toggle |
| deal_analysis | model, data sources (all vs recent only), comparable breadth |
| compliance_check | model, regulation database version, audit trail detail |

**2.2 `src/playbook/capability-map.ts`**

Maps available resources to what they can achieve:

```typescript
interface CapabilityMap {
  localModels: ModelCapability[];
  cloudProviders: ProviderCapability[];
  availableCredits: CreditPool[];
  hardwareLimits: HardwareLimit[];
  toolsAvailable: string[];
  domainPacksLoaded: string[];
  memoryAccess: 'none' | 'session' | 'persistent' | 'full';
}
```

**2.3 `src/playbook/path-scorer.ts`**

Scores each path against constraints:

```
pathScore = (costWeight × costScore) +
            (speedWeight × speedScore) +
            (riskWeight × riskScore) +
            (qualityWeight × qualityScore)

Weights derived from constraints:
  - budgetPreference=cheapest → costWeight=0.5, speedWeight=0.1
  - qualityMinimum=legal     → qualityWeight=0.6, costWeight=0.1
  - containsPII=true         → riskWeight=0.6
```

**2.4 `src/playbook/playbook-response.ts`**

The structured response format:

```typescript
interface PlaybookResponse {
  recommendedPath: string; // "Path C: Hybrid PII-Safe"
  reasoning: string[]; // ["PII constraint rules out cloud-only",
                                 //  "Deadline rules out local-only",
                                 //  "Hybrid satisfies both"]
  allPaths: ScoredPath[]; // All generated paths with scores
  tradeoffs: string; // "Path A is 3x faster but costs £12 more"
  executionPlan?: ExecutionStep[]; // If user confirms, here's how to execute
  risks: RiskFlag[]; // "PII will touch cloud infrastructure"
  confirmationRequired: boolean; // Gate before execution
}
```

### Deliverables
- [ ] `path-generator.ts` with 4-path strategy for all 10 task types
- [ ] `capability-map.ts` with hardware + cloud + credit awareness
- [ ] `path-scorer.ts` with weighted multi-objective scoring
- [ ] `playbook-response.ts` with structured response builder
- [ ] Integration test: "Analyze 200 docs with PII, £50 budget, 24h deadline"
- [ ] Returns 4 distinct paths with different model/provider/approach combos

### State After Phase 2
The system now generates multiple paths and scores them. It recommends the
best path with reasoning. It's a playbook for model/task routing; but still
only for the model-selection domain.

---

## Phase 3: Domain Playbooks (Week 5-7)

### Goal
Expand the playbook beyond model selection into domain-specific decision-making.
This is where it starts delivering real business value.

### What to Build

**3.1 Domain Playbook: Property (Propreneur/Xelox)**

`src/playbook/domains/property/`

| Play | Trigger | Paths |
|---|---|---|
| Deal sourcing strategy | User wants to find deals | Path A: Auction-focused. Path B: Off-market/Direct-to-vendor. Path C: Estate agent relationships. Path D: Hybrid |
| Offer negotiation | Vendor countered | Path A: Accept counter (fast close). Path B: Split difference. Path C: Walk away signal. Path D: Creative terms (rent credit, delayed completion) |
| Due diligence escalation | Survey returned with issues | Path A: Proceed as-is (price reflects). Path B: Renegotiate. Path C: Specialist survey. Path D: Walk away. |
| Tenant arrears response | Tenant 14+ days late | Path A: Friendly reminder. Path B: Formal notice. Path C: Payment plan offer. Path D: Section 8 preparation |
| Portfolio rebalancing | Quarterly review | Path A: Sell underperformers. Path B: Refinance. Path C: Increase rents. Path D: Hold |

Each play is a JSON/YAML definition the playbook engine can load:

```yaml
play: deal_offer_negotiation
domain: property
triggers:
  - vendor_counter_above_asking
  - vendor_rejected_offer
  - multiple_bidders
constraints_considered:
  - budget_hard_limit
  - deadline_to_complete
  - investment_strategy  # buy-to-let vs flip vs rent-to-rent
paths:
  - id: accept_counter
    label: "Accept the counter-offer"
    conditions: "counter ≤ 5% above your max AND property scores ≥ 80"
    implications: "Fast close, higher cost, lower yield"
  - id: split_difference
    label: "Offer to split the difference"
    conditions: "counter is 5-15% above your max"
    implications: "Shows willingness, keeps deal alive, moderate cost"
  - id: walk_away_signal
    label: "Signal willingness to walk away"
    conditions: "counter > 15% above max OR you have ≥ 3 alternative deals"
    implications: "May bring vendor back to table, risks losing deal"
  - id: creative_terms
    label: "Propose creative terms"
    conditions: "vendor is motivated but price-sensitive"
    implications: "Rent credit, delayed completion, lease option; complex but win-win"
```

**3.2 Domain Playbook: Security (Scout)**

`src/playbook/domains/security/`

| Play | Trigger | Paths |
|---|---|---|
| Injection detected | Prompt injection blocked | Path A: Log only (first occurrence). Path B: Rate limit session. Path C: Quarantine session. Path D: Escalate to operator |
| Anomaly spike | Z-score > 3.0 on any metric | Path A: Observe. Path B: Restrict tools. Path C: Require approvals. Path D: Suspend instance |
| Breach confirmed | Honeypot triggered | Path A: Isolate session. Path B: Kill instance. Path C: Forensic capture + kill. Path D: Global kill switch |
| Egress blocked | Data leak prevented | Path A: Log. Path B: Block user. Path C: Block tool. Path D: Quarantine + alert |
| Compliance deadline | 7 days to SAR due date | Path A: Auto-generate report. Path B: Notify operator. Path C: Escalate to admin |

**3.3 Domain Playbook: Business Operations (VERLOX)**

`src/playbook/domains/business/`

| Play | Trigger | Paths |
|---|---|---|
| Client onboarding | New Propreneur signup | Path A: Self-serve (free tier). Path B: Guided setup (paid). Path C: White-glove (enterprise) |
| Payment failed | Stripe subscription past due | Path A: Retry in 3 days. Path B: Email reminder. Path C: Downgrade to free. Path D: Suspend access |
| Deal pipeline stalled | Deal unmoved for 14+ days | Path A: Nudge reminder. Path B: Auto-escalate to mentor. Path C: Archive as dead. Path D: Reassign |
| Capacity alert | 80%+ of plan limit reached | Path A: Warn user. Path B: Suggest upgrade. Path C: Throttle non-critical. Path D: Auto-upgrade with confirmation |

### Deliverables
- [ ] Playbook engine: loads domain play definitions from YAML/JSON
- [ ] Property domain: 6 play definitions (deal sourcing, negotiation, due diligence, arrears, portfolio, compliance)
- [ ] Security domain: 5 play definitions (injection, anomaly, breach, egress, compliance)
- [ ] Business domain: 4 play definitions (onboarding, payment, pipeline, capacity)
- [ ] Play evaluator: matches triggers → activates play → scores paths → returns recommendation
- [ ] Integration tests for each domain

### State After Phase 3
The playbook system now handles real business decisions, not just model
selection. A Propreneur user facing a vendor counter-offer gets a structured
playbook response with 4 paths, scoring, and reasoning.

---

## Phase 4: Learning Loop & Play Evolution (Week 8-10)

### Goal
Make the playbook self-improving. Plays that work get reinforced. Plays
that don't get deprecated. New plays emerge from patterns.

### What to Build

**4.1 `src/playbook/play-tracker.ts`**

Tracks which plays were recommended, which were chosen, and outcomes:

```typescript
interface PlayExecution {
  playId: string;
  domain: string;
  recommendedPath: string;
  chosenPath: string; // what the user actually chose
  outcome?: 'success' | 'partial' | 'failure';
  outcomeNotes?: string;
  timeToDecision: number; // seconds between recommendation and choice
  overrides: string[]; // constraints user changed manually
}
```

**4.2 `src/playbook/play-scorer-evolution.ts`**

Updates path scoring weights based on actual outcomes:

- If Path C is consistently chosen over Path A → weight shifts toward Path C's characteristics
- If a play's recommended path fails >30% of the time → flag for review
- If users consistently override a constraint → default constraint shifts

**4.3 `src/playbook/play-emergence.ts`**

Detects patterns that suggest new plays should be created:

- "Users keep asking for {X} but no play covers it" → suggest new play
- "Path that doesn't exist keeps being manually executed" → codify as a path
- "Existing play has >5 paths" → split into two plays

**4.4 `src/playbook/play-curator.ts`**

Periodic review cycle (similar to skill curator):

- Flags plays with low usage for archival
- Flags plays with high failure rates for revision
- Promotes emerging patterns to formal plays
- Never deletes; archives with reason

### Deliverables
- [ ] Play execution tracking with persistence
- [ ] Outcome-weighted score evolution
- [ ] Play emergence detection
- [ ] Play curator scheduler (weekly cycle)
- [ ] Dashboard: play usage, success rates, emerging patterns

### State After Phase 4
The playbook learns. It gets better over time. It notices when you keep
overriding its recommendations and adapts. It spots new patterns and
proposes new plays.

---

## Phase 5: Cross-Product Integration (Week 11-12)

### Goal
Wire the playbook into every VERLOX product surface.

### What to Build

**5.1 Carina Tool: `playbook`**

A new tool available to Carina agents:

```
Carina, I need a playbook for: vendor countered 15% above my max offer.
Budget is £350K hard limit. Property scored 82. Deadline: 48 hours.

→ Playbook: "Deal Offer Negotiation" activated.
  Recommended: Path B; Split the difference at £332K.
  Reasoning: Counter is within 15% range. Property scores well (82). 
  You have 2 alternatives. Splitting keeps deal alive at acceptable cost.
  All paths: [shows 4 with scores]
  Execute this? [Y/N/Custom]
```

**5.2 Propreneur Integration**

Playbook responses embedded in the Propreneur deal pipeline:

- Deal moves to "Offer" stage → playbook activates automatically
- Playbook response appears in deal notes
- "Execute" button triggers the next steps (draft offer, schedule viewing, etc.)
- Mentor dashboard shows playbook usage across all mentees

**5.3 Scout Integration**

Playbook responses for security incidents:

- Alert fires → playbook evaluates → response appears in Scout dashboard
- Operator sees: "Recommended: Path B; Restrict tools for this session"
- One-click execution from the dashboard

**5.4 Xelox Integration**

Playbook responses for property operations:

- "Morning: here are 3 deals. For each, here's the recommended play."
- Automated deal scoring with playbook-driven action recommendations

### Deliverables
- [ ] `carina playbook` CLI command
- [ ] Playbook tool registered in Carina tool registry
- [ ] Propreneur deal pipeline integration (playbook webhook)
- [ ] Scout incident response playbook integration
- [ ] Xelox daily deal playbook
- [ ] End-to-end test: "Vendor countered → playbook activated → operator chose path → actions executed"

---

## Complete File Map

After all phases, the structure will be:

```
src/
├── cookbook/                          # Existing; unchanged
│   ├── catalog.ts                     # Model catalog
│   ├── catalog-data.ts                # Model entries
│   ├── recommender.ts                 # Hardware → model matching
│   ├── hardware.ts                    # Hardware profiling
│   ├── serve.ts                       # Serve command generation
│   ├── cloud-recommendations.ts       # Cloud provider matching
│   └── types.ts                       # Cookbook types
│
├── playbook/                          # NEW; the playbook engine
│   ├── index.ts                       # Barrel exports
│   ├── types.ts                       # TaskProfile, Constraints, PlaybookResponse
│   ├── constraints.ts                 # Constraint validation + defaults
│   ├── task-classifier.ts             # Task type classification
│   ├── capability-map.ts              # Available resources → capability mapping
│   ├── path-generator.ts              # Multi-path generation
│   ├── path-scorer.ts                 # Weighted path scoring
│   ├── playbook-response.ts           # Response builder
│   ├── play-tracker.ts                # Execution tracking
│   ├── play-scorer-evolution.ts       # Score weight evolution
│   ├── play-emergence.ts              # New play detection
│   ├── play-curator.ts                # Play lifecycle management
│   ├── play-loader.ts                 # YAML/JSON play definition loader
│   ├── play-evaluator.ts              # Trigger matching + path activation
│   │
│   ├── domains/                       # Domain-specific play definitions
│   │   ├── index.ts
│   │   ├── property/
│   │   │   ├── deal-sourcing.yml
│   │   │   ├── offer-negotiation.yml
│   │   │   ├── due-diligence.yml
│   │   │   ├── tenant-arrears.yml
│   │   │   ├── portfolio-rebalance.yml
│   │   │   └── compliance-hmo.yml
│   │   ├── security/
│   │   │   ├── injection-detected.yml
│   │   │   ├── anomaly-spike.yml
│   │   │   ├── breach-confirmed.yml
│   │   │   ├── egress-blocked.yml
│   │   │   └── compliance-deadline.yml
│   │   └── business/
│   │       ├── client-onboarding.yml
│   │       ├── payment-failed.yml
│   │       ├── deal-stalled.yml
│   │       └── capacity-alert.yml
│   │
│   └── tools/
│       └── playbook-tool.ts           # Carina tool registration
```

---

## What NOT to Build

Explicitly out of scope to avoid bloat:

- **Visual play editor.** No drag-and-drop. Plays are YAML/JSON. Simple.
- **n8n replacement.** The playbook does not replace n8n. n8n executes plays.
  The playbook decides which play to run. They complement.
- **Full GRC platform.** Scout's governance module handles compliance.
  The playbook handles operational decisions. Different domains.
- **Natural language play creation.** Too unreliable. Plays are authored
  as structured YAML. Carina can suggest new plays, but humans approve them.

---

## Dependencies Between Phases

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
  │            │            │            │
  │            │            │            └── Requires play data from Phase 3
  │            │            └── Requires path generator from Phase 2
  │            └── Requires task classifier + constraints from Phase 1
  └── No dependencies. Standalone.

Phase 5 depends on Phase 3 (domain plays must exist before integration).
```

Phases 1-2 can overlap. Phase 3 can start once path generator is stable.
Phase 4 needs at least 2 weeks of play execution data. Phase 5 is wiring.

---

## Success Metrics

| Phase | Metric | Target |
|---|---|---|
| 2 | Path diversity | Every task generates ≥3 distinct paths |
| 2 | Score explanation | Every recommendation includes reasoning text |
| 3 | Domain coverage | ≥15 play definitions across 3 domains |
| 3 | Trigger accuracy | ≥90% correct trigger→play matching |
| 4 | Play outcome tracking | 100% of plays track chosen path + outcome |
| 4 | Score convergence | After 50 plays, weights shift ≥10% toward actual choices |
| 5 | Integration completion | Playbook accessible from Carina CLI, Propreneur, Scout, Xelox |

---

## First Step; Do Tomorrow

The smallest thing that moves the needle:

1. Create `src/playbook/` directory
2. Write `types.ts`; just the type definitions. 50 lines.
3. Write `constraints.ts`; constraint validation. 80 lines.
4. Hard-code ONE play: "I need to analyze documents. Here's my hardware and budget. What should I do?"
5. Make it return 3 paths with reasoning.

That's 200 lines of code. That's the seed. Everything else grows from there.

The existing `cookbook/recommender.ts` already does the hardware matching.
The new code adds the "but what if..." layer on top. It doesn't replace
the cookbook; it wraps it and adds branches.





Thought Process bellow

what's the difference between cookbook and playbook?
────────────────────────────────────────

  ┊  preparing search_files…
  ┊  preparing search_files…
  ┊  find      .*  0.7s
  ┊  grep      playbook  0.7s
  ┊  preparing read_file…
  ┊  preparing read_file…
  ┊  read      /opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/cookbook/types.ts  0.1s
  ┊  read      /opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/cookbook/index.ts  0.1s

╭─  Hermes ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
    Carina's cookbook module is specifically about model recommendation (hardware-aware: "your machine has 8GB VRAM, here's which models fit"). But your question is bigger than that, so here's the real distinction:

    Cookbook = Recipes. Deterministic. Step-by-step. Follow exactly.
    
    A cookbook tells you: "To bake a cake, preheat oven to 180°C. Mix flour, eggs, sugar. Pour into tin. Bake 30 minutes." You follow the steps. You get a cake. Every time. No judgment required.
    
    Playbook = Plays. Situational. Conditional. Requires judgment.
    
    A playbook tells you: "If the quarterback blitzes, throw to the tight end. If they drop into coverage, hand off to the running back. If you're down by 6 with 2 minutes left, run the two-minute drill." The play that's correct depends on what you're facing.
    
    
    
    The practical difference for what you're building:
    
    Column 1: Trigger
    Cookbook: "Do this task"
    Playbook: "This situation is happening"
    ────────────────────────────────────────
    Column 1: Structure
    Cookbook: Linear sequence
    Playbook: Decision tree / branching
    ────────────────────────────────────────
    Column 1: User
    Cookbook: Someone who knows what they want
    Playbook: Someone who knows what they're facing
    ────────────────────────────────────────
    Column 1: Examples
    Cookbook: "Deploy Carina to a VPS"
    Playbook: "What to do when Scout detects a breach"
    ────────────────────────────────────────
    Column 1: Examples
    Cookbook: "Source a property deal"
    Playbook: "How to negotiate when the vendor counters 15% above asking"
    ────────────────────────────────────────
    Column 1: Examples
    Cookbook: "Set up Stripe billing"
    Playbook: "What to do when a tenant stops paying rent"
    
    
    
    Where Carina uses each:
    
    - Cookbook (src/cookbook/): Model recommendation engine. Hardware profile goes in → recommended models come out. Deterministic. Pure recipe.
    - Playbook (skill-packs, runbooks): Skill packs are structured playbooks. The Scout Type 3 runbook says "If reasoning compromise detected → escalate to quarantine mode → capture forensic snapshot → alert operator." It's conditional. It branches. It requires context.
    
    
    
    Why this matters for VERLOX:
    
    Your products need both. Propreneur needs cookbooks (how to source a deal, how to run a viewing, how to complete compliance) AND playbooks (what to do when a deal falls through, how to handle a tenant dispute, when to walk away from a negotiation).
    
    The cookbook is what you give a new mentee on day one. The playbook is what makes a mentor worth £5,000 for 6 months.
    
    at work point does a cookbook becomes a playbook?
────────────────────────────────────────

╭─  Hermes ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
    The boundary is crossed at a specific moment: when the first "if" enters the recipe.

    A cookbook says "do this." A playbook says "if this, do that. if that, do this."
    
    But the real answer is deeper. Here's the gradient:
    
    
    
    Stage 1: Pure Cookbook
    "Do A, then B, then C, then D."
    One path. No choices. Anyone can follow it.
    
    Stage 2: Cookbook with Tips
    "Do A, then B. (Tip: if B takes more than 10 minutes, you probably missed step A.3.) Then C."
    Still one path. The tip is just guardrail, not a branch.
    
    Stage 3: The First Branch; This Is the Transition Point
    "Do A, then B. If the vendor counters above asking, go to C1. If they accept, go to C2."
    That single conditional is the crossing. One moment it's a recipe. The next moment the user has to read the room and pick a path. That's judgment. That's a play.
    
    Stage 4: Playbook (Sparse)
    Multiple branches but shallow. "If tenant pays late → send reminder. If tenant disputes → escalate to mediation. If tenant stops paying → begin eviction." Three plays. Each is short. The expertise is knowing which play to call.
    
    Stage 5: Playbook (Dense)
    Deep branching with nested decisions. "If deal falls through in legals → identify why. If it's a title issue → assess severity. If minor indemnifiable → proceed with insurance. If major structural → walk away. If walk away → calculate sunk cost. If sunk cost <£2K → absorb and move on. If >£2K → negotiate cost-sharing with vendor."
    
    
    
    The precise transition point:
    
    A cookbook becomes a playbook when the unit of value shifts from the steps to the decisions.
    
    | Cookbook                   | Playbook                            |
    |----------------------------|-------------------------------------|
    | Value = "I know the steps" | Value = "I know which path to take" |
    | User asks "how?"           | User asks "what do I do given...?"  |
    | Wrong step = wrong outcome | Wrong decision = wrong path         |
    | Anyone can execute         | Only experience can navigate        |
    
    Cookbooks teach competence. Playbooks encode expertise.
    
    
    
    Why this matters for what you're building:
    
    Propreneur's value proposition isn't just "here's how to source a deal." That's a cookbook. Anyone can write that. ChatGPT can write that.
    
    The thing Salim charges £5,000 for; the thing that makes a mentor worth paying; is the playbook. "Here's what to do when the survey comes back with damp, the vendor won't budge, and your investor is getting cold feet." That's 3 conditions. That's a play. That's worth money.
    
    The Product Bible I just wrote is a cookbook. The Scout Type 3 runbook is a playbook.
    
    The litmus test: If you can hand it to a stranger and they can execute it without asking a single question, it's a cookbook. If they'll need to come back with "but what about...?"; it's a playbook.

    
    

so how do we make the carina cookbook become a playbook ?
────────────────────────────────────────

╭─  Hermes ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
    The current cookbook is a look-up table: hardware in → model out. To make it a playbook, you add context and branching. Here's the shift:

    Now (cookbook):
    
    Input: 8GB VRAM, 16GB RAM, no GPU
    Output: "Run Llama-3.1-8B-Q4_K_M on Ollama"
    
    One answer. Always right for the hardware. Zero judgment.
    
    After (playbook):
    
    Input: "I need to analyze 200 property documents by tomorrow. 
    I have 8GB VRAM, a £50 OpenAI credit, and the documents contain 
    tenant PII that can't leave my machine."
    
    Output: "Don't use OpenAI; PII restriction. Your hardware can't 
    batch 200 docs fast enough with a local model. Here's the play:
    
      Path A (fastest): Spin up a cloud GPU instance for £12, run 
        Llama-3.1-70B, process all 200 docs in 45 minutes, tear down.
      Path B (cheapest): Use your local 8B model with document chunking. 
        It'll take ~6 hours overnight but costs £0.
      Path C (safest): Do a first pass with local model to redact PII, 
        then use your remaining OpenAI credits for analysis. Hybrid.
        
      Given your deadline and PII constraint: Path C. Here's how."
    
    
    
    
    What changes technically:
    
    The current cookbook has 3 layers:
    
    
    HardwareProfile → Recommender → Recommendation
    
    
    The playbook adds 3 more:
    
    
    Task + Constraints → Classifier → Scored Paths
         +
    HardwareProfile → Recommender → Capability Map
         +
    Cost + Risk + Urgency → Optimizer → Best Path
    
    
    New Layer: Task Classifier
    What it does: Understands what you're actually trying to do; not just "run a model" but "analyze 200 docs by
      tomorrow with PII"
    ────────────────────────────────────────
    New Layer: Constraint Engine
    What it does: Maps real-world constraints: budget, privacy, deadline, legal, hardware, connectivity
    ────────────────────────────────────────
    New Layer: Path Scorer
    What it does: Generates multiple possible approaches, scores each against constraints, recommends best with
      tradeoffs explained
    
    
    
    The implementation; 3 steps:
    
    Step 1: Add a constraint schema to the cookbook
    
    The current HardwareProfile type becomes one input among many:
    
    typescript
    interface TaskProfile {
      goal: string; // what the user actually needs done
      documentCount?: number;
      deadline?: string; // ISO timestamp
      containsPII?: boolean;
      requiresOffline?: boolean;
      budgetHardLimit?: number;
      qualityMinimum?: 'draft' | 'production' | 'legal';
    }
    
    
    Step 2: Build the path generator
    
    Instead of one recommendation, generate 3-4 possible paths:
    
    
    For any task, Carina generates:
      - The fastest path (cost ignored)
      - The cheapest path (time ignored)  
      - The safest path (risk minimized)
      - The balanced path (weighted score)
    
    
    Step 3: Add the playbook reasoning
    
    The current cookbook returns a model name. The playbook returns a reasoning chain:
    
    
    "I recommend Path C because:
      1. PII constraint rules out cloud-only (eliminates Path A)
      2. Deadline rules out local-only (eliminates Path B)
      3. Path C (local PII redaction → cloud analysis) satisfies both
      4. Cost: £8 of your remaining £50 credit
      5. Risk: PII never leaves your machine
      
      Want me to execute this, or show you Path D (Docker-isolated local)?"
    
    
    
    
    Where this applies across your stack; right now:
    
    Product: Carina
    Cookbook Today: "Here's the model for your hardware"
    Playbook Tomorrow: "Given your task, constraints, budget, and deadline; here's the right approach, with
      tradeoffs"
    ────────────────────────────────────────
    Product: Propreneur
    Cookbook Today: "Here's how to source a deal"
    Playbook Tomorrow: "Given this specific deal: damp found, vendor won't budge, investor nervous; here are
      your 3 plays ranked by outcome probability"
    ────────────────────────────────────────
    Product: Scout
    Cookbook Today: "Alert: injection blocked"
    Playbook Tomorrow: "Alert: injection blocked. Pattern matches INJ-007. This is the 3rd block from this IP in
      24h. Recommended play: escalate to quarantine, capture forensic snapshot, alert operator. Want me to
      execute?"
    ────────────────────────────────────────
    Product: Xelox
    Cookbook Today: "Here are 10 properties matching your criteria"
    Playbook Tomorrow: "Here are 10 properties. 3 are below market by >15%. Of those, 1 has a motivated vendor
      (listed 90+ days). Play: offer 20% below asking, settle at 15%. Here's the draft offer."
    
    
    
    The one-line answer:
    
    The cookbook becomes a playbook the moment Carina stops answering "what should I use?" and starts answering "given my situation, what should I do?"; and then offers you the choice between paths with the reasoning laid bare.
    
    
    
    Here's the structure:
    
    
    
    5 Phases; 12 Weeks
    
    Phase: 1. Constraint Schema & Task Profiler
    Weeks: 1-2
    What Changes: System learns to understand what you need; not just your hardware, but your goal, budget,
      deadline, PII constraints, quality requirements
    ────────────────────────────────────────
    Phase: 2. Path Generator
    Weeks: 3-4
    What Changes: Instead of one answer, generates 4 paths per task: fastest, cheapest, safest, balanced. Each
      scored against your constraints with reasoning.
    ────────────────────────────────────────
    Phase: 3. Domain Playbooks
    Weeks: 5-7
    What Changes: Expands beyond model selection into real business decisions. 15 play definitions across 3
      domains: property (deals, negotiations, arrears), security (injection, breach, anomaly), business
      (onboarding, payments, pipeline)
    ────────────────────────────────────────
    Phase: 4. Learning Loop
    Weeks: 8-10
    What Changes: Self-improving. Tracks which plays you choose, learns from outcomes, proposes new plays when
      patterns emerge, curates stale ones.
    ────────────────────────────────────────
    Phase: 5. Cross-Product Integration
    Weeks: 11-12
    What Changes: Wired into Carina CLI, Propreneur deal pipeline, Scout incident response, Xelox daily deal
      scanner
    
    
    
    The architecture shift in one diagram:
    
    
    BEFORE (Cookbook):                    AFTER (Playbook):
                                          
    HardwareProfile                       TaskProfile + Constraints + HardwareProfile
          ↓                                        ↓
      Recommender                          Classifier ← Domain Packs
          ↓                                        ↓
      "Run Llama-8B"                       Capability Map
                                                  ↓
                                           Path Generator → 4 paths
                                                  ↓
                                           Path Scorer (cost×speed×risk×quality)
                                                  ↓
                                           "Path C: Hybrid. Here's why.
                                            Want me to execute?"
    
    
    
    
    What already exists vs what needs building:
    
    | Layer                   | Status                            | Effort                             |
    |-------------------------|-----------------------------------|------------------------------------|
    | Hardware profiling      | Exists (cookbook/hardware.ts)     | Use as-is                          |
    | Model catalog           | Exists (cookbook/catalog.ts)      | Use as-is                          |
    | Model recommendation    | Exists (cookbook/recommender.ts)  | Wrap, don't replace                |
    | Task classifier         | Exists (brain/task-classifier.ts) | Extend with domain types           |
    | Constraint schema       | New                               | ~80 lines                          |
    | Path generator          | New                               | ~200 lines                         |
    | Path scorer             | New                               | ~150 lines                         |
    | Play definitions (YAML) | New                               | 15 files, ~50 lines each           |
    | Play evaluator          | New                               | ~200 lines                         |
    | Play tracking           | New                               | ~150 lines                         |
    | Play curator            | New                               | ~100 lines (mirrors skill curator) |
    
    
    
    First step; do tomorrow: Create src/playbook/types.ts + constraints.ts. Hard-code one play: "I need to analyze documents. Here's my constraints." Make it return 3 paths. 200 lines. The seed.
