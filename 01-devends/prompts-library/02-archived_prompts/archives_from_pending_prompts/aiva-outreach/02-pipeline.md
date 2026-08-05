# Phase 02: Pipeline -- Lead Scraping, Email Outreach, Response Handling

**Status:** Build after Phase 01 (Telegram + campaign engine working)
**Target:** 4 prompts, 1 week.

---

## Prompt 02-01: Lead Scraper -- Google Maps

**Depends on:** 01-04 (lead data model)
**Target time:** 8 hours

### What This Builds

A Google Maps scraper that finds businesses matching a search query. Papa Lord says: "Find property investors in Portsmouth." Aiva searches Google Maps, extracts business names, websites, and emails where available, and imports them as leads into the campaign.

### Implementation

Use Google Maps API or web scraping (Puppeteer) to search for businesses. Extract:
- Business name -> lead `companyName`
- Website URL -> lead `website`
- Phone number (if available)
- Address
- Industry category

Then use a secondary step to find email addresses from websites (scrape contact pages, look for email patterns like info@, contact@, or individual names).

### Key Deliverables

- `scrapeGoogleMaps(query, location, limit)` tool
- Extracts: business name, website, phone, address, category
- Email finder: scrapes website for contact emails
- Deduplication against existing leads in any campaign
- Progress reporting: "Found 45 businesses, extracted 30 emails. 5 duplicates skipped. 25 new leads added."
- Rate limiting: respect Google Maps ToS. Max 60 results per search.
- Telegram command: `/scrape maps "property investors" "Portsmouth" 30` -> Aiva scrapes and imports

### Files to Create

- `src/workers/product-tools/outreach/scrapers/google-maps.ts`
- `src/workers/product-tools/outreach/scrapers/email-finder.ts`

### Acceptance Criteria

- Search "property investors Portsmouth" returns real businesses with websites
- Email extraction finds contact emails on business websites
- Deduplication prevents re-adding leads already in any campaign
- 30 results returned in under 60 seconds
- Progress updates sent to Telegram during scraping

---

## Prompt 02-01b: Lead source -- Companies House (preferred for UK ltd/llp)

**Depends on:** `aiva-companies-house-api/` (client + Aiva tools live)
**Canonical prompts:** `../aiva-companies-house-api/` and `../aiva-outreach-discovery-funnel/14-companies-house-lead-source.md`
**Docs:** https://developer.company-information.service.gov.uk/

### What This Builds

Official register search and enrich: find companies and officers via Companies House Public Data API, then import into outreach leads with `source=companies_house`. Does not replace email finder; CH rarely supplies marketing emails.

### Key Deliverables

- Call `companies-house-search-companies` / `companies-house-search-officers` / profile+officers tools
- Map company_number, status, SIC, registered office, officer names onto lead fields
- Dedupe on company_number; keep Google Maps path for local venues without a filing

### Acceptance Criteria

- "Find companies on Companies House named X" returns company numbers and imports leads without HTML scrape
- Rate limit 600/5min respected during batch import

---

## Prompt 02-02: Lead Scraper -- Web Search and LinkedIn

**Depends on:** 01-04 (lead data model)
**Target time:** 6 hours

### What This Builds

Expands lead sources beyond Google Maps. Web search scraper finds leads from search results. Optional LinkedIn scraping (public profiles only, no login required).

### Implementation

**Web Search Scraper:**
- Search queries like: "property investment company {city}" or "{industry} business {location}"
- Extract results from Google/Bing search pages
- Parse business names and websites from search snippets
- Feed URLs to email finder (from 02-01)

**LinkedIn Scraper (public only):**
- Search: "property investor {city} site:linkedin.com/in"
- Extract name, title, company from public profile snippets
- NO login. NO private data. Public search results only.

### Key Deliverables

- `scrapeWebSearch(query, limit)` tool
- `scrapeLinkedIn(query, limit)` tool (public only)
- Combined scraper: `scrapeLeads(sources: ['google_maps', 'web_search', 'linkedin'], query, location, limit)`
- Source tracking: every lead tagged with its source
- Telegram: `/scrape all "property investors" "Manchester" 50` -> runs all scrapers

### Files to Create

