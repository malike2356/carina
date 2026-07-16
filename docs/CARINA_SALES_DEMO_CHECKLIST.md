# Carina vs ChatGPT: sales demo checklist

**Purpose:** Live demo and leave-behind so Carina reads as a **copilot inside the MIS**, not a chat widget bolt-on.

**Audience:** Sales, mentors, founders doing product demos.

**Technical reference:** `brain/knowledge/08-carina.md`, `brain/knowledge/59-carina-propreneur-full-codex.md`, `config/billing.php` (plan module sets).

**Review date:** May 2026

---

## Positioning (say once, then stop comparing brands)

| Say | Do not say |
|-----|------------|
| "Carina sits on your deals, contacts, compliance, and calculators. It can **do** work in your workspace, not just advise in a tab." | "It's like ChatGPT but for property." |
| "ChatGPT is great for general research. Carina is for **this pipeline, this deal, this workspace's rules**." | "We use Claude/GPT under the hood." (true but invites commodity comparison) |

**Rule:** Every demo beat must **read live workspace data** or **change something in Propreneur**. If it only produces text in the chat pane, skip it or save it for last.

---

## Master feature checklist (battle card)

Legend: **C** = Carina (Propreneur v2) | **G** = ChatGPT (typical Plus/Team) | **P** = Partial / manual workaround

### Context: knows your workspace

| # | Capability | C | G | Sales note |
|---|------------|---|---|------------|
| 1 | Opens scoped to **this deal** (address, strategy, saved analysis) | Yes | P | Demo from deal page, not blank `/carina` |
| 2 | Scoped to **this property** | Yes | P | |
| 3 | Scoped to **this contact / investor** | Yes | P | |
| 4 | Scoped to **pipeline board / card** | Yes | No | |
| 5 | Scoped to **compliance item** | Yes | No | |
| 6 | Scoped to **journal entry / expense** | Yes | No | Operator accounting story |
| 7 | Scoped to **booking (viCal)** | Yes | No | |
| 8 | Scoped to **course / mentorship / community** | Yes | No | Academy plan |
| 9 | **Investors hub** context | Yes | No | |
| 10 | Floating widget thread while navigating the app | Yes | No | "In the app", not a separate product |

Supported `context_type` values (tenant): `deal`, `deal_calculator`, `property`, `contact`, `pipeline`, `pipeline_deal`, `compliance`, `report`, `course`, `community_post`, `mentorship`, `journal_entry`, `expense`, `vcal_booking`, `investors_hub`, `floating_widget`.

### Knowledge: your docs, not only the public internet

| # | Capability | C | G | Sales note |
|---|------------|---|---|------------|
| 11 | **Per-tenant RAG** (uploaded playbooks, SOPs) | Yes | P | Upload one doc before demo |
| 12 | **Product help** from ingested platform knowledge | Yes | No | "How do I post a journal?" with correct steps |
| 13 | Retrieval **isolated per workspace** | Yes | No | Trust story for agencies |
| 14 | Optional **live web** snippets (Tavily) | Yes | Yes | Do not lead with this |
| 15 | Voice input (Whisper) | Yes | Yes | Nice-to-have, not a lead demo |

### Actions: changes the system (Carina Agent)

| # | Capability | C | G | Sales note |
|---|------------|---|---|------------|
| 16 | **Run deal calculator** (BTL, BRR, HMO, R2R, etc.) | Yes | No | Same engines as Deal Desk |
| 17 | **Strategy finder** | Yes | No | |
| 18 | **Read saved deal analysis** (JSON from DB) | Yes | P | ChatGPT guesses numbers |
| 19 | **Search / list / create / update / delete contacts** | Yes | No | |
| 20 | **Add pipeline card / list deals / close deal** (with confirm) | Yes | No | Show confirmation gate |
| 21 | **List / create property** (with confirm) | Yes | No | |
| 22 | **Compliance items** | Yes | No | |
| 23 | **Read journals / accounting integrations catalog** | Yes | No | |
| 24 | **Generate deal pack PDF** (with confirm) | Yes | No | Artifact in Document Vault |
| 25 | **Enrol contact in comms sequence** (with confirm) | Yes | No | Real outbound, not draft-only |
| 26 | **Schedule session / vCal availability** | Yes | No | Academy customers |
| 27 | **Academy**: tracks, lessons, progress | Yes | No | |
| 28 | **Projects**, asset / net worth tools | Yes | No | Operator portfolio |
| 29 | **Deal sourcing intelligence** | Yes | No | Sourcing criteria story |
| 30 | High-impact tools require **in-app confirmation** | Yes | No | Trust differentiator |
| 31 | Hides **internal IDs** in user-facing replies | Yes | N/A | Agency polish |

