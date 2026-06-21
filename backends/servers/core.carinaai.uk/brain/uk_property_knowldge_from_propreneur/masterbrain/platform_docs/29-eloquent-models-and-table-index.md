# Eloquent models and table index

**Last updated:** 2026-05-14 (added: Lead Funnel models, Mentoring OS models, Community Learning models, viCal models, Deal shortlist models, Investor models, Automation models, Integration models, Reporting models, Security models, Backup models, Billing models, settings models)  
**Purpose:** Map Eloquent models to DB tables so Carina and developers can trace data boundaries. Tables marked `(tenant)` live in per-tenant databases; `(central)` lives in the shared platform database.

---

## Central database models

| Model | Table | Purpose |
|-------|-------|---------|
| `PlatformUser` | `users` | Central admin login |
| `PlatformRole` | `roles` | Spatie role (central guard `platform`) |
| `PlatformPermission` | `permissions` | Spatie permission (central guard `platform`) |
| `PlatformTwoFactorSetting` | `two_factor_settings` | Platform user 2FA state |
| `Tenant` | `tenants` | Multitenant workspace |
| `Domain` | `domains` | Tenant subdomain + custom domain |
| `Subscription` | `subscriptions` | Stripe subscription link |
| `SubscriptionPlan` | `subscription_plans` | Plan catalogue (CRUD) |
| `FeatureFlag` | `feature_flags` | Global + per-tenant feature toggles |
| `PlatformSetting` | `platform_settings` | Typed key-value store |
| `SettingDefinition` | `setting_definitions` | Schema for typed settings |
| `PlatformJobSchedule` | `platform_job_schedules` | DB-driven scheduled tasks |
| `BackupJob` | `backup_jobs` | Backup run log |
| `BackupSchedule` | `backup_schedules` | Recurring backup definitions |
| `BackupDestination` | `backup_destinations` | Storage destinations |
| `RestoreJob` | `restore_jobs` | Restore operation log |
| `SecurityFinding` | `security_findings` | SCOUT scan findings |
| `SecurityActivityLog` | `security_activity_logs` | Security action audit |
| `RemoteAccessLog` | `remote_access_logs` | Remote access session log |
| `RemoteAccessLogArchive` | `remote_access_log_archives` | Archived session records |
| `CarinaConversation` | `carina_conversations` | Platform admin Carina threads |
| `CarinaMessage` | `carina_messages` | Platform admin Carina messages |
| `CarinaRateLimit` | `carina_rate_limits` | Rate limit tracking (platform) |
| `CarinaSystemPrompt` | `carina_system_prompts` | Overridable system prompts |
| `AiProvider` | `ai_providers` | AI provider registry |
| `AiUsageLog` | `ai_usage_logs` | AI usage audit |
| `PlatformIntegration` | `platform_integrations` | Platform-level integration configs |
| `PlatformCarinaConversation` | `platform_carina_conversations` | Alternative Carina conv model |
| `PlatformCarinaMessage` | `platform_carina_messages` | Alternative Carina message model |
| `MigrationLog` | `migration_logs` | v1 → v2 migration tracking |
| `MigrationMapping` | `migration_mappings` | v1 ID → v2 ID mapping |
| `Setting` | `settings` | Legacy settings (singular) |
| `TenantSetting` | `tenant_settings` | Tenant-scoped settings |
| `SettingAuditLog` | `setting_audit_logs` | Setting change audit |
| `SubscriptionUsage` | `subscription_usage` | Usage tracking per subscription |
| `AnalyticsEvent` | `analytics_events` | Cross-tenant analytics |
| `TenantThemeOverride` | `tenant_theme_overrides` | Per-tenant theme overrides |
| `ThemePreset` | `theme_presets` | Predefined theme configurations |
| `LeadFunnelWebhookRoute` | `lead_funnel_webhook_routes` | Public webhook registration per-tenant |
| `TwoFactorSetting` | `two_factor_settings` | 2FA state (platform user) |

---

## Tenant database models

### Core business

| Model | Table | Purpose |
|-------|-------|---------|
| `User` | `users` | Workspace user |
| `TenantRole` | `roles` | Spatie role (tenant guard `web`) |
| `TenantPermission` | `permissions` | Spatie permission (tenant guard `web`) |
| `TwoFactorSetting` | `two_factor_settings` | Tenant user 2FA state |

### Deals

