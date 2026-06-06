# Carina Qualification Engine - Lead Filtering with Soft Rejection

**Date:** 7 May 2026  
**Context:** AI-powered lead qualification for mentoring, deal analysis, service bookings, and any flow where Propreneur needs to filter prospects before committing mentor/deal time.

---

## The Concept

A configurable question pool per tenant/programme. Carina evaluates responses against expected answer patterns. Approved contacts proceed. Disqualified contacts are logged with full details - never ghosted, always visible to the tenant.

---

## Question Pool Design

### Question Types

| Type | Example | Carina evaluates by |
|------|---------|-------------------|
| Short answer | "What is your main goal?" | Keyword/sentiment match against expected patterns |
| Multiple choice | "Have you invested before?" | Exact match |
| Number/range | "What's your budget?" | Range check against configured thresholds |
| True/False | "Do you have financing in place?" | Boolean match |

### Bank of Questions (v1)

**Objective & Commitment:**
1. What is the main objective you want to achieve in this meeting?
2. What is your main goal with property investing (e.g., financial freedom, capital growth, passive income)?
3. When do you want to achieve this by?
4. How many hours per week can you dedicate to this?

**Experience & Knowledge:**
5. Have you invested in property before? If yes, what kind of properties or strategies have you used?
6. What strategies are you most curious about?
7. On a scale of 1-10, how would you rate your property knowledge?

**Resources & Readiness:**
8. What resources do you currently have available (e.g., time, money, knowledge)?
9. What's your approximate investment budget?
10. Do you have financing arranged or in progress?
11. Are there any specific challenges you're facing in getting started or scaling up?

**Risk & Fit:**
12. How would you feel about a deal that could lose money?
13. Are you looking for hands-on or passive involvement?
14. What attracted you to this programme/service?

---

## Expected Answer Configuration

Each question has configurable pass/fail criteria per tenant:

```json
{
  "question_id": "q_goal",
  "expected_keywords": ["financial freedom", "passive income", "build portfolio", "retire early"],
  "negative_keywords": ["get rich quick", "no money down", "overnight"],
  "sentiment_min": 0.3,
  "min_words": 5,
  "fallback_decision": "review"  // "pass" | "fail" | "review" when no clear match
}
```

Carina checks responses and assigns:
- **Pass** - clear match to expected patterns
- **Fail** - matches negative patterns or contradicts requirements
- **Review** - ambiguous; tenant decides

---

## Data Model

```sql
qualification_questionnaires
  id, tenant_id, name, is_active, created_at

qualification_questions
  id, questionnaire_id, sort_order, question_text, 
  type (text|choice|range|boolean),
  expected_config (json),  -- keywords, negatives, ranges, options
  is_required, is_active

qualification_attempts
  id, tenant_id, questionnaire_id, 
  prospect_name, prospect_email, prospect_phone,
  answers (json),           -- raw answers given
  carina_evaluation (json), -- Carina's verdict per question
  overall_verdict (pass|fail|review),
  disqualified_at,          -- set when failed
  converted_at,             -- set if they later became a contact/mentee
  notes,                    -- tenant can override or add notes
  created_at
```

---

## Carina Integration

### Flow

1. Prospect fills questionnaire (embedded form or Carina chat)
2. Answers sent to Carina with the question config
3. Carina evaluates: "Does this answer match expected patterns? Any red flags?"
4. Returns structured verdict per question + overall
5. System records attempt:

```
If PASS   → proceed to next step (booking form, mentor assignment, onboarding)
If FAIL   → show friendly message ("Thanks, we'll review and get back to you")
            → record logged in qualification_attempts
            → tenant sees: "John Doe attempted to book mentoring - disqualified:
              Q3: 'I want to get rich quick' (negative keyword match)
              Q7: Budget £5,000 (below £20,000 minimum)"
If REVIEW → flag for tenant manual decision
```

### Tenant Dashboard

The qualification_attempts table feeds a section in the mentoring dashboard:
- Disqualified attempts - name, contact details, answers given, why Carina flagged them
- Override button - tenant can manually convert a disqualified lead
- Conversion tracking - did any disqualified leads eventually become customers?

---

## Benefits

- **Saves mentor time** - unqualified leads filtered before booking
- **No ghosting** - every attempt is recorded, tenant can follow up if they disagree
- **Configurable** - each tenant/programme sets their own bar
- **Data-driven** - over time, see which disqualification patterns predict non-conversion
- **Compliant** - soft rejection, not hard block; data retained for review

---

## Implementation Priority

| Piece | Effort | Depends on |
|-------|--------|-----------|
| Database migration (tables) | 1h | Nothing |
| Question pool CRUD UI | 2h | Migrations |
| Carina evaluation prompt | 2h | Understanding Carina's prompt injection pattern |
| Form/flow integration | 3h | All of the above |
| Tenant dashboard for attempts | 2h | API endpoints |
| **Total** | **~10h** | |

---

## Questions for Next Discussion

1. Which flow goes first - mentoring sign-up or deal analysis requests?
2. Should each programme/cohort have its own questionnaire or share one per tenant?
3. What happens to disqualified leads - email notification, silent record, both?
4. Do we need a "retake" option (prospect retakes with better answers)?