Representative agent tools (tenant): `RunCalculatorTool`, `RunStrategyFinderTool`, `RunDevelopmentCalculatorTool`, `GetDealAnalysisTool`, `GenerateDealPackTool`, `SearchContactsTool`, `AddPipelineCardTool`, `ClosePipelineDealTool`, `GetComplianceItemsTool`, `SendCommunicationSequenceTool`, `ScheduleSessionTool`, and others under `app/Services/Carina/Tools/`.

### Governance

| # | Capability | C | G | Sales note |
|---|------------|---|---|------------|
| 32 | Per-tenant / per-user **rate limits** | Yes | P | |
| 33 | **BYOK** (tenant API keys) | Yes | No | Cost control at scale |
| 34 | Input/output hardening, security audit events | Yes | No | Enterprise objections |
| 35 | Conversation **transcript export** | Yes | P | |

### Generic AI (weak for differentiation)

| # | Capability | C | G | Sales note |
|---|------------|---|---|------------|
| 36 | General knowledge, coding, non-property tasks | Yes | Yes | **Do not demo** in first meeting |
| 37 | Arbitrary live browsing | P | Yes | |
| 38 | Useful with **zero** Propreneur data loaded | Yes | Yes | Onboarding gap, not a selling mode |

---

## Plan gating (set expectations)

| Mode | Feature flags | Typical plans | Demo |
|------|---------------|---------------|------|
| **Carina AI** | `carina_ai` | Investor and above | Context + RAG + read-only Q&A |
| **Carina Agent** | `carina_agent` | Operator, Academy, trial expanded | Tools, writes, confirmations |

Reference pricing: `brain/knowledge/125-subscriptions-billing.md` (Investor £49, Operator £99, Academy £199).

If the prospect is **Investor only**, do not promise pipeline writes; show context + analysis and upsell Agent.

---

## Live demo run-of-show (~12 minutes)

Check off during the call or Loom recording.

### Beat 1: Context without copy-paste (2 min) - MUST

- [ ] Open a **real deal** (prefer BRR or R2R).
- [ ] Launch Carina from the deal (context `deal` or `deal_calculator`).
- [ ] Ask: *"Summarise this deal in three bullets for an investor email."*
- [ ] Numbers and address match the deal screen; nothing pasted.

**Contrast line:** *"In ChatGPT you'd retype or export; Carina already has the analysis object."*

### Beat 2: Calculator as action (2 min) - MUST (Agent)

- [ ] Ask: *"If refurb came in £15k over budget, what happens to cash left in after refinance?"*
- [ ] Agent runs `RunCalculatorTool` (or equivalent).
- [ ] Result matches **your** calculator / show-your-working if visible.

**Contrast line:** *"ChatGPT invents a spreadsheet. This runs your underwriting engine."*

### Beat 3: Pipeline + CRM (2 min) - MUST (Agent)

- [ ] *"Add a follow-up for Tuesday"* or *"Find HMO investors in Manchester."*
- [ ] Show contact search or pipeline update.
- [ ] If closing a stage: show **confirmation** dialog.

**Contrast line:** *"Nothing in ChatGPT updates your CRM or board."*

### Beat 4: Artifact in the product (2 min) - MUST (Operator)

- [ ] *"Generate a deal pack for this deal."*
- [ ] Complete confirmation.
- [ ] Open **Documents / vault**; show new PDF.

**Contrast line:** *"A file in your system of record, not a chat attachment."*

### Beat 5: Your playbook (2 min) - SHOULD

- [ ] Pre-upload one RAG document (offer rules, SOP, mentor script).
- [ ] Ask a question **only** answerable from that doc.
- [ ] Mention workspace isolation.

**Contrast line:** *"Custom GPTs are personal; this is team knowledge in the tenant."*

### Beat 6: Persona hook (2 min) - PICK ONE

