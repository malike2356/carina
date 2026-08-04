# AI Lead Qualifier Chatbot

**Status:** Planned - not yet built
**Feature flag:** `ai_lead_qualification`
**Priority:** Medium (product differentiator for Propreneur vs generic CRMs)
**Dependencies:** Carina AI (built), viCal (built), Lead Funnel module (built), Comms Hub (built)

---

## What This Feature Does

A public-facing AI chatbot powered by Carina that lives on a landing page (or embedded widget). When a lead clicks an ad and lands on the page, the chatbot:

1. Greets them and starts a natural conversation
2. Asks structured qualifying questions
3. Disqualifies time-wasters automatically
4. Books a calendar slot via viCal for serious leads
5. Runs 24/7 without human intervention

This is exactly what Azu (SourcingWithAzu/PropSource) sells as a standalone product. Propreneur can offer it as a built-in feature across all tenant types (sourcing, mentoring, deals).

---

## Target Audiences & Qualification Flows

### 1. Property Sourcers (deal finders)
- "Are you selling a property?" → condition, price expectation, timeline
- "Are you investing?" → budget, strategies, timeline
- "Are you a landlord?" → property type, location, pain points
- Auto-disqualify if criteria not met (e.g., unrealistic price expectations)
- Route qualified leads to deal pipeline + viCal booking

### 2. Mentors (e.g., Salim's mentoring business)
- "What is your main objective?" (dropdown)
- "Have you invested before?" (yes/no, which strategies)
- "What is your main goal?" (financial freedom, portfolio growth, etc.)
- "What resources do you have?" (time, money)
- "What are your specific challenges?"
- Auto-disqualify if criteria not met
- Route qualified mentees to viCal discovery call

### 3. Investors (cash-rich, time-poor)
- "What is your investment budget?"
- "What ROI are you targeting?"
- "What strategies interest you?"
- "What's your timeline?"
- Route to investor portal + deal matching + viCal booking

---

## Technical Implementation

### New service: `AiLeadQualifier`
- Path: `app/Services/Carina/AiLeadQualifier.php`
- Extends existing Carina service layer (multi-provider BYOK, RAG)
- Owns qualification logic, conversation flow templates, disqualification rules

### Components needed

| Component | What it does | Status |
|-----------|-------------|--------|
| **Chatbot widget** | Embeddable JS widget for landing pages | New build |
| **Carina qualification prompt** | System prompt defining conversation flow & criteria | New build |
| **Qualification flow templates** | Per-tenant configurable question sets (JSON/DB) | New build |
| **viCal booking endpoint** | Auto-schedules call after qualification | Already built |
| **Lead funnel integration** | Stores qualification answers against CRM contact | Already built |
| **Comms hub trigger** | Speed-to-lead auto-response after qualification | Already built |
| **Disqualification rules** | Configurable criteria per tenant type | New build |
| **Analytics dashboard** | Qualification rates, conversion funnel, drop-off points | New build |

### Architecture

```
Social ad (Meta/LinkedIn/TikTok)
  └→ Landing page with Carina chatbot widget
       └→ Chatbot greets lead
            ├── Lead answers questions
            │    ├── Meets criteria → viCal booking triggered
            │    └── Fails criteria → polite disqualification + email nurture sequence
            └── Lead abandons → follow-up via Comms Hub (email/SMS/WhatsApp)
```

### Database changes
- `lead_qualification_flows` table: per-tenant qualification templates
- `lead_qualification_responses` table: individual lead answers stored against CRM contact
- `disqualification_rules` table: configurable criteria

### Carina integration
- Carina drives the conversation using a dedicated qualification system prompt
- Uses RAG for context-aware follow-ups (e.g., "You mentioned you're interested in HMOs - here's what we can help with")
- Multi-provider BYOK: tenant uses their own AI provider key
- Streaming responses for natural conversational feel

---

## Implementation Order

1. Create `AiLeadQualifier` service class
2. Build qualification flow templates (DB + CRUD)
3. Configure Carina system prompt for qualification mode
4. Build embeddable chatbot widget (JS snippet)
5. Connect to viCal booking endpoint
6. Connect to Comms Hub for follow-up sequences
7. Store qualification responses in CRM
8. Build disqualification rules engine
9. Analytics dashboard

---

## Why Build This

- **Direct competitor analysis:** Azu/PropSource charges $1,000+ for this as a standalone tool. Propreneur offers the same as a built-in feature.
- **Speed-to-lead:** Responding within 1 minute increases sales by 400%. After 5 minutes, qualification drops by 80%. An AI chatbot responds instantly.
- **24/7 operation:** One client booked a call at 1AM, closed the deal the next day.
- **Product differentiation:** No other property OS has an embedded AI lead qualification chatbot.
- **All infrastructure exists:** Carina AI, Lead Funnel module, viCal, Comms Hub - only the chatbot widget and qualification logic layer need building.

---

## Related Docs

- `108-lead-funnel-module.md` - Ad ingestion, lead scoring, CRM sync
- `08-carina.md` - Carina AI architecture
- `141-vcal-external-calendar-sync.md` - Calendar booking
- `121-comms-engagement.md` - Communication sequences
