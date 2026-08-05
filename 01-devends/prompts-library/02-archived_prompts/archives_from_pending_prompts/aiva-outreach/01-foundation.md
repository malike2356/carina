# Phase 01: Foundation -- Telegram Control and Campaign Engine

**Status:** Build first. Papa Lord must talk to Aiva via Telegram before anything else.
**Target:** 4 prompts, 1 week.

---

## Prompt 01-01: Telegram Connection for Papa Lord

**Depends on:** Nothing. This is the first prompt.
**Target time:** 3 hours

### What This Builds

Papa Lord connects his Telegram account to his Aiva worker. He sends messages to Aiva via Telegram Bot, and Aiva responds. This is the control channel for the entire outreach program.

### Implementation

1. Papa Lord opens Telegram, searches for `@BotFather`, clicks Start
2. He already has a bot token from the screenshot he sent Laud
3. Add the bot token to Aiva's Telegram channel configuration
4. Link Papa Lord's Telegram user ID to his Aiva worker
5. Test: Papa Lord sends "hello" to the bot. Aiva responds.

### Key Deliverables

- Telegram bot connected to Aiva worker (Papa Lord's specific worker)
- Bot responds to basic commands: `/help`, `/status`, `/start`
- Bot identifies Papa Lord by Telegram user ID (no other users can control his worker)
- Papa Lord can send natural language instructions: "Find 20 property investors in Portsmouth and email them"

### Files to Modify

- Aiva Telegram channel config (add bot token)
- Worker-Telegram user linking (new table or config entry)
- Basic command handler for `/help`, `/status`, `/start`

### Acceptance Criteria

- Papa Lord sends "hello" on Telegram -> Aiva responds
- `/status` returns worker info (name, channels connected, active campaigns)
- `/help` returns available commands
- Unknown user sends message -> Aiva ignores (or responds with "unauthorized")

---

## Prompt 01-02: Outreach Campaign Engine

**Depends on:** 01-01 (Telegram working)
**Target time:** 6 hours

### What This Builds

The core campaign data model and orchestration engine. A campaign is: a target audience, a message template, a delivery schedule, and a tracking pipeline.

Papa Lord says: "Find property investors in Manchester. Send them this message. Target 50 people by Friday. Follow up on Monday if no response."

Aiva creates a campaign, tracks its progress, and reports back.

### Data Model

```typescript
interface OutreachCampaign {
  id: string;
  workerId: string;
  name: string;
  status: 'draft' | 'scraping' | 'outreach' | 'paused' | 'completed';
  target: {
    audience: string; // "property investors in Manchester"
    count: number; // 50
    deadline: Date; // Friday
  };
  message: {
    subject: string;
    body: string; // template with {{variables}}
    followUp?: {
      subject: string;
      body: string;
      delayDays: number; // 3
    };
  };
  progress: {
    leadsFound: number;
    emailsSent: number;
    emailsOpened: number;
    responses: number;
    meetingsBooked: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Key Deliverables

- Campaign CRUD: create, list, pause, resume, complete
- Campaign state machine: draft -> scraping -> outreach -> completed
- Progress tracking: counters for each stage
- Telegram commands: `/campaign new`, `/campaign list`, `/campaign status <id>`, `/campaign pause <id>`
- Papa Lord can ask natural language: "How is the Manchester campaign going?" and Aiva reports progress

### Files to Create

- `src/workers/product-tools/outreach/campaign.ts` -- campaign data model + state machine
- `src/workers/product-tools/outreach/store.ts` -- campaign storage (PostgreSQL)
- `src/workers/product-tools/outreach/commands.ts` -- Telegram command handlers
- Migration: `outreach_campaigns` table

### Acceptance Criteria

- Papa Lord creates a campaign via Telegram: "Create campaign: find property investors in Portsmouth, send intro email, target 20 by Friday"
- Aiva confirms: "Campaign created: Portsmouth Property Investors. Target: 20 leads by Friday. Status: draft."
- `/campaign list` shows all campaigns with status
- `/campaign status <id>` shows detailed progress
- Campaign state transitions work: draft -> scraping -> outreach -> completed

---

## Prompt 01-03: Message Template Engine

**Depends on:** 01-02 (campaign engine)
**Target time:** 4 hours

### What This Builds

A templating system for outreach messages. Papa Lord creates reusable templates with variables. Aiva fills in variables from lead data before sending.

### Template Format

```
Subject: {{firstName}}, quick question about {{topic}}

Body:
Hi {{firstName}},

I came across {{companyName}} and noticed you're in {{industry}}.

I help {{targetAudience}} with {{valueProposition}}.

Would you be open to a 15-minute call this week to see if there's a fit?

Best,
{{senderName}}
```

### Variables

- `{{firstName}}` -- lead first name (from scraper)
- `{{companyName}}` -- lead company name
- `{{industry}}` -- lead industry
- `{{topic}}` -- campaign topic
- `{{valueProposition}}` -- campaign value prop
- `{{senderName}}` -- Papa Lord's name
- `{{calendarLink}}` -- booking link (added in Phase 03)

### Key Deliverables

- Template CRUD: create, list, edit, delete
- Variable interpolation engine
- Template preview: "Show me what this looks like for lead X"
- Default templates: "Property Investor Intro", "Follow-up After No Response", "Meeting Confirmation"
- Telegram commands: `/template new`, `/template list`, `/template preview <id>`

### Files to Create

- `src/workers/product-tools/outreach/templates.ts` -- template engine
- `src/workers/product-tools/outreach/template-store.ts` -- template storage

### Acceptance Criteria

- Papa Lord creates a template with variables
- Variables interpolate correctly with sample lead data
- `/template list` shows available templates
- Template preview shows rendered output

---

## Prompt 01-04: Lead Data Model

**Depends on:** 01-02 (campaign engine)
**Target time:** 3 hours

### What This Builds

The lead data model. Every person contacted is a lead. Leads flow through stages: found -> contacted -> responded -> booked -> meeting_done -> won/lost.

### Data Model

```typescript
interface Lead {
  id: string;
  campaignId: string;
  status: 'found' | 'contacted' | 'responded' | 'booked' | 'meeting_done' | 'won' | 'lost' | 'unsubscribed';
  
  // Contact info
  firstName: string;
  lastName?: string;
  email: string;
  companyName?: string;
  industry?: string;
  phone?: string;
  website?: string;
  
  // Source
  source: 'google_maps' | 'web_search' | 'linkedin' | 'manual' | 'referral';
  sourceUrl?: string;
  
  // Outreach
  firstContactedAt?: Date;
  lastContactedAt?: Date;
  messageTemplateId?: string;
  
  // Response
  respondedAt?: Date;
  responseText?: string;
  responseSentiment?: 'positive' | 'neutral' | 'negative';
  
  // Booking
  meetingBookedAt?: Date;
  meetingDateTime?: Date;
  meetingCalendarEventId?: string;
  meetingOutcome?: string;
  
  // Follow-up
  followUpCount: number;
  lastFollowUpAt?: Date;
  nextFollowUpAt?: Date;
  
  // Notes
  notes?: string;
  tags?: string[];
  
  createdAt: Date;
  updatedAt: Date;
}
```

### Key Deliverables

- Lead CRUD: create, update, list by campaign, filter by status
- Bulk lead import (from scraper output)
- Lead deduplication: skip if same email already exists in any campaign
- Lead export: CSV download of all leads in a campaign
- Telegram: `/leads <campaignId>` shows lead summary (count by status)

### Files to Create

- Migration: `outreach_leads` table
- `src/workers/product-tools/outreach/leads.ts` -- lead store

### Acceptance Criteria

- Leads created from scraper output
- Lead status transitions: found -> contacted -> responded -> booked -> meeting_done -> won/lost
- Deduplication: same email added twice -> second is skipped
- `/leads <campaignId>` shows: "Portsmouth Investors: 45 found, 30 contacted, 5 responded, 2 booked"
