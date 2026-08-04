# Speed-to-Lead Engine

**Status:** Reference knowledge
**Source:** PropSource masterclass (4 May 2026) citing Vanadasa.com, Podium.com, Chiliper.com studies
**Related:** Communications Hub (`31-comms-and-engagement-engine.md`), CRM (`05-crm.md`), viCal (`31-vcal-booking-module.md`)

---

## 1. The Data (Why Speed Matters)

| Statistic | Source | Implication |
|-----------|--------|-------------|
| Response within 1 minute = +400% conversion | Vanadasa.com | Every second counts |
| After 5 minutes, qualification drops by 80% | Vanadasa.com | Speed is a disqualifier |
| 90% of consumers expect response within 1 hour | Podium.com | Baseline expectation |
| Only 37% of companies achieve <1 hour response | Podium.com | Most competitors are slow |
| 50% of leads work with whoever contacts them first | Chiliper.com | First-mover advantage |
| 55% of companies take >5 days to respond | Industry data | Almost no real competition on speed |

---

## 2. The Speed-to-Lead Automation Pipeline

### Tier 1: Instant (0-60 seconds) -- Automated Only
Triggered by: New form submission, new CRM contact, new booking inquiry

**Actions:**
1. Send instant confirmation email with next steps
2. Send WhatsApp/SMS (if number available): "Thanks for your interest. We've received your details and will be in touch shortly."
3. Create CRM task for human follow-up (priority: high)
4. Log the response time for analytics

### Tier 2: Fast (1-5 minutes) -- Human + AI
Triggered by: Lead score above threshold, qualified lead

**Actions:**
1. AI drafts personalised intro message based on qualification answers
2. Human reviews and sends (or AI sends with approval)
3. Suggest available time slots from viCal calendar
4. Send relevant case study or resource

### Tier 3: Standard (5-60 minutes) -- Nurture
Triggered by: Medium-scored leads, unanswered first contact

**Actions:**
1. Send branded nurture sequence (email + SMS)
2. Add lead to drip campaign
3. Re-score after 24 hours if engagement detected

### Tier 4: Long-tail (>1 hour) -- Recovery
Triggered by: Unengaged leads after 24 hours

**Actions:**
1. Send "Did we lose you?" re-engagement message
2. Move to long-term nurture (weekly tips, market updates)
3. Reduce priority score

---

## 3. Technical Implementation

### Data Model
```
speed_to_lead_rules
- id
- tenant_id
- trigger_event (new_lead | form_submission | booking_request | deal_submission)
- tier (instant | fast | standard | long_tail)
- channels (json: ["email", "sms", "whatsapp"])
- template_id (references comms templates)
- delay_seconds
- is_active
- sort_order
```

### Trigger Points in Propreneur
- New contact created in CRM
- New deal submitted in Pipeline
- New booking requested in viCal
- New mentorship application
- New investor inquiry
- New lead from public-facing forms

### Service Layer
```
app/Services/SpeedToLead/
  SpeedToLeadService.php          -- Orchestrator
  InstantResponder.php            -- Tier 1 handler
  FastResponder.php               -- Tier 2 handler (uses Carina)
  StandardNurture.php             -- Tier 3 handler
  RecoveryCampaign.php            -- Tier 4 handler
  ResponseTimeTracker.php         -- Analytics and reporting
```

---

## 4. Sample Templates

### Instant Response (Tier 1) -- Email
Subject: Thanks for reaching out

"Hi {first_name},

Thanks for your interest in {service_name}. We've received your details and a member of our team will review them shortly.

In the meantime, feel free to browse our resources at {link}.

Best regards,
{team_name}"

### Fast Response (Tier 2) -- WhatsApp/SMS
"Hi {first_name}, {team_member} here from {company}. Saw your inquiry about {service}. Would you be free for a quick 15-minute chat this week? Here's my calendar link: {vical_link}"

### Standard Nurture (Tier 3) -- Email Sequence
Day 1: Introduction + value proposition
Day 3: Case study / social proof
Day 7: FAQ / objection handling
Day 14: Limited-time offer / call to action

---

## 5. Key Metrics

- Median response time (target: < 60 seconds)
- Lead-to-connect rate (target: > 60%)
- Lead-to-appointment rate (target: > 25%)
- Time-to-first-contact distribution
- Channel performance (email vs SMS vs WhatsApp vs phone)

---

## 6. Propreneur Feature Flag

`speed_to_lead` -- gates the entire engine
