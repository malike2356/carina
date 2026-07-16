# Feature Request: Property Sourcing Investor Nurture Sequence Template

**Source:** Property Sourcing Intensive (PSI) - Module 3: Marketing Funnel
**Date:** 14 May 2026
**Priority:** Medium (revenue enablement)

---

## Overview

Add a seeded `investor_nurture` communication sequence template based on the 17-day, 6-email property sourcing nurture flow taught in the PSI course. The communications engine infrastructure already exists (`31-comms-and-engagement-engine.md`); this is a content-level template addition.

## Trigger

A new contact is added to the CRM via:
- Lead funnel form capture (Meta/LinkedIn/TikTok webhook)
- Manual CRM contact creation with `source = lead_magnet`
- Lead magnet download / freebie request

On creation, auto-enroll the contact into the `investor_nurture` sequence.

## Sequence Template: 17-Day / 6-Step

| Step | Delay | Email Subject / Content | Purpose |
|:----:|:-----:|------------------------|---------|
| 1 | Immediate | Welcome - "Thanks for downloading your [freebie]" | Confirm delivery, warm welcome |
| 2 | Day 3-4 | Deal Showcase - "Here's a deal we just completed" | Real example with numbers + photos |
| 3 | Day 7 | How It Works - "This is how we help investors" | Process explanation, clear steps |
| 4 | Day 10 | Compliance - "Here's why we're legitimate" | Build trust, prove professionalism |
| 5 | Day 14 | Testimonial - "See what [investor] said about us" | Social proof |
| 6 | Day 17 | Call to Action - "Let's talk - free 45-min call" | Convert to Zoom/viCal booking |

## Follow-Up Action

After step 6 completes:
- Mark contact as `nurtured` in CRM
- Optionally trigger a workspace automation rule (e.g., assign to sales queue)
- Virtual PA callback reminder (manual or tool-triggered) 7-14 days after enrollment

## Token Support

The sequence should use the existing `CommunicationTemplateTokenService` token merge:
- `{{contact.first_name}}` - contact first name
- `{{contact.last_name}}` - contact last name
- `{{workspace.company_name}}` - tenant workspace name
- `{{workspace.booking_link}}` - viCal booking link (for step 6)
- `{{contact.source}}` - how they entered (lead magnet type)

## PA Follow-Up System (Enhancement)

Add a `pa_callback_reminder` optional step that:
- Shows a notification in the workspace admin UI after N days
- Provides a phone script template for the VPA
- Tracks whether the call was completed

## Value

- Converts cold leads into warm prospects in 17 days
- Proven framework (instructor sold his first deal from 77 database contacts)
- Works for any property sourcing business tenant
- Low effort to implement (reuses existing comms engine + email template system)

## Implementation Notes

- Seeder: `Database\Seeders\Communication\InvestorNurtureSequenceSeeder`
- Feature flag: `communications_hub` (already exists)
- Uses existing `communication_sequences`, `communication_steps`, `communication_enrollments` tables
- Existing `EmailTemplate` library for step content
- Auto-enrollment hook in `LeadFunnelInboundLead` or `ContactObserver`

## Related Knowledge

- `31-comms-and-engagement-engine.md` - existing comms engine infrastructure
- `108-lead-funnel-module.md` - lead ingestion flow
- `100-property-marketing-funnel-lead-magnets-and-nurture-campaigns.md` - marketing funnel theory
- Marketing Funnel & Email Sequence (masterbrain/marketing/) - full PSI extraction