| Model | Table | Purpose |
|-------|-------|---------|
| `Property` | `properties` | Property records |
| `AreaProfile` | `area_profiles` | Named sourcing area bundles |
| `SourcingCriterion` | `sourcing_criteria` | Saved sourcing search criteria |
| `SourcingResearchLink` | `sourcing_research_links` | Bookmarked research URLs |
| `ListingSource` | `listing_sources` | BYO RSS/webhook/email feed configs |
| `ListingSourceEvent` | `listing_source_events` | Feed poll event log |
| `ListingAutomationWatch` | `listing_automation_watches` | Portal listing watch configs |
| `PropertyDocument` | `property_documents` | Attached property documents (vault) |
| `PropertyTenancy` | `property_tenancies` | Tenancy records per property |
| `DealAnalysis` | `deal_analyses` | Deal analysis calculations |
| `DealCalculatorLog` | `deal_calculator_logs` | Calculator run history |
| `DealRefurbLine` | `deal_refurb_lines` | Refurbishment line items |
| `DealShortlist` | `deal_shortlists` | Saved deal shortlists |
| `DealShortlistItem` | `deal_shortlist_items` | Items in a shortlist |
| `DealAlert` | `deal_alerts` | Deal alerts per sourcing criterion |
| `RefurbCatalogueItem` | `refurb_catalogue_items` | UK refurb cost reference table |

### CRM

| Model | Table | Purpose |
|-------|-------|---------|
| `Contact` | `contacts` | People (investors, tenants, leads, contacts) |
| `ContactInteraction` | `contact_interactions` | Timeline events |
| `Pipeline` | `pipelines` | Pipeline board definition |
| `PipelineStage` | `pipeline_stages` | Stage definitions |
| `PipelineDeal` | `pipeline_deals` | Deals on pipeline boards |
| `PipelineActivity` | `pipeline_activities` | Deal activity log |

### Compliance

| Model | Table | Purpose |
|-------|-------|---------|
| `ComplianceItem` | `compliance_items` | Certificates, licences, deadlines |

### Communications

| Model | Table | Purpose |
|-------|-------|---------|
| `CommunicationSequence` | `communication_sequences` | Multi-step sequence |
| `CommunicationStep` | `communication_steps` | Step in a sequence |
| `CommunicationEnrollment` | `communication_enrollments` | Contacts enrolled |
| `CommunicationEnrollmentStepCompletion` | `comm_enrollment_step_completions` | Step completion tracking |
| `EmailTemplate` | `email_templates` | Reusable email templates |
| `Domain` | `domains` | Tenant custom domains |

### Accounting

| Model | Table | Purpose |
|-------|-------|---------|
| `GlAccount` | `gl_accounts` | Chart of accounts |
| `JournalEntry` | `journal_entries` | Journal entry header |
| `JournalLine` | `journal_lines` | Journal entry lines |
| `Expense` | `expenses` | Workspace expense records |

### Community Learning / Social

| Model | Table | Purpose |
|-------|-------|---------|
| `CommunityPost` | `community_posts` | Posts in workspace |
| `CommunityComment` | `community_comments` | Comments on posts |
| `CommunityMessage` | `community_messages` | Direct messages |
| `CommunityDealShare` | `community_deal_shares` | Shared deal analyses |
| `CommunityDealShareComment` | `community_deal_share_comments` | Comments on shared deals |
| `CommunityTestimonial` | `community_testimonials` | Testimonials |
| `CommunityWin` | `community_wins` | Success stories |
| `Group` | `groups` | Community groups |
| `GroupMember` | `group_members` | Group membership |
| `GroupEvent` | `group_events` | Group events/meetups |
| `Course` | `courses` | Learning courses |
| `CourseModule` | `course_modules` | Course modules/sections |
| `CourseAssignment` | `course_assignments` | Course assignments |
| `Quiz` | `quizzes` | Knowledge checks |
| `QuizQuestion` | `quiz_questions` | Quiz questions |
| `QuizAttempt` | `quiz_attempts` | User quiz attempts |
| `LearningPath` | `learning_paths` | Curated learning journeys |
| `LearningPathAssignment` | `learning_path_assignments` | Path-to-course mapping |
| `Badge` | `badges` | Achievement badges |
| `UserBadge` | `user_badges` | Awarded badges |

### Mentoring OS

| Model | Table | Purpose |
|-------|-------|---------|
| `MentorProfile` | `mentor_profiles` | Mentor profiles |
| `MentorshipPackage` | `mentorship_packages` | Service packages |
| `MentorshipPackageCourse` | `mentorship_package_courses` | Package-to-course mapping |
| `MentorshipProgramme` | `mentorship_programmes` | Programme definitions |
| `MentorshipCohort` | `mentorship_cohorts` | Cohort groups |
| `MentorshipCohortMember` | `mentorship_cohort_members` | Members in cohorts |
| `MentorshipRelationship` | `mentorship_relationships` | Mentor-mentee links |
| `MentorshipSessionNote` | `mentorship_session_notes` | Session notes |
| `MentorshipGoal` | `mentorship_goals` | Goal tracking |
| `MentorshipMilestone` | `mentorship_milestones` | Milestones |
| `MentorshipMessage` | `mentorship_messages` | Messages |
| `MentorshipInvoice` | `mentorship_invoices` | Recurring invoices |
| `MenteeRegistration` | `mentee_registrations` | Intake applications |

