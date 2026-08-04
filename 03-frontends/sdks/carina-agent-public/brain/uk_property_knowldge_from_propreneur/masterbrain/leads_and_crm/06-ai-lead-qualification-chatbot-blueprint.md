# AI Lead Qualification Chatbot Blueprint

**Status:** Feature blueprint
**Source:** PropSource masterclass analysis + Carina AI capabilities
**Related:** Carina (`08-carina.md`, `28-carina-2-build-audit.md`), viCal (`31-vcal-booking-module.md`), CRM (`05-crm.md`)

---

## 1. Purpose

An AI chatbot powered by Carina that qualifies property leads (sellers, landlords, investors, mentees) before routing them to human follow-up or viCal booking.

---

## 2. Conversation Flow

### Step 1: Welcome & Intent Capture
```
AI: "Hi there! Thanks for reaching out. To help you best, could you tell me what brings you here today?
     Are you looking to:
     1. Sell a property
     2. Find investment opportunities
     3. Join a mentorship program
     4. Something else"
```

### Step 2: Branch by Intent

**For Sellers:**
```
AI: "Great. A few quick questions:
     - Is your property currently on the market?
     - What's the approximate condition? (move-in ready / needs some work / full refurb)
     - Are you flexible on price for a quick sale?
     - What's your timeline? (within 3 months / 3-6 months / no rush)
     - What's the main reason for selling?"
```

**For Investors:**
```
AI: "Great. To match you with the right opportunities:
     - How much capital do you have to invest? (ballpark figure)
     - What strategy interests you most? (BTL / HMO / BRR / Flipping / Rent-to-Rent)
     - What's your target ROI?
     - Are you looking for cash flow, capital growth, or both?
     - What's your investment timeline?"
```

**For Mentees (Salim's use case):**
```
AI: "Thanks for your interest in our mentorship program.
     - Have you invested in property before?
     - What is your main goal? (financial freedom / portfolio growth / learn the ropes)
     - How much time can you dedicate per week?
     - What's your budget for a mentorship program?
     - What specific challenges are you facing?"
```

### Step 3: Scoring & Routing

Based on answers, the AI calculates a lead score and routes:

| Score | Action | 
|-------|--------|
| 80-100 | Auto-book discovery call via viCal. Send confirmation + prep email. |
| 50-79 | Flag for manual human review. Send nurture sequence in meantime. |
| 0-49 | Soft disqualification. Send "not the right fit" message, keep in database. |

### Step 4: Handoff to Human

When booking is made, the human receives a summary card:
- Lead type, score, answers to all questions
- Suggested talking points
- Relevant resources/case studies

---

## 3. Data Model

```
ai_qualification_conversations
- id
- tenant_id
- contact_id (nullable, created after qualification)
- conversation_type (seller | investor | landlord | mentee)
- status (in_progress | completed | disqualified | booked)
- answers (jsonb -- all question/answer pairs)
- score (integer, 0-100)
- disqualified_at (timestamp, nullable)
- booked_at (timestamp, nullable)
- carina_conversation_id (link to Carina message log)
- created_at, updated_at
```

---

## 4. Integration Points

| System | Integration |
|--------|-------------|
| Carina AI | Powers the conversation (multi-provider BYOK) |
| CRM | Creates/updates Contact record with qualification data |
| viCal | Books appointment when score threshold met |
| Comms Hub | Sends confirmation, prep materials, nurture sequences |
| Pipeline | Creates lead record in appropriate pipeline bucket |
| Reporting | Tracks qualification funnel metrics |

---

## 5. Feature Flag

`ai_lead_qualification` -- gates the qualification chatbot and all associated flows
