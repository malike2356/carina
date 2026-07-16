# Module - Lead Funnel (Marketing Intake)

**Last updated:** 2026-05-14  
**Purpose:** Paid social and web lead ingestion - connect ad platforms (Meta, LinkedIn, TikTok), capture leads via webhooks and inbound forms, score with Carina AI, and convert hot leads into CRM contacts.

**Feature flag key:** `lead_funnel` (see `App\Support\PlatformFeatureCatalogue`)  
**Subscription module:** `BillingModule::LeadFunnel` (`lead_funnel`)  
**Routes:** `routes/tenant_lead_funnel_api.php` (authenticated API), plus webhook routes in `routes/tenant.php` (public, shared secret). Tenant Blade page at `GET /lead-funnel` (`tenant.lead-funnel.index`).  
**Filament:** `app/Filament/Resources/LeadFunnel/InboundLeadResource` and `AdCampaignResource` (central admin monitoring), `app/Filament/Pages/LeadFunnelDashboard`.

---

## 1. Purpose and scope

Give workspace owners the ability to:

- Connect Meta (Facebook/Instagram), LinkedIn, and TikTok ad accounts via OAuth
- Define capture **Lead Forms** (embedded or hosted) and map them to **funnel stages**
- Ingest leads from ad platform webhooks (Meta) and scheduled polls (LinkedIn, TikTok)
- Score inbound leads with **Carina AI** against sourcing criteria and investment goals
- Automatically create CRM contacts for hot leads
- Run **automation rules** (reassign stage, send notification, trigger webhook)
- Track campaign performance metrics (impressions, clicks, cost per lead)
- Manage GDPR compliance for lead data

---

## 2. Models

### Tenant database

| Model | Table | Role |
|-------|-------|------|
| `App\Models\Tenant\LeadFunnel\InboundLead` | `lead_funnel_inbound_leads` | Raw captured lead: `provider`, `provider_lead_id`, `form_id`, `campaign_id`, `fields` JSONB (name, email, phone, custom), `score`, `carina_score` JSONB, `status` (new, qualified, warm, cold, converted, disqualified, archived), `assigned_to`, `notes` |
| `App\Models\Tenant\LeadFunnel\AdCampaign` | `lead_funnel_ad_campaigns` | Campaign metadata: `name`, `provider` (meta, linkedin, tiktok), `provider_campaign_id`, `status` (active, paused, archived), `budget`, `start_date`, `end_date`, `creative` JSONB |
| `App\Models\Tenant\LeadFunnel\CampaignPerformance` | `lead_funnel_campaign_performance` | Daily metrics: `date`, `impressions`, `clicks`, `leads`, `cost_minor`, `ctr`, `cpl_minor`, `cost_per_lead_minor` |
| `App\Models\Tenant\LeadFunnel\LeadForm` | `lead_funnel_lead_forms` | Capture form definition: `name`, `description`, `provider` (meta, linkedin, tiktok, embed), `provider_form_id`, `fields` JSONB, `redirect_url`, `is_active` |
| `App\Models\Tenant\LeadFunnel\FunnelStage` | `lead_funnel_funnel_stages` | Named stages (new, contacted, qualified, proposal, negotiation, won, lost) with `sort_order` and `color`; seeded by `FunnelStageSeeder` |
| `App\Models\Tenant\LeadFunnel\FunnelAutomation` | `lead_funnel_funnel_automations` | Triggers: `trigger_type` (lead_created, stage_changed, score_threshold, inactivity), `conditions` JSONB, `actions` JSONB (change_stage, notify_user, create_crm_contact, trigger_webhook, send_email) |
| `App\Models\Tenant\LeadFunnel\AutomationLog` | `lead_funnel_automation_logs` | Execution log: `automation_id`, `inbound_lead_id`, `trigger_event`, `result`, `error_message` |

### Central database

| Model | Table | Role |
|-------|-------|------|
| `App\Models\Central\LeadFunnelWebhookRoute` | `lead_funnel_webhook_routes` | Public webhook route registration per-tenant: `tenant_id`, `provider`, `secret`, `webhook_id` (Meta verify token / LinkedIn challenge), `is_active` |

### Tenant Contact model additions

`App\Models\Tenant\Contact` gains:
- `lead_funnel_source` - provider string when contact originated from lead funnel
- `lead_funnel_campaign_id` - FK to campaign that generated the lead
- `lead_funnel_score` - composite score at time of conversion

---

## 3. Ad platform connectors

