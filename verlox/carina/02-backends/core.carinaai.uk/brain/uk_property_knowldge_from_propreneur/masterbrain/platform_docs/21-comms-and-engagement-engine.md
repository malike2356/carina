# Communications & Engagement Engine - Module 4

**Last updated:** 2026-05-05
**Status:** In progress - sequences, enrollments, automation hooks, per-step **email_template_slug**, expanded **trigger library** (`deal.status_changed`, `deal.stale`, `investor.engagement_drop`, `manual`), compliance/deal-analysis **context** for tokens and delayed steps, and manual enrolment from contacts shipped 2026-05-15; delivery audit (`communication_sends`) and further channels remain backlog.
**Module:** 4 (Communications Hub)

### Shipped slice (2026-05-02, updated 2026-05-05)

Tenant tables `communication_sequences`, `communication_steps`, `communication_enrollments`, `communication_enrollment_step_completions`. Optional **`communication_steps.email_template_slug`** references **`EmailTemplate`** (library); when set, send path uses `EmailTemplate::render()` plus `CommunicationTemplateTokenService` merge for enrollment context (same tokens as custom step bodies). Service `App\Services\Communications\CommunicationEnrollmentService` drives enrollments from workspace automation (`communication_enroll` action), records per-step outcomes (`sent` / `skipped`), and only marks an enrollment **completed** when every **active** step has a completion row (including steps run later via `ProcessCommunicationStepJob`). Workspace admin UI under `/communications` (multi-step editor with template picker when templates exist) and `/settings/automation`; feature flags `communications_hub` and `tenant_workspace_admin_api`. Built-in sequence slug `investor_deal_won` (seeded). Journal drafts from automation require the deal actor to have Spatie permission **`manage-accounting`**. Rule triggers and other automation action types: **`56-workspace-automation.md`**. Tests: **`tests/Feature/Communications/CommunicationEnrollmentLifecycleTest.php`** (library template step), **`tests/Feature/Communications/CommunicationTriggersDeepTest.php`** (deal status trigger + compliance context).

---

## Philosophy: Property-Native, Not BenchStack-Style Generics

**BenchStack** is a fictitious in-repo umbrella for every generic researched competitor we benchmark (marketing automation, funnel builders, white-label reskins, shallow listing tools). In docs, treat BenchStack as one composite rival when comparing to Propreneur.
BenchStack-class tools track marketing signals: page visits, email opens, form fills.

Propreneur tracks **property signals**: what deals an investor has been shown, whether their
preferred strategy has active matches in the pipeline, how their financial capacity aligns
with the current deal inventory.

**The decisive difference:**

| BenchStack (composite) | Propreneur |
|---|---|
| "Send email 3 days after form fill" | "Send deal teaser when SourcingMatchService scores a deal >75 for this investor" |
| Generic lead score: email opens + page visits | Investment score: capital confirmed + strategy match + active deal engagement |
| Template-based email drips | Carina-generated deal briefings with live calculator data |
| Any business (dentists, gyms, plumbers) | UK property investors only - every token, trigger, and template is property-specific |
| Re-engage with "new offer" | Re-engage with "a new BRR deal in M6 just hit 9.2% ROI against your 8% threshold" |

This means Propreneur will **never** build:
- A drag-and-drop "funnel builder"
- Generic A/B testing for marketing campaigns
- Social media post scheduling
- Generic SMS keyword campaigns ("Text DEAL to 12345")

Propreneur will build:
- Property-triggered sequences where every step has access to live deal, property, and investor data
- Carina-generated deal teasers that pull actual calculator outputs into the message body
- Investor engagement tiers driven by investment intelligence, not web analytics
- Booking links that know the investor's profile and pre-fill the viCal (Module 10) intake flow

Module 10 product spec: **`31-vcal-booking-module.md`**.

---

## Architecture Overview

```
Trigger Layer          Sequence Engine         Channel Layer
─────────────          ───────────────         ─────────────
Property events   →    Enrollment              Email (SMTP / SES)
Contact signals   →    Step runner             SMS (Twilio)
Scheduled jobs    →    Delay handling          In-app notification
Manual dispatch   →    Token resolver          (WhatsApp - future)
```

### Trigger Library (property-native)

