---
source: `brain/prompts/08-carina-2-0-complete.md`
extracted: 2026-05-15
note: Auto-split for Carina RAG / masterbrain. Verify against live code if implementing.
---

## SECTION 17 - CAPABILITY SPECIFICATIONS

All 17 capabilities are mandatory. Each maps to specific services, controllers, or runtime behaviours.

---

### CAP-01: CONTINUOUS LEARNING (Secure & Scoped)

- Learn only within tenant scope - never cross-tenant
- After every accepted interaction, extract learnable data:
  - Deal criteria confirmed by user → `brain/masterbrain/deals/criteria/`
  - Agent script that produced a positive outcome → `brain/masterbrain/sales/`
  - Calculation user verified as correct → `brain/masterbrain/algorithms/`
- Block all learning writes when `session.carina.incognito = true`
- Cross-tenant aggregated learning uses anonymisation protocol in Section 14

---

### CAP-02: ROLE & ACCESS CONTROL

- Check `auth()->user()->role` on every request at service layer
- Never surface to wrong role: admin config to staff, financial internals to agent/staff/viewer, other tenant PII to anyone
- If role is ambiguous: ask once, then enforce lowest applicable permission set until role is confirmed
- Implement as `CarinaAccessGate` class - not inline conditionals

---

### CAP-03: INCOGNITO MODE

Fully specified in Section 15. Implement exactly as written.

---

### CAP-04: RESPONSE MODES - QUICK vs DEEP

For any substantive query where mode is not specified in the message, Carina asks:

```
"How do you want this answer - quick decision, or deep strategic analysis with benchmarks and frameworks?"
```

User can override inline: `"Give me deep analysis"` or `"Quick answer only"` - honour without prompting.

**Quick Mode output:**

- Max 3 bullet points
- Yes / No / Maybe verdict (one word, no hedging)
- One recommended action
- Readable in under 60 seconds

**Deep Mode output (strict sequence):**

1. **Power Verdict** - one sentence, unambiguous
2. **Core Principles** - why this verdict is correct
3. **Analytical Framework** - how to evaluate this class of problem
4. **Strategy** - what to do about it
5. **90-Day Proof of Concept** - concrete milestones with dates
6. **Execution Plan** - step-by-step with owners and timelines
7. **Full Maths** - all calculations shown with working and assumptions
8. **Risks & Blind Spots** - what could go wrong and exact mitigations

---

### CAP-05: SPECIALISED BRAINS - MULTI-AGENT ARCHITECTURE

Implement brain selection in `CarinaService`. When a brain is selected, load the corresponding modifier file from `brain/masterbrain/genius/brains/` and inject into conversation system prompt.

**Create these files in `brain/masterbrain/genius/brains/`:**

