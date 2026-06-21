# Lead Funnel

**Last updated:** 2026-05-17

## Overview
The Lead Funnel captures and manages incoming leads from multiple channels - Facebook, Instagram, LinkedIn, TikTok, and your own landing pages. It scores leads, routes them through configurable pipeline stages, and automates follow-up actions like emails, SMS, task creation, and AI qualification.

## Core Features
- **Multi-channel lead ingestion** - Capture leads from ad platforms (Facebook/Instagram, LinkedIn, TikTok) and custom landing page forms
- **OAuth platform connections** - Connect your ad accounts to automatically receive leads
- **Smart lead scoring** - Leads scored 0-200 based on source, engagement, segment, and recency
- **Configurable pipeline stages** - Build your own funnel stages (New, Contacted, Qualified, Negotiation, Won, Lost, Re-engagement)
- **Automation engine** - Trigger actions when leads enter/exit stages, open emails, or hit score thresholds
- **Email tracking** - Open and click tracking on automated emails
- **AI qualification** - Carina can automatically qualify leads and provide qualification reasoning
- **GDPR compliance** - Built-in erasure and anonymisation workflows

## Getting Started
1. **Connect ad platforms** via OAuth - Facebook, LinkedIn, or TikTok
2. **Set up lead forms** - Sync existing forms or create new ones with custom fields
3. **Define pipeline stages** - Configure the stages your leads will move through
4. **Set up automations** - Create trigger-action rules for follow-ups
5. **Let leads flow in** - Incoming leads are automatically ingested, scored, and routed

## Key Workflows

### Ingesting a new lead
When a lead arrives from any channel, the system automatically detects duplicates (by platform ID or email within 24 hours), maps their answers to a segment (investor, deal sourcer, landlord, agent, etc.), assigns a score, and places them in the first funnel stage.

### Scoring breakdown
- **Base scores by source:** LinkedIn (30), landing page (25), Facebook/Instagram (20), TikTok (15), other (10)
- **Engagement bonuses:** +10 per email open (max 30), +15 per email click (max 45), +25 for replying, +50 for starting a trial
- **Decay penalties:** -35 after 30 days inactive, -20 after 14 days, -10 after 7 days
- **Segment modifiers:** +15 for investors, +10 for deal sourcers and landlords, +5 for agents
- **Hot leads (score 120+):** Trigger immediate notifications and Carina AI qualification
- **Cold leads (score 10 or below + 30 days inactive):** Automatically moved to Re-engagement

### Building automations
Create rules with triggers (stage entered, email opened/clicked/not opened, no activity, segment matched, reply received, trial started) and actions (send email, send SMS, assign to user, move to stage, add/remove tag, create task, notify owner, AI qualify, webhook POST). Delays can be set in hours.

### Email tracking
All automated emails include a transparent tracking pixel and wrapped links. When a lead opens an email or clicks a link, their engagement score updates automatically.

## Business Rules
- Leads are deduplicated by platform ID (unique per platform + workspace) and by email (within 24 hours)
- OAuth state tokens expire after 10 minutes for security
- Meta webhook requests are verified using HMAC SHA-256
- GDPR erasure anonymises lead PII and deletes automation logs
- Hot leads (score 120+) trigger immediate notifications and AI qualification

## Best Practices
- Set realistic automation delays - don't blast leads immediately
- Use segment filters on automations to target the right leads with the right messages
- Monitor hot lead notifications - those are your highest-priority conversions
- Review and refresh your pipeline stages quarterly as your business evolves
- Keep your ad platform OAuth tokens connected and check for expiry

## Related Features
- **Speed to Lead** - Instant lead qualification and routing
- **Carina Agent** - AI-powered lead qualification
- **Comms & Engagement** - Email/SMS sequences for follow-ups
- **Compliance** - GDPR erasure workflows