| Trigger key | When it fires | Enrolled contact |
|---|---|---|
| `deal.matched` | `SourcingMatchService` scores a deal ≥ threshold for a saved criterion | Contact linked to that criterion |
| `contact.stale` | No activity logged against contact for N days (configurable per workspace) | The stale contact |
| `deal.stale` | DealAnalysis has no status change or Carina activity in N days | Assigned user (workspace admin alert) |
| `compliance.expiring` | ComplianceItem `expiry_date` within `reminder_days` window | Property owner / assigned user |
| `investor.engagement_drop` | Contact `engagement_score` falls below cold threshold | The contact |
| `deal.status_changed` | DealAnalysis status transitions (draft → shared, etc.) | Contacts linked via pipeline |
| `pipeline.stage_entered` | PipelineDeal moves into a stage that has a sequence attached | Contact linked to that PipelineDeal |
| `manual` | Operator clicks "Send sequence" from contact or deal show page | Selected contacts |

---

## Database Schema

### `communication_sequences`
```sql
id            uuid    PK
tenant_id     uuid    FK tenants (central)
name          string  - "Investor Keep-Warm", "Stale Deal Chase", "New Match Alert"
trigger_key   string  - see trigger library above
trigger_config jsonb  - e.g. {"min_score": 75, "stale_days": 14}
is_active     boolean
created_by    uuid    FK users
created_at / updated_at
```

### `communication_steps`
```sql
id              uuid   PK
sequence_id     uuid   FK communication_sequences
step_order      int    - 1, 2, 3…
delay_hours     int    - hours after previous step (0 = immediate)
channel         string - email | sms | notification
template_key    string - FK or inline template reference
ai_generate     boolean - if true, Carina generates body at send time
ai_prompt_key   string - which Carina prompt template to use
condition_json  jsonb  - optional "only send if {contact.engagement_score} < 40"
```

### `communication_templates`
```sql
id           uuid   PK
tenant_id    uuid   FK tenants
key          string - unique per tenant, e.g. "investor_deal_teaser"
channel      string - email | sms
subject      string - email only; supports tokens
body         text   - supports tokens
system       boolean - system templates cannot be deleted, only overridden
```

### `communication_enrollments`
```sql
id            uuid   PK
tenant_id     uuid
sequence_id   uuid   FK communication_sequences
contact_id    uuid   FK contacts
context_type  string - nullable: "deal_analysis" | "compliance_item" | "pipeline_deal"
context_id    uuid   - nullable: ID of the context record
current_step  int    - 0 = not started
status        string - active | paused | completed | unsubscribed | bounced
enrolled_at   timestamp
completed_at  timestamp nullable
```

### `communication_sends`
```sql
id              uuid   PK
enrollment_id   uuid   FK communication_enrollments
step_id         uuid   FK communication_steps
channel         string
status          string - queued | sent | delivered | failed | opened | replied
external_id     string - Twilio SID, SES message ID, etc.
sent_at         timestamp nullable
opened_at       timestamp nullable
replied_at      timestamp nullable
error_message   string nullable
```

### `communication_unsubscribes`
```sql
id          uuid
tenant_id   uuid
contact_id  uuid
channel     string - email | sms | all
reason      string - nullable
created_at  timestamp
```

---

## Token Library (Property Context)

Every template has access to these tokens at render time. The token resolver walks
the enrollment's context chain to populate them.

### Contact tokens
```
{{contact.first_name}}
{{contact.last_name}}
{{contact.email}}
{{contact.investment_score}}          -- numeric score 0-100
{{contact.engagement_stage}}          -- cold | warm | active | committed
{{contact.preferred_strategy}}        -- BTL | HMO | BRR | R2R | SA | Flip
```

### Workspace tokens
```
{{workspace.name}}                    -- e.g. "Xelox Properties"
{{workspace.owner_name}}
{{workspace.booking_link}}            -- viCal public booking URL when Module 10 active
{{workspace.logo_url}}
```

### Deal tokens (when context_type = 'deal_analysis')
```
{{deal.title}}
{{deal.address}}
{{deal.strategy}}                     -- human label e.g. "Buy-to-Let"
{{deal.asking_price}}                 -- formatted £
{{deal.roi}}                          -- e.g. "8.4%"
{{deal.gross_yield}}
{{deal.monthly_cashflow}}             -- formatted £
{{deal.summary_url}}                  -- link to deal show page (tenant subdomain)
```

