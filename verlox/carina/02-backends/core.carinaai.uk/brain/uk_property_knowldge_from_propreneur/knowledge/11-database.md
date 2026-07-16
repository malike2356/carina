# Database Schema

**Last updated:** 2026-05-15

## Overview
PostgreSQL 16 multi-tenant architecture. Central DB + per-tenant databases (prefixed `propreneur_t_`). Tenant DBs use pgvector extension for RAG embeddings.

## Central Database (propreneur_central)

### Core
- `tenants` - workspace definitions (slug, plan, trial, edition, module_sets)
- `domains` - subdomain + custom domain records for each tenant
- `users` - platform admin accounts
- `roles` / `permissions` - Spatie RBAC (platform guard)
- `two_factor_settings` - platform user 2FA state

### Subscription & Billing
- `subscriptions` - Stripe subscription links
- `subscription_plans` - plan catalogue
- `subscription_usage` - per-tenant usage tracking

### Feature Flags
- `feature_flags` - global + per-tenant overrides

### Settings
- `platform_settings` - typed key-value store
- `setting_definitions` - schema for typed settings
- `tenant_settings` - tenant-scoped overrides

### AI & Carina
- `ai_providers` - provider registry (name, model, key)
- `ai_usage_logs` - usage audit per provider
- `platform_carina_conversations` / `platform_carina_messages` - platform admin Carina chats
- `carina_rate_limits` - rate limit tracking

### Infrastructure
- `platform_job_schedules` - DB-driven scheduled tasks
- `backup_jobs` / `backup_schedules` / `backup_destinations` - backup system
- `restore_jobs` - restore operations
- `security_findings` / `security_activity_logs` - SCOUT findings
- `remote_access_logs` / `remote_access_log_archives` - remote support sessions
- `analytics_events` - cross-tenant analytics
- `theme_presets` / `tenant_theme_overrides` - theme management
- `lead_funnel_webhook_routes` - public webhook registration per tenant
- `migration_logs` / `migration_mappings` - v1→v2 migration tracking

## Tenant Database (per-tenant)

### Business Core
- `users` - workspace user accounts
- `roles` / `permissions` - Spatie RBAC (tenant guard)
- `two_factor_settings` - user 2FA
- `invitations` - user workspace invitations

### Properties
- `properties` - property records
- `property_documents` - property document uploads (versioned)
- `property_tenancies` - tenancy records
- `area_profiles` - sourcing area bundles

### Deals & Sourcing
- `deal_analyses` - deal analysis records
- `deal_calculator_logs` - calculator run audit
- `deal_refurb_lines` - refurb line items
- `deal_offers` - deal offers
- `deal_shortlists` / `deal_shortlist_items` - saved comparisons
- `deal_alerts` - sourcing criteria alerts
- `sourcing_criteria` - saved search criteria
- `sourcing_research_links` - bookmarked URLs
- `listing_sources` - BYO RSS/webhook/email feeds
- `listing_source_events` - feed poll logs
- `listing_automation_watches` - portal listing monitors
- `refurb_catalogue_items` - UK refurb cost reference

### CRM & Pipeline
- `contacts` - people (customers, investors, leads, etc.)
- `contact_interactions` - timeline events
- `pipelines` - board definitions
- `pipeline_stages` - board columns
- `pipeline_deals` - kanban cards
- `pipeline_activities` - activity log

### Compliance
- `compliance_items` - certificates, licences, deadlines

### Accounting
- `gl_accounts` - chart of accounts
- `journal_entries` - journal headers
- `journal_lines` - journal entries
- `expenses` - expense records

### Communications
- `communication_sequences` - multi-step sequences
- `communication_steps` - step definitions
- `communication_enrollments` - enrolled contacts
- `comm_enrollment_step_completions` - step tracking
- `email_templates` - reusable templates

### Community Learning
- `community_posts` / `community_comments` / `community_messages`
- `community_deal_shares` / `community_deal_share_comments`
- `community_testimonials` / `community_wins`
- `groups` / `group_members` / `group_events`
- `courses` / `course_modules` / `course_assignments`
- `quizzes` / `quiz_questions` / `quiz_attempts`
- `learning_paths` / `learning_path_assignments`
- `badges` / `user_badges`

### Mentoring OS
- `mentor_profiles` / `mentorship_packages` / `mentorship_package_courses`
- `mentorship_programmes` / `mentorship_cohorts` / `mentorship_cohort_members`
- `mentorship_relationships` / `mentorship_session_notes` / `mentorship_goals`
- `mentorship_milestones` / `mentorship_messages` / `mentorship_invoices`
- `mentee_registrations`

### viCal (Booking)
- `vcal_event_types` / `vcal_bookings` / `vcal_availability_rules`
- `vcal_blackout_dates` / `vcal_intake_pools`
- `vcal_group_events` / `vcal_group_event_registrations`
- `vcal_event_tickets` / `vcal_api_keys`

### Lead Funnel
- `lead_funnel_inbound_leads` / `lead_funnel_ad_campaigns`
- `lead_funnel_campaign_performance`
- `lead_funnel_lead_forms` / `lead_funnel_funnel_stages`
- `lead_funnel_funnel_automations` / `lead_funnel_automation_logs`
- `lead_funnel_platform_integrations`

### Investors
- `investor_profiles` / `investor_portal_users`
- `investor_kyc_records` / `investor_proof_of_funding`
- `investor_vip_subscriptions`

### Integrations & Webhooks
- `integration_configs` / `integration_logs`
- `webhook_endpoints` / `webhook_deliveries`

### Automation
- `workspace_automation_rules` / `workspace_automation_runs`
- `automation_logs`

### Other
- `carina_conversations` / `carina_messages` - tenant Carina chats
- `rag_documents` / `rag_chunks` - vector RAG storage (pgvector)
- `rag_sources` - RAG source configuration
- `report_definitions` / `report_executions` - saved reports
- `dashboard_widgets` - configurable dashboard
- `tenant_settings` / `tenant_ai_settings` - workspace config
- `tenant_theme_overrides` - theme customization
- `subscription_usage` - feature usage tracking
- `invoices` - Stripe invoice records

## Migrations
- Central: `database/migrations/` (135+ migrations)
- Tenant: `database/migrations/tenant/`
- Seeders: `TenantBootstrapSeeder` (runs all tenant seeders), `FunnelStageSeeder`, `RefurbCatalogueSeeder`, `WorkspaceAutomationBuiltinSeeder`, `CommunicationBuiltinSeeder`, etc.