### viCal (Booking)

| Model | Table | Purpose |
|-------|-------|---------|
| `VcalEventType` | `vcal_event_types` | Meeting types |
| `VcalBooking` | `vcal_bookings` | Bookings |
| `VcalAvailabilityRule` | `vcal_availability_rules` | Availability templates |
| `VcalBlackoutDate` | `vcal_blackout_dates` | Blocked dates |
| `VcalIntakePool` | `vcal_intake_pools` | Booking intake routing |
| `VcalGroupEvent` | `vcal_group_events` | Group events |
| `VcalGroupEventRegistration` | `vcal_group_event_registrations` | Registrations |
| `VcalEventTicket` | `vcal_event_tickets` | Paid event tickets |
| `VcalApiKey` | `vcal_api_keys` | Public API keys |

### Lead Funnel

| Model | Table | Purpose |
|-------|-------|---------|
| `LeadFunnel\InboundLead` | `lead_funnel_inbound_leads` | Raw captured leads |
| `LeadFunnel\AdCampaign` | `lead_funnel_ad_campaigns` | Ad campaign metadata |
| `LeadFunnel\CampaignPerformance` | `lead_funnel_campaign_performance` | Daily campaign metrics |
| `LeadFunnel\LeadForm` | `lead_funnel_lead_forms` | Capture form definitions |
| `LeadFunnel\FunnelStage` | `lead_funnel_funnel_stages` | Funnel stages |
| `LeadFunnel\FunnelAutomation` | `lead_funnel_funnel_automations` | Automation rules |
| `LeadFunnel\AutomationLog` | `lead_funnel_automation_logs` | Automation execution logs |
| `LeadFunnel\PlatformIntegration` | `lead_funnel_platform_integrations` | Connected ad platforms |

### Investors

| Model | Table | Purpose |
|-------|-------|---------|
| `InvestorProfile` | `investor_profiles` | Investor profiles (JSONB) |
| `InvestorPortalUser` | `investor_portal_users` | Portal auth accounts |
| `InvestorKycRecord` | `investor_kyc_records` | KYC documentation |
| `InvestorProofOfFunding` | `investor_proof_of_funding` | Proof of funds |
| `InvestorVipSubscription` | `investor_vip_subscriptions` | VIP subscription tier |
| `FunnelStage` | `funnel_stages` | Investor funnel stages |

### Integrations

| Model | Table | Purpose |
|-------|-------|---------|
| `IntegrationConfig` | `integration_configs` | Provider credentials |
| `IntegrationLog` | `integration_logs` | API call audit |
| `WebhookEndpoint` | `webhook_endpoints` | Outbound webhook targets |
| `WebhookDelivery` | `webhook_deliveries` | Webhook dispatch log |

### Automation

| Model | Table | Purpose |
|-------|-------|---------|
| `WorkspaceAutomationRule` | `workspace_automation_rules` | Trigger-action rules |
| `WorkspaceAutomationRun` | `workspace_automation_runs` | Execution log |
| `AutomationLog` | `automation_logs` | Generic automation logs |

### Infrastructure

| Model | Table | Purpose |
|-------|-------|---------|
| `Invitation` | `invitations` | User invitations |
| `DashboardWidget` | `dashboard_widgets` | Configurable dashboard |
| `ReportDefinition` | `report_definitions` | Saved report configs |
| `ReportExecution` | `report_executions` | Report generation runs |
| `RagDocument` | `rag_documents` | Uploaded knowledge documents |
| `RagChunk` | `rag_chunks` | Embedding chunks |
| `RagSource` | `rag_sources` | Source configurations |
| `TenantSetting` | `tenant_settings` | Typed tenant settings |
| `TenantAiSetting` | `tenant_ai_settings` | Tenant AI configuration |
| `TenantThemeOverride` | `tenant_theme_overrides` | Theme customization |
| `SubscriptionUsage` | `subscription_usage` | Feature usage tracking |
| `Invoice` | `invoices` | Stripe invoices |
| `CarinaConversation` | `carina_conversations` | Tenant Carina threads |
| `CarinaMessage` | `carina_messages` | Tenant Carina messages |

## Related

- `59-carina-propreneur-full-codex.md` - product truth and module documentation links
- `11-database.md` - database schema details
- `108-lead-funnel-module.md` - Lead Funnel model detail
- `31-vcal-booking-module.md` - viCal model detail
- `58-mentoring-os-tenant-surface.md` - Mentoring OS model detail
- `54-community-learning-module.md` - Community Learning model detail
- `33-accounting-module.md` - Accounting model detail