### Compliance tokens (when context_type = 'compliance_item')
```
{{compliance.title}}                  -- e.g. "Gas Safety Certificate"
{{compliance.expiry_date}}            -- formatted "12 Jun 2026"
{{compliance.days_remaining}}         -- integer
{{compliance.property_address}}
```

### AI-generated tokens (Carina)
```
{{carina.deal_teaser}}               -- 2-3 sentences, strategy-aware, tone: professional
{{carina.investor_summary}}          -- personalised summary for this contact
{{carina.re_engagement_hook}}        -- re-engagement opener based on last interaction
```

AI tokens are populated by calling Carina with a structured prompt at send time.
They are generated once and stored in `communication_sends.rendered_body` - not re-generated on retry.

---

## Services

### `CommunicationSequenceService`
- `enroll(Contact $contact, string $triggerKey, ?Model $context): Enrollment`
- `processStep(Enrollment $enrollment): void` - resolves tokens, dispatches send, schedules next step
- `unenroll(Enrollment $enrollment, string $reason): void`
- `checkUnsubscribed(Contact $contact, string $channel): bool`

### `CommunicationTokenResolver`
- `resolve(string $template, Enrollment $enrollment): string`
- Walks `context_type` / `context_id` to populate property, deal, compliance tokens
- Falls back gracefully (blank string, never crashes)

### `CommunicationDeliveryService`
- Wraps `SmsService` (Twilio) and `TemplatedEmailService`
- Records send to `communication_sends`
- Handles delivery failures + retry logic
- Fires `CommunicationSent` event (listened to by `ContactEngagementScorer`)

### `ContactEngagementScorer` (see `32-contact-intelligence-and-lead-scoring.md`)
- Listens to `CommunicationSent`, `CommunicationOpened`, `CommunicationReplied`
- Updates `contacts.engagement_score` and `contacts.engagement_signals`

---

## Jobs

### `ProcessCommunicationStepJob`
- Dispatched by `CommunicationSequenceService::processStep()`
- Queued on `communications` queue
- Respects delay: uses `->delay(now()->addHours($step->delay_hours))`
- Checks unsubscribe before send

### `EnrollStaleContactsJob`
- Scheduled daily at 08:00
- Finds contacts with `last_activity_at < now()->subDays($workspace->stale_threshold_days)`
- Not already enrolled in a stale sequence
- Enrolls each into the workspace's active `contact.stale` sequence

### `EnrollStaleDealJob`
- Scheduled daily at 08:30
- Finds `DealAnalysis` records with no status change and no `CarinaConversation` in N days
- Fires `deal.stale` trigger → enrolls assigned workspace admin

---

## Controllers

### `CommunicationSequenceController` (tenant)
- `index` - list sequences with enrollment counts
- `create/store` - create sequence + steps in one form
- `show` - sequence detail with recent sends
- `edit/update` - update sequence + reorder steps
- `destroy` - soft delete (stop enrollments)

### `CommunicationSendController` (tenant)
- `manual` - `POST /contacts/{contact}/send-sequence` - manual enroll
- `preview` - `POST /communications/sequences/{sequence}/preview` - render tokens for a sample contact

### `CommunicationWebhookController` (central, no tenant middleware)
- `POST /webhooks/twilio/status` - Twilio delivery status callbacks → update `communication_sends`
- `POST /webhooks/twilio/inbound` - inbound SMS → log reply, update engagement score

### `UnsubscribeController` (tenant, unauthenticated)
- `GET /unsubscribe/{token}` - one-click unsubscribe from signed URL
- Records to `communication_unsubscribes`

---

## Routes (tenant.php additions)

```php
// Module 4 - Communications Hub
Route::middleware(['auth', 'subscription.feature:communications'])
    ->prefix('communications')->name('tenant.comms.')->group(function () {
        Route::resource('sequences', CommunicationSequenceController::class);
        Route::post('sequences/{sequence}/enroll/{contact}', [CommunicationSequenceController::class, 'manualEnroll'])
            ->name('sequences.enroll');
        Route::post('sequences/{sequence}/preview', [CommunicationSendController::class, 'preview'])
            ->name('sequences.preview');
    });

Route::get('/unsubscribe/{token}', [UnsubscribeController::class, 'handle'])
    ->name('tenant.unsubscribe');
```

