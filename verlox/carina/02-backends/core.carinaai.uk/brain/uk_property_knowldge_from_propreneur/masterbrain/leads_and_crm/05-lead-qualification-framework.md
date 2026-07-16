# Property Sourcing Lead Qualification Framework

**Status:** Reference knowledge
**Source:** PropSource masterclass (4 May 2026)
**Related:** CRM (`05-crm.md`), Pipeline (`06-pipeline.md`), Carina (`08-carina.md`)

---

## 1. Three Customer Buckets

Every property business needs to acquire and qualify three distinct customer types:

### 1.1 Motivated Seller
Someone who wants to sell their property at a discount or on good terms.

**Qualification questions:**
- Is the property on with an estate agent?
- What is the condition of the property?
- Are you willing to sell at a discount?
- Is the property tenanted or vacant?
- Are you looking to sell in the next 90 days?
- What is your reason for selling? (downsizing, health, financial, emigrating, inherited, divorce, landlord exiting)
- What is your target price and timeframe?

**Disqualifiers:**
- Unrealistic price expectations (insists on full market value)
- Not willing to move within 12 months
- Property has structural issues beyond economic repair (unless specialised buyer)

### 1.2 Tired Landlord
A landlord looking for a better solution than current self-management or agency.

**Qualification questions:**
- How many properties do you own?
- What is your biggest pain point with current management?
- Are you open to rent-to-rent, lease option, or selling?
- What is the condition and location of the properties?
- Are you looking to exit fully or just reduce hassle?

**Disqualifiers:**
- Properties in negative equity
- Unrealistic rent expectations
- Not willing to consider alternative structures

### 1.3 Investor (Three Sub-types)

| Type | Description | Qualification |
|------|-------------|---------------|
| Cash-rich, time-poor (armchair investor) | High income, no time to source | Budget, strategy preference, timeline, risk tolerance |
| JV partner | Brings complementary skill | What they bring, what they need, profit split expectation |
| Angel investor | Looking for better return than bank (3.75%) | Capital available, target ROI, investment horizon |

**Investor qualification questions:**
- How much capital do you have to invest?
- What strategies interest you? (BTL, HMO, BRR, flipping, rent-to-rent, SA)
- What is your target ROI?
- Are you looking for cash flow, capital growth, or both?
- What is your investment timeline? (short-term flip, long-term hold)
- Are you a UK resident/taxpayer?

---

## 2. Lead Scoring Framework

### Score by Response Time
| Time to Response | Conversion Impact |
|-----------------|-------------------|
| < 1 minute | +400% chance of sale |
| < 5 minutes | 80% qualification success rate |
| < 1 hour | 50% qualification success rate |
| > 24 hours | < 10% qualification success rate |

### Score by Lead Quality Indicators
- Property condition (move-in ready vs full refurb)
- Price expectation (market vs below market)
- Motivation level (reason for selling urgency)
- Timeline (immediate vs 6+ months)
- Flexibility (open to creative structures)

---

## 3. Automated Qualification Flow

### Step 1: Initial Capture
Lead lands on landing page / mentor directory / contact form.

### Step 2: AI Chatbot Qualification
AI asks structured questions (see section 1), records answers, scores the lead.

### Step 3: Routing Decision
- **High score:** Auto-book discovery call via viCal, send confirmation + prep materials
- **Medium score:** Flag for manual review, send nurture sequence
- **Low score:** Soft disqualification (send "not the right fit" message, keep in database for future)

### Step 4: Human Follow-Up
For qualified leads, the human receives:
- Lead summary (answers to all questions)
- Suggested talking points for the call
- Relevant case studies or materials
- Deal script tailored to lead type

---

## 4. Key Metrics to Track

- **Cost per lead:** Target ~15/lead (industry benchmark)
- **Lead-to-appointment rate:** % of leads that book a call
- **Appointment-to-deal rate:** % of calls that convert
- **Average sourcing fee:** 3-7k per deal (benchmark)
- **Time from lead to deal:** Average 4-10 weeks for first deal
- **Response time:** Median time to first contact

---

## 5. Propreneur Implementation Notes

- Lead qualification can use Carina AI (multi-provider BYOK) for the chatbot layer
- Qualification answers should be stored on the CRM Contact record
- Scoring can use the existing CRM intelligence / scoring services
- Booking uses viCal endpoints (`/api/vcal/...`)
- Nurture sequences use the Communications Hub
- "AI Lead Qualification" feature flag: `ai_lead_qualification`