All three platforms follow the same pattern: **OAuth handshake → stored credentials → scheduled pull or webhook receipt**.

### Meta (Facebook/Instagram)

- OAuth stored in `PlatformIntegration` (tenant-level Meta app credentials from `config/lead_funnel.php`)
- Webhook endpoint: `POST /api/lead-funnel/webhooks/meta` (tenant host, validated via shared secret in `LeadFunnelWebhookRoute`)
- `ProcessMetaWebhookJob` - ingests lead gen form submissions
- `LeadIngestionService` - normalises Meta field names to standard shape

### LinkedIn

- OAuth (2-legged for Lead Gen Forms API)
- `PullLinkedInLeadsJob` - runs every 15 min (see `PlatformScheduleCatalog`), fetches new submissions from connected forms
- `LinkedInApiService` - wraps LinkedIn Marketing API v2

### TikTok

- OAuth (TikTok for Business)
- `PullTikTokLeadsJob` - runs every 15 min
- `TikTokApiService` - wraps TikTok Business API

---

## 4. Lead scoring (Carina AI)

`CarinaQualifyLeadService` sends lead profile fields + workspace sourcing criteria to Carina for:

- **Fit score** (0-100): how well the lead matches the sourcing ICP
- **Intent signal** (buyer, seller, investor, partner, unknown)
- **Urgency** (low, medium, high)
- **Budget bracket** (if discernible from conversation or form fields)
- **Recommended next action** (call, email, qualify further, archive)

Results stored in `InboundLead.carina_score` JSONB. Scored asynchronously via `CarinaQualifyLeadJob` (queued after webhook or pull creates the InboundLead row).

**Thresholds** (from `config/lead_funnel.php`):
- `hot_lead_score_threshold` (default 120): leads above this auto-create CRM contacts
- `dead_lead_score_threshold` (default 10): leads below this are auto-archived

---

## 5. Automation engine

`FunnelAutomationService` evaluates triggers and runs actions when:

| Trigger | Evaluates |
|---------|-----------|
| `lead_created` | Immediately on InboundLead creation |
| `stage_changed` | When lead moves to a different funnel stage |
| `score_threshold` | After Carina qualification completes |
| `inactivity` | `CheckLeadActivityJob` - daily pass at 08:00; archived leads with no activity in N days |

**Available actions:**
- `change_stage` - move to target funnel stage
- `notify_user` - send in-app notification to assigned user
- `create_crm_contact` - create/update a CRM Contact record with lead data
- `trigger_webhook` - POST to configured outbound webhook with lead payload
- `send_email` - send templated email from workspace Communications Hub

Automations can be toggled and reordered per funnel stage. `ExecuteAutomationJob` runs the action set.

---

## 6. Campaign management

### Platform integration (OAuth credentials)

`PlatformIntegration` (tenant model) stores OAuth tokens and app secrets for each connected ad platform. The `OAuthService` manages the token lifecycle:

- `GET /api/integrations/oauth/redirect` - redirect to platform auth
- `GET /api/integrations/oauth/callback` - exchange code for tokens
- `DELETE /api/integrations/oauth/disconnect` - revoke

### Campaign publish flow

1. User defines campaign in Propreneur (`AdCampaign` with budget, creative, targeting)
2. `CampaignPublisherService` pushes to the connected ad platform via its API
3. Scheduled `SyncCampaignPerformanceJob` pulls yesterday's metrics daily at 06:00

---

## 7. CRM sync (hot lead conversion)

When an InboundLead qualifies (score >= hot threshold, or automation rule fires), `CreateCrmContactJob`:

1. Checks for existing Contact by email/phone
2. Creates or updates `Contact` with lead data and `lead_funnel_*` source fields
3. Optionally assigns to a pipeline deal stage
4. Fires `HotLeadDetected` domain event

Listener `NotifyTenantOwnerOfHotLead` sends an in-app notification + optional email.

---

## 8. API routes

