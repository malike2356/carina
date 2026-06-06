# CRM (Contact Management)

**Last updated:** 2026-05-15

## Overview
Manages contacts - vendors, agents, solicitors, brokers, tenants, investors, and other property professionals. Each contact can be linked to properties, deals, pipeline items, interactions, and investor profiles.

**Feature flag:** `crm` (BillingModule::Crm)  
**Routes:** `tenant.contacts.*` (Blade UI), `tenant.api.crm.*` (JSON API)  
**Controllers:** `ContactController`, `CrmDashboardController`  
**Services:** `ContactService`, `ContactImportService`, `ContactExportService`, `InteractionService`  
**API:** `Api\Crm\ContactController`, `ContactImportExportController`, `ContactInteractionController`, `ContactInvestorScoreController`, `ContactMatchedPipelineDealsController`, `PipelineDealInvestorMatchController`

## Contact Model

`App\Models\Tenant\Contact` (table `contacts`, UUID PK, SoftDeletes, Searchable Scout)

**Fields:** `name`, `first_name`, `last_name`, `email`, `phone`, `mobile`, `type` (vendor/agent/solicitor/broker/tenant/investor/landlord/contractor/other - see `App\Support\CrmContactType`), `company`, `position`, `source` (referral/portal/social/direct/marketing/lead_funnel/other), `notes`, `tags` (JSONB), `social_links` (JSONB), `address` fields, `lead_funnel_source`, `lead_funnel_campaign_id`, `lead_funnel_score`

**Relationships:** `interactions()`, `investorProfile()`, `pipelineDeals()`, `createdBy()`, `assignedTo()`

## Interaction Tracking

`App\Models\Tenant\ContactInteraction` - timeline events: `type` (call/email/meeting/note/viewing/offer/other - see `App\Support\CrmInteractionType`), `description`, `interacted_at`, `created_by`. Recorded via `InteractionService`.

## Contact Scoring (Investor Score)

`App\Services\Scoring\ContactScoringService` - computes an investment score per Contact based on profile completeness, deal history, interaction frequency, and pipeline activity. Scored contacts link to `InvestorProfile` for deeper investment criteria.

API: `ContactInvestorScoreController` - read investment score for one contact. `PipelineDealInvestorMatchController` - suggest contacts that match a pipeline deal.

## Contact Import/Export

`ContactImportService` / `ContactExportService` - CSV import/export via `ContactImportExportController`. Supports field mapping and dedup by email.

## CRM Dashboard

`CrmDashboardController` at `GET /crm/dashboard` (`tenant.crm.dashboard`). Shows:
- Total contacts by type
- Recent interactions
- Investor pipeline stats
- Contacts requiring attention

## Related

- Investors hub: `/investors/*` routes (funnel, KYC, power team, pipeline board)
- Pipeline: contacts matched to pipeline deals
- Lead Funnel: contacts created via hot lead conversion