- `src/workers/product-tools/outreach/scrapers/web-search.ts`
- `src/workers/product-tools/outreach/scrapers/linkedin.ts`
- `src/workers/product-tools/outreach/scrapers/combined.ts`

### Acceptance Criteria

- Web search returns business leads with names and websites
- LinkedIn search returns people with titles and companies (public only)
- Combined scraper merges results and deduplicates
- Source tag accurate on every lead

---

## Prompt 02-03: Email Outreach Engine

**Depends on:** 01-03 (templates), 01-04 (leads), 02-01 (scraper)
**Target time:** 8 hours

### What This Builds

The email sending engine. Takes a campaign, a template, and a list of leads. Sends personalized emails at a controlled rate. Tracks opens, clicks, and bounces.

### Implementation

Use Aiva's existing email infrastructure (Resend or SMTP). For each lead:
1. Interpolate template variables with lead data
2. Send email via Aiva's email channel
3. Record: sent_at, message_id (for tracking)
4. Update lead status: found -> contacted

Rate limiting: max 50 emails per hour to avoid spam flags. Space sends 2-3 minutes apart.

### Key Deliverables

- `sendOutreach(campaignId, templateId)` -- sends to all 'found' leads in campaign
- `sendToLead(leadId, templateId)` -- sends to single lead
- Email tracking: open tracking pixel, click tracking on links
- Bounce handling: if email bounces, mark lead status as 'bounced'. Do not retry.
- Unsubscribe link in every email. If clicked, mark lead as 'unsubscribed'. Never email again.
- Send rate limiter: configurable max per hour. Default 50.
- Telegram commands:
  - `/send campaign <id> template <id>` -- start outreach
  - `/send status` -- current send progress
  - `/send pause` -- pause sending
  - `/send resume` -- resume

### Files to Create

- `src/workers/product-tools/outreach/email-sender.ts`
- `src/workers/product-tools/outreach/email-tracker.ts`
- `src/workers/product-tools/outreach/rate-limiter.ts`

### Acceptance Criteria

- Personalized emails sent to all 'found' leads in a campaign
- Template variables correctly interpolated per lead
- Open tracking records opens
- Bounced emails marked as bounced, not retried
- Unsubscribe marks lead and prevents future emails
- Rate limiter enforces max sends per hour
- Papa Lord can pause/resume sending from Telegram

---

## Prompt 02-04: Response Handler

**Depends on:** 02-03 (email sending)
**Target time:** 6 hours

### What This Builds

The response handling pipeline. When a lead replies to an outreach email, Aiva:
1. Detects the reply (email polling or webhook)
2. Classifies the response (interested, not interested, wrong person, out of office)
3. Updates lead status and campaign progress
4. Notifies Papa Lord on Telegram
5. If positive response, triggers the booking flow (Phase 03)

### Implementation

Use Aiva's existing email ingestion pipeline (IMAP polling or Resend webhooks). Match incoming emails to outreach campaigns by:
- In-Reply-To header matching sent message IDs
- Subject line matching (Re: original subject)
- Sender email matching lead email

Classify response using simple keyword matching + LLM:
- **Positive:** "interested", "yes", "tell me more", "book a call", "when can we talk"
- **Negative:** "not interested", "no thanks", "unsubscribe", "stop"
- **Neutral:** "who is this", "how did you get my email", "not right now"
- **Out of Office:** auto-reply detection

### Key Deliverables

- Response detection: match incoming email to campaign + lead
- Response classification: positive/negative/neutral/ooo
- Lead status update: 'responded' + sentiment tag
- Telegram notification: "Lead: John from ABC Properties responded positively. Reply: 'Yes, interested. Can we talk Thursday?'"
- Auto-reply for out-of-office: note in lead record, don't count as real response
- Response log: full conversation thread stored per lead

### Files to Create

- `src/workers/product-tools/outreach/response-handler.ts`
- `src/workers/product-tools/outreach/response-classifier.ts`

### Acceptance Criteria

- Incoming reply matched to correct campaign and lead
- Response classified accurately (test with 10 real email replies)
- Telegram notification sent immediately on positive response
- Lead status updated in database
- Auto-reply/out-of-office detected and filtered