All under tenant host, prefix `api/lead-funnel`, gated by `subscription.feature:lead_funnel` and `feature:lead_funnel`. Full table in `routes/tenant_lead_funnel_api.php`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/lead-funnel/integrations` | List connected ad platform integrations |
| `GET/POST/PUT/DELETE` | `/api/lead-funnel/forms` | CRUD lead capture forms |
| `POST` | `/api/lead-funnel/forms/{id}/publish` | Activate form for embedding |
| `GET/POST/PUT/DELETE` | `/api/lead-funnel/campaigns` | CRUD campaigns |
| `POST` | `/api/lead-funnel/campaigns/{id}/publish` | Push campaign to ad platform |
| `POST` | `/api/lead-funnel/campaigns/{id}/pause` | Pause active campaign |
| `GET` | `/api/lead-funnel/campaigns/{id}/performance` | Campaign metrics |
| `GET` | `/api/lead-funnel/leads` | List inbound leads (paginated, filterable) |
| `GET` | `/api/lead-funnel/leads/stats` | Aggregate lead statistics |
| `GET` | `/api/lead-funnel/leads/{id}` | Single lead detail |
| `GET` | `/api/lead-funnel/stages` | List funnel stages |
| `GET/POST/PUT/DELETE` | `/api/lead-funnel/automations` | CRUD automation rules |
| `POST` | `/api/lead-funnel/automations/{id}/toggle` | Enable/disable |
| `POST` | `/api/lead-funnel/automations/{id}/run` | Manual trigger |

**OAuth routes** (prefix `api/integrations/oauth`):
| `GET` | `/api/integrations/oauth/redirect` | Start platform OAuth |
| `GET` | `/api/integrations/oauth/callback` | OAuth callback handler |
| `DELETE` | `/api/integrations/oauth/disconnect` | Revoke platform token |

**Webhook routes** (public, no auth middleware):
- `POST /api/lead-funnel/webhooks/meta` - Meta lead gen callback
- `POST /api/lead-funnel/webhooks/linkedin` - LinkedIn webhook (when implemented)
- `POST /api/lead-funnel/webhooks/tiktok` - TikTok webhook (when implemented)

---

## 9. Filament (central admin)

- `LeadFunnelDashboard` - cross-tenant lead volume graph, top campaigns, platform health
- `InboundLeadResource` - view all inbound leads across tenants
- `AdCampaignResource` - view all campaigns across tenants

---

## 10. Jobs and events

**Jobs** (queued):
- `ProcessMetaWebhookJob` - ingest Meta lead submission
- `PullLinkedInLeadsJob` - scheduled poll for LinkedIn leads
- `PullTikTokLeadsJob` - scheduled poll for TikTok leads
- `CarinaQualifyLeadJob` - AI scoring of a single lead
- `CreateCrmContactJob` - convert lead to CRM contact
- `ExecuteAutomationJob` - run one automation rule
- `CheckLeadActivityJob` - daily inactivity sweep
- `SyncCampaignPerformanceJob` - daily metrics pull
- `PublishCampaignJob` - push campaign to ad platform

**Events**:
- `LeadFunnel\HotLeadDetected` - fired when a lead crosses the hot threshold; listened by `NotifyTenantOwnerOfHotLead`

**Listeners:**
- `LeadFunnel\NotifyTenantOwnerOfHotLead` - in-app notification + email
- `LeadFunnel\SyncLeadFunnelTrialOnTenantUserCreated` - provisions lead funnel trial for new users

---

## 11. Scheduled tasks

From `PlatformScheduleCatalog`:

| Slug | Cron | Job |
|------|------|-----|
| `lead-funnel-pull-linkedin` | `*/15 * * * *` | `PullLinkedInLeadsJob` |
| `lead-funnel-pull-tiktok` | `*/15 * * * *` | `PullTikTokLeadsJob` |
| `lead-funnel-sync-campaign-performance` | `0 6 * * *` | `SyncCampaignPerformanceJob` |
| `lead-funnel-check-lead-activity` | `0 8 * * *` | `CheckLeadActivityJob` |

---

## 12. GDPR compliance

`LeadFunnelGdprService` handles:

- **Data retention**: auto-archive leads older than retention period (configurable per workspace)
- **Right to erasure**: delete all lead data for a given email/phone
- **Consent tracking**: `InboundLead.fields` stores consent flags from form submissions
- **Anonymisation**: archived leads have PII fields nulled after configurable grace period

---

## Related

- `59-carina-propreneur-full-codex.md` (subscription gates, module inventory)
- `31-comms-and-engagement-engine.md` (email templates for lead nurture)
- `32-contact-intelligence-and-lead-scoring.md` (CRM scoring integration)
- `60-artisan-and-scheduler-catalog.md` (scheduled jobs)
- `62-jobs-and-events-catalog.md` (job and event catalog)
- `69-property-sourcing-lead-qualification-framework.md` (sourcing lead framework)
- `config/lead_funnel.php` (env keys: `META_*`, `LINKEDIN_*`, `TIKTOK_*`, scoring thresholds)