**Operator / landlord:** compliance item - *"What's missing before this certificate expires?"*

**Operator:** journal context - *"Explain this entry for my accountant."*

**Academy:** mentorship or course - *"What should I cover next session for this mentee?"*

### Beat 7: Comms (1 min) - OPTIONAL

Only if Communications Hub is enabled:

- [ ] *"Enrol this contact in the post-viewing sequence."*
- [ ] Show confirmation before send.

---

## What NOT to demo

| Avoid | Why |
|-------|-----|
| Blank Carina with *"What is BRR?"* | ChatGPT wins; no moat |
| Long generic property education | Same |
| Leading with provider names (Claude, GPT) | Commodity framing |
| Tavily / web search as the hero | Sounds like ChatGPT browsing |
| Voice as the hero | Feature parity |
| Platform admin Carina / SCOUT | Wrong buyer unless platform ops |
| Unrehearsed tenant with no deals | Tool failures kill trust |

---

## Demo emphasis by persona

| Persona | Emphasize beats | De-emphasize |
|---------|-----------------|--------------|
| Deal sourcer | 1, 2, 3, 4 | Academy tools |
| Portfolio operator | 1, 6 (compliance or P&L), 5 | Mentorship |
| Mentor / Academy | 1 (mentorship), 6, academy tools | Heavy pipeline |
| Agency / multi-seat | 5, confirmations, rate limits | Generic Q&A |

---

## Objection handlers

| Objection | Response | Show |
|-----------|----------|------|
| "We already have ChatGPT." | Keep it for research; use Carina where deals and CRM live. | Beats 1 + 3 |
| "It's just a chatbot." | It writes to pipeline and vault. | Beats 3 + 4 |
| "AI hallucinates numbers." | Calculators and saved analysis use your engines. | Beat 2 + deal analysis |
| "Data leaves our business." | Tenant RAG, isolation, BYOK, audit events. | Beat 5 + governance rows |
| "Not worth the money." | One avoided bad deal or one deal pack pays for the year. | Beat 4 |
| "Another tool to learn." | Corner widget on screens they already use. | Beat 1 from deal page |

---

## When to concede ChatGPT is fine

Say so honestly when:

- They are learning strategy with **no deals** in the system yet.
- One-off writing tone, non-UK market, or non-property work.
- They only need generic chat and will not enable Agent (still sell RAG + context if they use the MIS).

---

## Close scorecard (prospect saw it live)

| # | Proof Carina is not "ChatGPT in a sidebar" | Yes |
|---|------------------------------------------|-----|
| 1 | Answered about **their** deal without paste | |
| 2 | Ran or refreshed **real calculator** output | |
| 3 | Changed **CRM or pipeline** (or confirmation ready) | |
| 4 | Created **deal pack or document** in vault | |
| 5 | Answered from **their uploaded** RAG doc | |
| 6 | Named one task they will do in Carina next week | |

**4+ Yes** = strong fit. **2 or fewer** = fix onboarding or plan tier before pushing Carina.

---

## 30-second elevator script

> "I'll open a deal you're already working on. Carina already sees the analysis. I'll stress refurb costs using **our** BRR engine, add a pipeline follow-up, and generate a **deal pack into your document vault**. ChatGPT can't see your board or write to your CRM. That's the difference."

---

## Internal prep (before the call)

- [ ] Demo tenant has at least one **BRR or R2R deal** with saved analysis
- [ ] Demo user has **`carina_agent`** (Operator or Academy, or flags forced on in staging)
- [ ] **One RAG document** uploaded and indexed
- [ ] Optional: comms sequence exists (Beat 7)
- [ ] Logged in; Carina widget visible on deal page
- [ ] Backup deal ID if a live tool fails

---

## Related docs

| Doc | Use |
|-----|-----|
| `brain/knowledge/08-carina.md` | Architecture, routes, rate limits |
| `brain/knowledge/125-subscriptions-billing.md` | Plans and modules |
| `docs/PROPCALC_COMPETITOR_BENCHMARK.md` | Calculator differentiation vs PropertyData, PaTMa, etc. |

---

*Maintainers: update this file when agent tools or `context_type` list changes; cross-check `app/Services/Carina/Tools/` and `CarinaService` context builders.*