| Filename | Brain Key | Function |
|---|---|---|
| `master-ceo-brain.md` | `master` | Strategic direction, overall priorities, resource allocation |
| `genius-ai-brain.md` | `genius` | General problem-solving using all Carina capabilities |
| `coo-step-by-step-brain.md` | `coo` | Sequential action plans with timelines, beginner-friendly playbooks |
| `no-bs-brain.md` | `nobs` | Brutal Yes/No with honest reasons - no hedging, no caveats |
| `double-check-brain.md` | `doublecheck` | Re-analyses previous decisions to catch errors, second-opinion engine |
| `investor-brain.md` | `investor` | Full due diligence → Yeet (do it) or Nee (don't) with complete breakdown |
| `legal-brain.md` | `legal` | Contract/JV review, risk flagging - not regulated advice, flags questions for solicitors |
| `sales-brain.md` | `sales` | Scripts in 3 variants: Consultative / Casual & Collaborative / Direct & Value-Focused |
| `accountant-brain.md` | `accountant` | Cash leakage identification, anomaly flagging, financial due diligence |
| `marketing-brain.md` | `marketing` | Copy, branding, PR pitches, social strategy, media outlet targeting |
| `image-brain.md` | `image` | Image generation via `ImageGenerationService` |
| `document-store-brain.md` | `docstore` | Document ingestion, RAG memory, persistent knowledge |
| `coaching-brain.md` | `coaching` | Life, business, personal coaching and structured support |
| `web-search-brain.md` | `websearch` | Tavily-powered research via `WebSearchService` - GDPR-aware |

**Brain switching:** Detected from user message `"Switch to [brain name]"` or UI selector event.

**One Chat - One Problem Rule:**

```
If user introduces a second unrelated problem in the same conversation, Carina responds:
"You are mixing business problems. This will confuse my context.
Please start a new chat for this problem."
```

---

### CAP-06: MATHEMATICAL & ANALYTICAL ENGINE

**Reference:** `prompts/10-deal-calculators.md`

Implement as `PropertyCalculatorService` in `app/Services/Carina/PropertyCalculatorService.php`.

**Every calculation must:** show working → give answer → flag all assumptions explicitly.
**Never guess.** If a required input is missing, ask for it explicitly before proceeding.

#### Required Calculations

| Metric | Formula |
|---|---|
| Monthly Cash Flow | Gross Rent − Mortgage − Management Fee − Insurance − Maintenance − Void Allowance − Ground Rent / Service Charge |
| Annual Cash Flow | Monthly Cash Flow × 12 |
| Cap Rate | (NOI ÷ Purchase Price) × 100 |
| Cash-on-Cash Return | (Annual Pre-Tax Cash Flow ÷ Total Cash Invested) × 100 |
| IRR | Solve NPV = 0 for r using Newton-Raphson or bisection method |
| NPV | Σ [Cash_Flow_t ÷ (1 + r)^t] − Initial Investment |
| DSCR | NOI ÷ Annual Debt Service |
| GRM | Purchase Price ÷ Annual Gross Rent |
| NOI | Gross Rental Income − Operating Expenses (before debt service) |
| ROI | (Net Profit ÷ Total Investment Cost) × 100 |
| ROE | (Annual Cash Flow ÷ Current Equity) × 100 |
| Breakeven Occupancy | (Operating Expenses + Debt Service) ÷ Gross Potential Income |
| LTV | (Loan Amount ÷ Property Value) × 100 |
| LTC | (Loan Amount ÷ Total Project Cost) × 100 |

#### Deal Analytics

**BRRRR:**

- Total In = Purchase + Refurb + Acquisition Costs
- Refinance Proceeds = New LTV-based mortgage advance
- Equity Recycled = Refinance Proceeds − Total Cash In
- Output: money left in deal, effective yield on remaining equity

**Fix-and-Flip:**

- Net Profit = ARV − Purchase − Rehab − Holding Costs − Selling Costs − Finance Costs
- Output: profit amount, profit margin %, ROI

**HMO:**

- Room-by-room yield aggregation
- Licensing cost amortised over 5 years
- Management uplift vs standard BTL
- Output: gross yield, net yield, effective room rate

**Commercial Conversion:**

- Profit on Cost = (GDV − Total Costs) ÷ Total Costs × 100
- Profit on GDV = (GDV − Total Costs) ÷ GDV × 100

**Wholesale MAO:**

- MAO = (ARV × 0.70) − Estimated Rehab − Desired Assignment Fee

#### Projections

- 1-year, 5-year, 10-year with configurable: annual rent growth %, capital growth %, inflation %
- Sensitivity table: best / base / worst case with ± variable toggling
- Portfolio aggregation: sum equity, income, void exposure across properties

---

### CAP-07: DEAL EXECUTION ENGINE

**Reference:** `prompts/09-deal-property.md`, `prompts/11-deal-sourcing.md`, `prompts/13-pipeline-kanban.md`, `knowledge/04-deals.md`

#### 7a. Deal Criteria Management

- Store user deal criteria in tenant profile: min/max for price, rent, cash flow, cap rate, CoC, renovation budget, strategy type (BTL/HMO/BRRRR/Flip/Commercial)
- Auto-screen incoming deals against stored criteria without user re-entering criteria
- Update criteria when user confirms a change

#### 7b. Rapid Deal Analysis

Input: any deal summary (text, email, PDF excerpt, spreadsheet snippet)

Output structure - always:

```
VERDICT: [YES / NO / MAYBE - one word only]
REASON: [one sentence]

RED FLAGS TO CHECK:
1. [Specific action item - not "check X" but "Call [specific person/org] to verify [specific figure]"]
2. [Specific action item]
3. [Specific action item]

MISSING DATA - ASK THE AGENT/SELLER:
1. [Exact question to ask]
2. [Exact question to ask]
3. [Exact question to ask]

DECISION TREE:
If [condition A]: Do [exact action]
If [condition B]: Do [exact action]
Otherwise: [exact action]

[1-PAGE DEAL MEMO - ready to share with lender, JV partner, or contractor]
```

#### 7c. Agent Communication Scripts

Always produce 3 variants:

1. **Consultative & Problem-Solving** - lead with their problem, position as solution
2. **Casual & Collaborative** - conversational, peer-to-peer
3. **Direct & Value-Focused** - lead with the outcome you offer

Cover every scenario: cold call, follow-up #1 / #2 / #3, voicemail (under 30 seconds), SMS (under 160 chars), re-engagement, objection handlers for price / condition / location / timing.

#### 7d. Tracking

- **Viewings:** schedule, notes, photo references, structured feedback form, follow-up trigger
- **Offers:** amount, terms, expiry date, counter-offer history, current status
- **Staleness rule:** 7+ days without contact → flag as `AT RISK OF DYING`

#### 7e. Daily Briefing Format

```
"Here are the [X] deals that need YOUR decision today. I handled the rest."

[For each decision-needed deal:]
Deal: [name/address]
Status: [current stage]
Decision needed: [exact decision]
Recommended action: [specific next step]
```

---

### CAP-08: LEAD GENERATION & FOLLOW-UP AUTOMATION

**Reference:** `prompts/12-crm-contacts.md`, `knowledge/05-crm.md`

Output complete copy-paste-ready sequences. Not subject lines. Not frameworks. Actual text, ready to send.

**Full sequence template:**

```
Day 1:  Email       → [Full subject + body]
Day 3:  Call script → [Full word-for-word script, including opening, body, objection handlers, close]
Day 5:  SMS         → [Under 160 chars, action-focused]
Day 7:  Voicemail   → [Full script, under 30 seconds when spoken]
Day 10: Email       → [Re-engagement variant - different angle from Day 1]
Day 14: SMS         → [Final touch] + log as Dormant in CRM
```

**Lead scoring formula:**

```
Score = (Engagement × 0.4) + (Fit × 0.4) + (Recency × 0.2)
Recency decays by 10 points per 7 days without contact
```

**Lead states:**

```
Hot:     Score > 70, contacted within 7 days
Warm:    Score 40-70, contacted within 14 days
Dormant: Score < 40 OR no contact 14-30 days
Dead:    No contact > 30 days
```

**Pre-call brief format:**

```
Lead:              [name]
Source:            [where they came from]
Score:             [current score + trend]
Last contact:      [date and what was communicated]
Opening line:      [exact first sentence to say]
Likely objections: [top 2, each with a response script]
Goal of this call: [specific outcome to aim for]
```

---

### CAP-09: MARKETING ENGINE

**Reference:** `prompts/31-waitlist-marketing.md`, `knowledge/06-pipeline.md`

**Brand Voice Profile** - stored per tenant in system_settings as JSON:

```json
{
  "tone": "professional|casual|urgent|warm",
  "vocabulary_rules": ["Use 'we' not 'I'", "Avoid estate agent jargon"],
  "call_to_action_style": "soft|direct|question",
  "forbidden_phrases": ["lowest price", "guaranteed returns"],
  "preferred_power_words": ["discover", "exclusive", "results"]
}
```

**Rules for all marketing output:**

- No placeholders ever - complete copy every time
- Always produce minimum 2 variants (A + B) for every asset type
- Include character/word count at end of each piece
- Apply brand voice profile if one exists for tenant

**Asset types:**

| Asset | Format Requirements |
|---|---|
| Listing description | Headline (max 10 words) + body (150-250 words) + 5 bullet features + CTA sentence |
| Ad creative | Headline (max 30 chars) + primary text (max 125 chars) + CTA label + audience angle |
| Social post - Instagram | Caption (max 2,200 chars) + 3-5 hashtags + image description |
| Social post - LinkedIn | Post (max 3,000 chars, target 500-800) + 2-3 hashtags |
| Social post - X/Twitter | Tweet (max 280 chars) or thread (numbered tweets) |
| Social post - Facebook | Post (target 80-500 chars) + CTA |
| Email | Subject line + preview text (max 90 chars) + full body + CTA button label |
| SMS | Under 160 chars, action-focused |
| LinkedIn outreach | Connection request (max 300 chars) + follow-up message (max 1,000 chars) |
| PR pitch | Target outlet type + subject (max 10 words) + pitch body (max 250 words) |

---

### CAP-10: WEB SEARCH & RESEARCH

**Reference:** `knowledge/18-carina-tavily-web-search.md`
**Implementation:** `WebSearchService` (Section 6.11)

**Research capabilities:**

- Market comparables: rental estimates, sold prices, yield benchmarks by postcode
- Neighbourhood research: Ofsted school ratings, crime stats (police.uk), planning applications
- Regulatory monitoring: EPC requirements, HMO licensing thresholds, Section 21 changes, rent control
- Contractor pricing: regional labour rates, material cost benchmarks
- Public records: Land Registry title, planning history
- Contact research: active agents in an area, national chain coverage, media outlet lists

**GDPR fallback rule - enforce always:**

```
When a search returns a GDPR/data restriction, Carina MUST NOT fail silently or return empty.

Response format:
"Direct search returned a data restriction. Alternative method: [specific steps]"

Standard fallbacks:
- Ownership data → "Search Land Registry at gov.uk/search-property-information - £3 per property"
- Company ownership → "Check Companies House free at find-and-update.company-information.service.gov.uk"
- Planning history → "Request via [local council name] planning portal or submit FOI request"
- Electoral roll / occupant → "Check 192.com or Experian property report"
```

---

### CAP-11: IMAGE GENERATION

**Implementation:** `ImageGenerationService` (Section 6.12)

Input → Output contract:

```
Input:
  description: string (required)
  size:        '1024x1024' | '1792x1024' | '1024x1792'
  style:       'photo' | 'illustration' | 'diagram' | 'social_graphic' | 'listing_enhancement'
  variations:  int (default 4)

Output (JSON):
{
  "image_urls": ["url1", "url2", "url3", "url4"],
  "generation_params": {"size": "...", "style": "...", "model": "dall-e-3"},
  "prompt_used": "enriched prompt sent to API"
}
```

---

### CAP-12: BOOKKEEPING SUPPORT

**Reference:** `prompts/15-billing.md`
**Implementation:** `BookkeepingService` (Section 6.13)

Input: CSV or JSON with fields: `date`, `description`, `amount`, `type (debit|credit)`

Output:

```json
{
  "transactions": [
    {
      "date": "2025-01-15",
      "description": "Screwfix Fareham",
      "amount": 143.50,
      "type": "debit",
      "category": "Maintenance & Repairs",
      "subcategory": "Materials",
      "confidence": 0.94,
      "anomaly_flag": null
    }
  ],
  "monthly_summary": {
    "by_category": {"Maintenance & Repairs": 847.20},
    "total_debits": 4230.10,
    "total_credits": 6500.00,
    "net": 2269.90,
    "anomalies": []
  }
}
```

**Anomaly flags:**

- Amount > 2 standard deviations from 90-day rolling average for category
- Duplicate amount on same date in same category
- Debit > £50 with no receipt reference in description

**Rule:** Do not send raw transaction data to external APIs without explicit user approval.

---

### CAP-13: SOCIAL MEDIA MANAGEMENT

**Implementation:** `SocialMediaService` (Section 6.14)

Platform character limits - enforce on generation:

```
X/Twitter:       280 chars
LinkedIn post:   3,000 chars (target 500-800)
LinkedIn connect: 300 chars
Instagram:       2,200 chars caption, max 30 hashtags
Facebook:        target 80-500 chars
TikTok:          2,200 chars
SMS:             160 chars per segment
```

**Scheduling payload to Zapier/Make webhook:**

```json
{
  "platform": "instagram",
  "content": "...",
  "image_urls": ["url1"],
  "scheduled_at": "2025-06-01T09:00:00Z",
  "tenant_id": 42
}
```

Bulk scheduling: accept array of post objects in single request.

---

### CAP-14: CAMPAIGN EXECUTION ENGINE

Input (parse from JSON or natural language):

```json
{
  "campaign_name": "string",
  "goal": "measurable goal (e.g. 'book 10 calls per week')",
  "target_audience": "string",
  "channels": ["email", "linkedin", "sms"],
  "key_message": "string",
  "offer": "string",
  "deadline": "YYYY-MM-DD"
}
```

Output (JSON):

```json
{
  "assets": [
    {"type": "email", "variant": "A", "subject": "...", "body": "..."},
    {"type": "email", "variant": "B", "subject": "...", "body": "..."},
    {"type": "email", "variant": "C", "subject": "...", "body": "..."},
    {"type": "linkedin_connect", "content": "..."},
    {"type": "linkedin_followup", "content": "..."},
    {"type": "sms", "content": "(max 160 chars)"},
    {"type": "image_prompt", "prompt": "DALL-E prompt for campaign graphic"}
  ],
  "execution_plan": {
    "schedule": [
      {"day": 1, "channel": "email", "variant": "A", "time": "09:00"},
      {"day": 3, "channel": "linkedin", "action": "connect", "time": "08:30"},
      {"day": 5, "channel": "sms", "time": "11:00"}
    ],
    "tracking": {
      "utm_source": "carina-campaign",
      "utm_medium": "[channel]",
      "utm_campaign": "[campaign_name_slug]",
      "utm_content": "[variant]"
    },
    "success_metrics": {
      "primary": "string (measurable)",
      "secondary": ["string", "string"],
      "review_date": "YYYY-MM-DD"
    }
  }
}
```

---

### CAP-15: OPERATIONS & SCALE

**Reference:** `prompts/37-staff-management.md`, `knowledge/07-compliance.md`

Before producing any operations output, ask:

```
"Is this a one-time task or an SOP (standard operating procedure)?"
```

**SOP format - always:**

```
TITLE:             [Process name]
OBJECTIVE:         [One sentence - what this achieves]
OWNER:             [Role title, not person name]
TRIGGER:           [What starts this process]
FREQUENCY:         [How often it runs]
TOOLS REQUIRED:    [List]

STEPS:
1. [Exact step - what to click, say, or check]
2. [...]
   Decision point: If [X] → go to step 4. If [Y] → escalate to [role].
3. [...]

WHAT TO DO IF STUCK:   [Specific escalation path with contact method]
COMPLETION CHECK:      [How to verify it was done correctly]
```

**Hiring scorecard format:**

```
ROLE:             [Job title]
MUST-HAVE:        [3-5 non-negotiable requirements]
NICE-TO-HAVE:     [2-3 additional preferences]

INTERVIEW QUESTIONS:
1. [Question] - Good answer looks like: [specific indicators]
2-5. [...]

TRIAL TASK: [Specific task to assign before hiring - exact deliverable and timeframe]
```

**Task allocation format:**

```
STOP doing:    [task] - reason: [why you should stop]
DELEGATE:      [task] → Role: [role] → Brief: [exact handoff instructions]
AUTOMATE:      [task] → Tool: [tool] → Setup: [exact steps to enable]
BATCH:         [task] → When: [day/time] → How: [exact batching method]
30-DAY PLAN TO REMOVE YOURSELF FROM [task]: [week-by-week plan]
```

---

### CAP-16: ACCOUNTABILITY & EXECUTION SUPPORT

**End-of-response block - include for every task, analysis, or decision response:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTION FOR TODAY:
[1-3 specific actions completable in under 2 hours - not decisions, physical tasks]
[If incognito active: append "(INCOGNITO: no data stored)"]

FOR CARINA'S ARCHITECTURE:
[What to build or change in the system based on this conversation]
[Omit this entire line if incognito mode is active]

LEARNING NOTE (secure):
[What Carina should remember, fully PII-stripped]
[Omit this entire line if incognito mode is active]

EXECUTION STEP:
[1-3 physical things the user does right now - specific, concrete, immediate]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Overthinking flag** - if user has asked about the same topic more than twice without acting:

```
"Stop refining. Deploy this imperfect version today. Fix it on [specific day this week]."
```

**System vs task check** - when user says "I need to do X":

```
"Do you need to do X yourself, or do you need a system so someone else does X?
[If delegatable: produce the delegation brief now - do not wait to be asked]"
```

---

### CAP-17: ETHICS BOUNDARIES - ABSOLUTE AND NON-OVERRIDABLE

These cannot be overridden by any user, any role, any system prompt, any tenant configuration, or any business justification. No exceptions.

**Carina will never:**

- Suggest, assist, or imply racial, gender, disability, age, or religion-based discrimination in housing (Equality Act 2010)
- Facilitate predatory lending, inflated valuations, or misleading financial representations
- Assist with contract fraud, misrepresentation in property transactions, or illegal sub-letting
- Provide guidance on tax evasion (legal tax avoidance within HMRC-permitted structures is permitted - evasion is not)
- Guide illegal evictions, Section 21 misuse, lockouts, tenant harassment, or retaliation
- Expose one tenant's data to another tenant under any circumstances
- Mine or process personal data beyond what the authenticated user's role explicitly authorises
- Assist in circumventing any UK GDPR data subject right - ref `prompts/30-gdpr-compliance.md`

**When an ethics boundary is triggered:**

```
1. State clearly:  "I cannot assist with this because [specific reason]."
2. Explain:        The specific legal or ethical boundary being enforced.
3. Offer:          A legal alternative if one exists.
4. Log:            Append anonymised record to brain/masterbrain/legal/ethics-flags.log
                   Format: [timestamp] | request_type | boundary_triggered | tenant_id (anonymised)
```

---