---

## Phased Build Plan

### Phase 1 - Core Infrastructure (build first)

| Item | Description |
|---|---|
| Migrations (5 tables) | sequences, steps, templates, enrollments, sends, unsubscribes |
| Models | CommunicationSequence, CommunicationStep, CommunicationTemplate, CommunicationEnrollment, CommunicationSend |
| `CommunicationSequenceService` | enroll / processStep / unenroll |
| `CommunicationTokenResolver` | contact + workspace tokens only (no deal/compliance yet) |
| `CommunicationDeliveryService` | wraps existing SmsService + TemplatedEmailService |
| `ProcessCommunicationStepJob` | queued step execution |
| `CommunicationSequenceController` | CRUD UI |
| System templates | 3 seeded: investor_keep_warm, stale_deal_alert, compliance_reminder |
| Pest tests | enrollment flow, token resolution, unsubscribe |

### Phase 2 - Property Triggers + Deal Tokens

| Item | Description |
|---|---|
| `deal.matched` trigger | Wire into SourcingMatchService - enroll investor on match |
| `compliance.expiring` trigger | Wire into ComplianceItem - use existing reminder_days field |
| Deal token resolver | context_type = deal_analysis → populate deal tokens |
| Compliance token resolver | context_type = compliance_item → populate compliance tokens |
| `EnrollStaleContactsJob` | Daily scheduled |
| `EnrollStaleDealJob` | Daily scheduled |
| Manual enroll from contact show | One-click "Send sequence" |

### Phase 3 - Carina-Generated Content + Two-Way SMS

| Item | Description |
|---|---|
| AI tokens (`carina.deal_teaser`) | `CommunicationTokenResolver` calls `CarinaService` with deal context |
| `ai_generate = true` steps | Step-level Carina content generation |
| Twilio inbound webhook | Log replies, update engagement_score, create pipeline card on "interested" |
| Reply parser | "YES" / "INTERESTED" / "SEND DETAILS" → trigger `manual` next action |
| Booking link injection | `{{workspace.booking_link}}` → viCal booking URL with pre-filled contact context |

### Phase 4 - Analytics + Workspace Templates

| Item | Description |
|---|---|
| Sequence performance dashboard | Open rate, reply rate, conversion per sequence |
| Template library | Pre-built sequences: Investor Acquisition, Seller Lead Nurture, Deal Off-Market Outreach |
| Enrollment analytics | Funnel: enrolled → step 1 sent → opened → replied → deal created |
| A/B step variants | (Optional) Two body variants per step, auto-promote winner after 50 sends |

---

## Integration with Other Modules

| Module | How they connect |
|---|---|
| CRM (Module 2) | Every send is linked to a Contact; engagement updates contact score |
| Deal Engine (Module 1) | `deal.matched` and `deal.stale` triggers; deal tokens in templates |
| Pipeline (Module 3) | `pipeline.stage_entered` trigger; inbound SMS "interested" creates PipelineDeal |
| Compliance (Module 6) | `compliance.expiring` trigger; compliance tokens |
| Booking (Module 10) | `{{workspace.booking_link}}` token; reply → auto-book |
| Carina AI (Module 13) | AI token generation; Carina context enrichment |
| Reporting (Module 12) | Sequence performance metrics |

---

## What This Gives Propreneur Over BenchStack

BenchStack sends a generic "follow up email" after a form fill. Propreneur does this:

> "Hi Sarah, a BRR opportunity just landed in M4 that matches your 8%+ ROI threshold. The deal
> calculator shows a projected 9.1% ROI with a £42k cash-in. Here's the full breakdown:
> [link]. Want to discuss it? Book a 20-min call: [viCal booking link]"

That message is auto-generated using:
1. Sarah's `investment_profile.preferred_strategies = ['brr']` and `min_roi = 8`
2. The actual deal calculator output stored in `deal_analyses.metrics`
3. Carina generating the introductory sentence with property-context tone
4. The workspace viCal booking link (Module 10)

No property platform on the market does this today.

---

*Related: `32-contact-intelligence-and-lead-scoring.md`, `05-crm.md` (investor profile), `29-deals-module-strategy.md`*
*Prompts: `brain/prompts/16-integrations.md` (SMS/email), future `brain/prompts/41-comms-hub.md`*
