# Propreneur v2 - Feature Catalogue

> Living document. Append new features as they ship.
> Last updated: 2026-05-17
> Audit based on full codebase scan: Controllers / Routes / Models / Services / Migrations / Jobs / Events / Config / Feature Flags / Artisan Commands.

---

## Status Legend

- **[SHIPPED]** - Routes, controllers, models, and/or service layer exist in code
- **[PARTIAL]** - Some code exists but feature is incomplete or needs UI/frontend wiring
- **[PLANNED]** - Feature flag exists but no code implementation found

---

## Platform / Central (Admin)

- **[SHIPPED]** **Multi-Tenant SaaS Architecture** - Database-per-tenant using stancl/tenancy v3 with wildcard subdomain routing. Tenant model, central migrations, per-tenant DB bootstrap.
- **[SHIPPED]** **Platform Admin Dashboard** - Central admin panel (AdminDashboardController) with stats, user management, cross-tenant entry points.
- **[SHIPPED]** **Platform User Management** - CentralUserController, PlatformUser model, create/edit/impersonate/login-as.
- **[SHIPPED]** **Role-Based Access Control (Platform)** - RoleController, PlatformRole / PlatformPermission models, PlatformPermissionCatalogue, Spatie permission tables.
- **[SHIPPED]** **Two-Factor Authentication (Platform)** - PlatformTwoFactorController, PlatformTwoFactorChallengeController, PlatformTwoFactorSetting model, TOTP-based with recovery codes.
- **[SHIPPED]** **Password Reset Flow** - PlatformPasswordResetController, dedicated password reset tokens table, email-based reset with throttling.
- **[SHIPPED]** **Feature Flags** - FeatureFlagController, FeatureFlag model, PlatformFeatureCatalogue enum with 50+ definitions, sync-migration for catalogue updates.
- **[SHIPPED]** **Tenant Management** - TenantManagementController, Tenant model (central), CRUD with manual DB provisioning, subscription assignment.
- **[SHIPPED]** **Subscription Plans** - SubscriptionPlanController, SubscriptionPlan model (central), pricing tiers with Stripe price IDs, feature module sets.
- **[SHIPPED]** **Theme Presets** - ThemePresetController, ThemePreset model, central management of available themes.
- **[SHIPPED]** **Multi-Provider AI (Platform)** - AiProviderController, AiProvider model, BYOK registration of OpenAI/DeepSeek/Claude/Gemini.
- **[SHIPPED]** **Platform Carina AI** - PlatformCarinaController, PlatformCarinaConversation / PlatformCarinaMessage models, admin-level Carina assistant.
- **[SHIPPED]** **Platform Carina Knowledge Training** - PlatformCarinaKnowledgeTrainingController, upload/train platform-level documents.
- **[SHIPPED]** **Cross-Tenant Benchmarking** - CrossTenantBenchmarkController (/admin/analytics/cross-tenant-benchmark), anonymised cross-tenant analytics.
- **[SHIPPED]** **Cross-Tenant Analytics** - Aggregated usage and performance data (implied by benchmark controller).
- **[SHIPPED]** **Security Scout** - ScoutDashboardController, SecurityFinding / SecurityActivityLog models, scout config, ScoutPatchScanCommand, ScoutSastScanCommand, ScoutSyncPermissionsCommand.
- **[SHIPPED]** **Admin Search** - AdminSearchController (/admin/search), command palette search across tenants, users, and platform data.
- **[SHIPPED]** **Migration Management** - MigrationController, MigrationExportController, MigrationLog / MigrationMapping models, MigrateV1* Artisan commands (All, Contacts, Deals, Properties, Users, Rollback, Validate).
- **[SHIPPED]** **Job Scheduling** - PlatformJobScheduleController, PlatformJobSchedule model, CRUD for Laravel schedule entries.
- **[SHIPPED]** **Settings Management** - SettingController, SettingDefinitionController, SettingsController, Setting / SettingDefinition / SettingAuditLog models, definition-driven key-value settings.
- **[SHIPPED]** **Waitlist System** - WaitlistController, WaitlistAdminController, WaitlistEntry / WaitlistReferral models, referral codes, confirmation flow, associated Artisan commands (CleanupUnconfirmed, Export, SendUpdates).
- **[SHIPPED]** **Marketing Campaigns (Platform)** - MarketingCampaignController, MarketingCampaign model, platform-level marketing campaign management.
- **[SHIPPED]** **Platform Revenue Dashboard** - RevenueController, central Invoice model, MRR tracking, CSV export at /admin/revenue.
- **[SHIPPED]** **Backup & Disaster Recovery** - BackupController, BackupDestinationController, BackupScheduleController, BackupJob / BackupDestination / BackupSchedule models, dedicated backup tables, Artisan commands (Run, Schedule, Verify, Cleanup, List, Restore), ProcessRestoreJob/UploadBackupJob/VerifyBackupJob.
- **[SHIPPED]** **Backup Slack Notification** - `NotifySlackOnBackupCompleted` listener fires on backup job completion, posts to `BACKUP_SLACK_WEBHOOK_URL`; gated by `platform_backup_slack_notify` feature flag in `PlatformFeatureCatalogue`.
- **[SHIPPED]** **Platform Remote Access** - RemoteAccessController, RemoteAccessPlatformSettingsController, RemoteAccessLog / RemoteAccessLogArchive models, GDPR-acknowledged session initiation.
- **[SHIPPED]** **Platform Audit Logs** - AuditLogController (/admin/audit-logs), super-admin audit log viewer and exports.
- **[SHIPPED]** **Design System Lab** - UiController (/admin/ui), super-admin UI lab.
- **[SHIPPED]** **AI Usage Tracking (Platform)** - AiUsageController, AiUsageLog model, per-provider/tenant token tracking.
- **[SHIPPED]** **Platform Job Scheduler** - PlatformJobScheduleController + model, CRUD for cron schedule entries.
- **[SHIPPED]** **Filament Ops Console Panel** - Filament v3 panel at `/filament`, panel ID `admin`, auth guard `platform` (PlatformUser), colour Amber. Platform operator monitoring hub distinct from the main `/admin` CRUD panel. Config: `app/Providers/Filament/AdminPanelProvider.php`. Full docs: `brain/knowledge/101-ops-console-filament-panel.md`.
- **[SHIPPED]** **Platform Health Widget** - `PlatformHealthWidget` (Filament StatsOverviewWidget, 30s polling). Four live stats: Redis ping, DB latency (SELECT 1 microsecond timing), failed jobs count, queue depth. All wrapped in try/catch - widget never throws if Redis/DB is degraded. Color thresholds: green/amber/red per stat.
- **[SHIPPED]** **Platform Tenant Stats Widget** - `PlatformTenantStatsWidget` (60s polling). Four stats: total workspaces, active (30d) via tenant cursor loop, pending onboarding (`workspace_onboarding_completed_at IS NULL`), inactive (`is_active = false`). Color thresholds per count.
- **[SHIPPED]** **Platform Rate Limit Config** - `PlatformRateLimitConfig` static-cached service reads rate limits from `PlatformSetting` (key `filament_carina_admin_settings`) first, falls back to `config('carina.rate_limits')`. `flush()` clears the static cache. `RateLimitService` calls `PlatformRateLimitConfig::limits()` so saved limits take effect on next request after cache flush.
- **[SHIPPED]** **CarinaSettings Runtime Sync** - Filament `CarinaSettings` page `save()` calls `syncAiProviderDefaults()` to write `is_platform_default` and `default_model` to the `ai_providers` table (not just the JSON blob), so `AiRuntimeResolutionService` picks up changes immediately. Also calls `PlatformRateLimitConfig::flush()` so saved rate limits take effect without restart.
- **[SHIPPED]** **Filament CRM Cross-Workspace Viewer** - `Crm\ContactResource` at `/filament/crm/contacts`, read-only cross-tenant contact viewer in the Ops Console. Gated by `crm` feature flag. Quick link "Workspace people" in `OpsConsoleQuickLinks` widget. Uses `InteractsWithFilamentWorkspace` trait to scope to the selected workspace session.

---

## Core Tenant Workspace

- **[SHIPPED]** **Workspace Onboarding** - WorkspaceOnboardingController, OnboardingJourney model, guided setup wizard for new tenants.
- **[SHIPPED]** **Workspace Settings Hub** - WorkspaceSettingsHubController, central settings panel for workspace-wide configuration.
- **[SHIPPED]** **Multi-Language / Localization** - LanguageController, LocaleController, LocalizationSettingsController, TranslationController, Translation / TranslationSet / UserLanguage models, localization tables, TranslationExport/Missing/Sync commands.
- **[SHIPPED]** **Tenant Theme / Appearance** - AppearanceController, TenantThemeController, ThemeCssController, TenantThemeOverride model, custom branding with colours/logo/typography/CSS.
- **[SHIPPED]** **Global Search (Tenant)** - TenantSearchController (/search), searches contacts/deals/properties/documents.
- **[SHIPPED]** **Workspace Teams** - WorkspaceTeamController, UserController (tenant), RoleController (tenant), invitation flow.
- **[SHIPPED]** **Tenant 2FA** - TenantTwoFactorController, TwoFactorChallengeController, TwoFactorSetting model, TOTP-based.
- **[SHIPPED]** **Audit Logging** - AuditController, AuditReportController, AuditRetentionController, AuditLog / AuditLogHash / AuditRetentionPolicy models, hash-chained audit trail, archive/cleanup/verify commands.
- **[SHIPPED]** **Tenant User Invitations** - InvitationController, InvitationAcceptController, Invitation model, guest invitation accept routes.
- **[SHIPPED]** **Tenant Workspace Admin API** - User/Role/Invitation/2FA JSON APIs for workspace admin.
- **[SHIPPED]** **Workspace Subscriptions** - WorkspaceSubscriptionsController, tenant-level subscription/plan/billing management.
- **[SHIPPED]** **In-App Notifications** - InAppNotificationController, InAppNotification model, notification preferences, toast/notification system.
- **[SHIPPED]** **Tenant AI Settings** - TenantAiSettingController, TenantAiUsageController, TenantAiSetting model, per-workspace AI provider config.
- **[SHIPPED]** **Trial Expiry Enforcement** - Redirect expired trials without subscription to /trial-expired.
- **[SHIPPED]** **Mail Settings** - MailSettingsController, tenant-level mail configuration.

---

## Deal Pipeline / Deal Sourcing

- **[SHIPPED]** **Deal Management** - DealController, PipelineDeal model, full CRUD with pipeline tracking, status, deal analysis linking.
- **[SHIPPED]** **Pipeline Stages** - PipelineStageController, PipelineStage model, configurable stages with ordering.
- **[SHIPPED]** **Pipeline Stage Automation** - PipelineStageAutomationController, PipelineStageAutomation model, auto-advance deals based on triggers and conditions.
- **[SHIPPED]** **Pipeline Analytics** - PipelineAnalyticsController, velocity/conversion/bottleneck analysis.
- **[SHIPPED]** **Deal Shortlists** - DealShortlistController, DealShortlistAttachmentController, DealShortlist / DealShortlistItem models, group deals for comparison.
- **[SHIPPED]** **Deal Offers** - DealOfferController, DealOffer model, track offers with amount/terms/status.
- **[SHIPPED]** **Deal Workspace** - DealWorkspaceController, dedicated workspace per deal with documents/notes/actions.
- **[SHIPPED]** **Source Deals** - SourceDealsController, track deal source attribution for ROI analysis.
- **[SHIPPED]** **Sourcing Criteria** - SourcingCriterionController, SourcingCriterion model, define ideal deal criteria for filtering/scoring.
- **[SHIPPED]** **Sourcing Inbox** - SourcingInboxController, review/qualify/accept/reject sourced deals.
- **[SHIPPED]** **Sourcing Alerts** - DealAlert model, ProcessSourcingAlertsCommand, automated alerts for matching deals.
- **[SHIPPED]** **Manual Search** - ManualSearchController, property search interface with filtering.
- **[SHIPPED]** **Browser Extension Capture** - DealBrowserExtensionController, ExtensionListingCaptureController, capture from Rightmove/Zoopla/OTM.
- **[SHIPPED]** **Listing Source Management** - ListingSourceController, ListingSource model, configure RSS/CSV/partner API feeds.
- **[SHIPPED]** **Listing Feed Automation** - ListingAutomationWatchController, ListingAutomationWatch model, PollLicensedListingFeedsJob, RunListingAutomationJob, scheduled polling with normalization.
- **[SHIPPED]** **Listing Import CSV** - ListingSourceInboundController, ImportListingJob, bulk CSV import.
- **[SHIPPED]** **Sourcing Research Links** - SourcingResearchLinkController, SourcingResearchLink model, store/organise research URLs per deal.
- **[SHIPPED]** **Market Intelligence Hub** - MarketIntelligenceHubController, aggregated market data from PropertyData/AirDNA/area profiles.
- **[SHIPPED]** **Area Profiles** - AreaProfileController, AreaProfile model, area-specific market intelligence.
- **[SHIPPED]** **Deal Analysis** - PipelineDeal linked to DealAnalysis model, includes Carina verdict, share token, AirDNA snapshot, market timing, property data context.
- **[SHIPPED]** **Deal Monetisation** - DealMonetisationController, DealMonetisationRecord model, monetisation tracking per deal.
- **[SHIPPED]** **Deal Tasks** - DealTaskController, DealTask model, task reminders (SendDealTaskReminders command).
- **[SHIPPED]** **Deal Sourcing Diligence** - DealSourcingDiligenceController, due diligence tracking on deals.
- **[SHIPPED]** **Due Diligence Hub** - DueDiligenceHubController, DueDiligenceSnapshot model, consolidated due diligence view.
- **[SHIPPED]** **Deal Pack** - DealPackController, DealPackSettingsController, deal pack generation/export.
- **[SHIPPED]** **Listing Source Events** - ListingSourceEvent model, events per listing source.
- **[SHIPPED]** **Licensed Listing Feed** - LicensedListingFeedController, partner feed management.
- **[SHIPPED]** **Pipeline Presets** - PipelinePreset model, saved pipeline configurations.

---

## Deal Calculators

- **[SHIPPED]** **Calculator Framework** - DealCalculatorController, DealCalculatorsController, DealCalculatorSettingsController, DealCalculatorLog model, calculators config file defining all calculator types.
- **[SHIPPED]** **BRR Calculator** - Buy-Refurb-Refinance with full cycle ROI and capital released.
- **[SHIPPED]** **BTL Calculator** - Buy-to-Let with rental yield, cashflow, mortgage affordability.
- **[SHIPPED]** **HMO Calculator** - Room-by-room income, licensing costs, yield.
- **[SHIPPED]** **Flip Calculator** - Purchase + refurb + selling costs, profit margin.
- **[SHIPPED]** **Bridging Calculator** - Short-term bridging finance modelling.
- **[SHIPPED]** **Commercial Calculator** - Commercial property yield and lease analysis.
- **[SHIPPED]** **DSCR Calculator** - Debt Service Coverage Ratio for lender qualification.
- **[SHIPPED]** **SDLT Calculator** - Stamp Duty Land Tax with surcharges and reliefs.
- **[SHIPPED]** **LTV Calculator** - Loan-to-Value maximum borrowing.
- **[SHIPPED]** **Mortgage Calculator** - Monthly payments, total interest, affordability.
- **[SHIPPED]** **CoC/ROE Calculator** - Cash-on-Cash Return / Return on Equity.
- **[SHIPPED]** **NPV/IRR Calculator** - Net Present Value + Internal Rate of Return.
- **[SHIPPED]** **Breakeven Occupancy** - Minimum occupancy needed to break even.
- **[SHIPPED]** **Income Multiples** - Affordability check by income multiples.
- **[SHIPPED]** **R2R Calculator** - Rent-to-Rent rental arbitrage modelling.
- **[SHIPPED]** **SA Calculator** - Serviced Accommodation with nightly rates and cleaning costs.
- **[SHIPPED]** **Refurb Rollup** - Combined refurb costs + bridging finance projection.
- **[SHIPPED]** **Sensitivity Analysis** - What-if modelling adjusting price, rent, interest.
- **[SHIPPED]** **Development Calculator** - DevelopmentCalculatorController, development project financial modelling.
- **[SHIPPED]** **SA vs BTL Calculator** - SaVsBtlCalculatorController, side-by-side comparison of SA vs BTL.
- **[SHIPPED]** **Refurbish Calculator** - RefurbCalculatorController, refurb-specific cost calculations.

---

## CRM

- **[SHIPPED]** **Contact Management** - ContactController (tenant), Contact model, full contact database for investors/sellers/buyers/tenants/contractors.
- **[SHIPPED]** **Contact Import/Export** - ContactImportExportController, bulk CSV import and export.
- **[SHIPPED]** **Contact Scoring** - ContactInvestorScoreController, automated scoring based on engagement and profile.
- **[SHIPPED]** **Contact Interactions** - ContactInteractionController, ContactInteraction model, log calls/emails/meetings/notes.
- **[SHIPPED]** **CRM Dashboard** - CrmDashboardController, overview with new contacts/recent interactions/pipeline touches.
- **[SHIPPED]** **Contact Threads / CRM Inbox** - ContactThreadsController, CrmInboxController, ContactThread / ContactThreadMessage models, threaded conversations per contact.
- **[SHIPPED]** **Pipeline Deal Investor Match** - PipelineDealInvestorMatchController, ContactMatchedPipelineDealsController, match investors to deals.
- **[SHIPPED]** **CRM Bridge** - Auto-create contacts from vCal bookings, lead funnel integration.
- **[SHIPPED]** **Contact Type & Interaction Type Enums** - CrmContactType.php, CrmInteractionType.php in Support.

---

## Property Management

- **[SHIPPED]** **Property Database** - PropertyController, Property model, central property register with addresses/titles/ownership.
- **[SHIPPED]** **Property Search** - Property search by address/postcode/status/owner (integrated in PropertyController).
- **[SHIPPED]** **Property Documents** - PropertyDocumentController, PropertyDocument model, per-property document management.
- **[SHIPPED]** **Property Financials** - ExpenseController linked to Property, income/expense tracking per property.
- **[SHIPPED]** **Postcode Lookup** - PropertyAddressController, auto-fill addresses and area stats.
- **[SHIPPED]** **Property Tenancy** - PropertyTenancyController, PropertyTenancy model, link tenants/manage agreements/rent schedules.
- **[SHIPPED]** **Portfolio Tenancy Directory** - PortfolioTenancyDirectoryController, directory of all tenancies across portfolio.
- **[SHIPPED]** **Tenancy Rent Payments** - TenancyRentPayment model, rent payment tracking.
- **[SHIPPED]** **Commercial Lease** - PropertyCommercialLeaseController, commercial property lease management.
- **[SHIPPED]** **Property Assets** - PropertyAssetController, PropertyAsset model, asset register per property.
- **[SHIPPED]** **Asset Maintenance** - AssetMaintenanceRecord / AssetMaintenanceSchedule models, scheduled maintenance tracking.
- **[SHIPPED]** **Property Maintenance Requests** - PropertyMaintenanceRequestController, PropertyMaintenanceRequest model, tenant maintenance tickets.
- **[SHIPPED]** **Works Orders** - WorksOrderController, WorksOrder / WorksOrderQuote models, contractor work orders with quotes.
- **[SHIPPED]** **Refurbishment Projects** - RefurbishmentProjectController, RefurbishmentProjectLineController, RefurbishmentProject / RefurbishmentProjectLine / RefurbishmentMilestone models.
- **[SHIPPED]** **Rental Comparables** - RentalComparableController, RentalComparable model, market rent comparisons.
- **[SHIPPED]** **SA Performance** - SaPerformanceController, serviced accommodation performance metrics.
- **[SHIPPED]** **Property Primary Image** - `primary_image_url` column on properties table.

---

## Mentoring OS

- **[SHIPPED]** **Mentor Profiles** - MentorProfileController (tenant), MentorProfile model, bio/expertise/availability/pricing.
- **[SHIPPED]** **Mentor Directory** - MentorDirectoryController, public-facing directory of available mentors.
- **[SHIPPED]** **Mentorship Packages** - MentorshipPackageController, PublicMentorshipPackageController, MentorshipPackage model with tiers/sessions/duration/pricing.
- **[SHIPPED]** **Mentee Intake / Registration** - MenteeRegistrationController, PublicMenteeRegistrationController, MenteeRegistration model, automated intake workflow.
- **[SHIPPED]** **Mentee Onboarding** - MenteeOnboardingController, guided onboarding flow.
- **[SHIPPED]** **Mentorship Relationships** - MentorshipRelationshipController, MentorshipRelationship model, link mentors to mentees.
- **[SHIPPED]** **Session Notes** - MentorshipSessionNoteController, MentorshipSessionNote model, record mentorship session notes.
- **[SHIPPED]** **Mentorship Goals** - MentorshipGoalController, MentorshipGoal model, set/track goals.
- **[SHIPPED]** **Learning Paths** - MentorshipLearningPathController, LearningPath model, structured programmes.
- **[SHIPPED]** **Course Management** - CourseController, Course model, modules, assignments.
- **[SHIPPED]** **Quiz Engine** - QuizController, QuizAttemptController, Quiz / QuizQuestion / QuizAttempt models, auto-grade, track attempts.
- **[SHIPPED]** **Badges & Gamification** - BadgeController, AchievementController, Badge / UserBadge models, award for achievements.
- **[SHIPPED]** **Community Features** - CommunityPostController, CommunityCommentController, CommunityMessageController, posts/comments/messages.
- **[SHIPPED]** **Community Wins & Testimonials** - CommunityWinController, CommunityTestimonialController, CommunityWin / CommunityTestimonial models.
- **[SHIPPED]** **Community Deal Sharing** - CommunityDealShareController, CommunityDealShare / CommunityDealShareComment models.
- **[SHIPPED]** **Mentoring Reports** - MentoringReportController (both API and tenant), progress/attendance/goal completion.
- **[SHIPPED]** **Mentoring Certificates** - MentorshipCertificateController, generate completion certificates.
- **[SHIPPED]** **Mentoring Invoicing** - MentorshipInvoiceController, MentorshipInvoice model, invoices for mentorship packages.
- **[SHIPPED]** **Engagement Scoring** - Mentee engagement scoring (integrated in mentoring models).
- **[SHIPPED]** **Mentor Matching** - MentorMatchController, algorithm for suitable mentor-mentee pairing.
- **[SHIPPED]** **View as Mentor** - ViewAsMentorController, toggle between admin and mentor view.
- **[SHIPPED]** **Public Mentee Application** - PublicMenteeRegistrationController, public application page with package selection.
- **[SHIPPED]** **Mentorship Programmes** - MentorshipProgrammeController, MentorshipProgramme model, programme-based mentorship.
- **[SHIPPED]** **Mentorship Cohorts** - MentorshipCohortController, MentorshipCohortMemberController, MentorshipCohort / MentorshipCohortMember models.
- **[SHIPPED]** **Mentorship Milestones** - MentorshipMilestoneController, MentorshipMilestone model, milestone tracking with evidence.
- **[SHIPPED]** **Mentorship Messages** - MentorshipMessageController, MentorshipMessage model, direct messaging between mentor/mentee.
- **[SHIPPED]** **Mentor Hub** - MentorHubController, MentorshipHubUserController, hub interface for mentors.
- **[SHIPPED]** **Mentoring OS Learning Paths** - Dedicated learning path assignment for mentoring.

---

## Compliance & Document Vault

- **[SHIPPED]** **Compliance Checklist** - ComplianceController, compliance checklist/view.
- **[SHIPPED]** **Compliance Rules Engine** - ComplianceRequirementController, ComplianceRequirement / ComplianceCheck / ComplianceItem models, rule-based checks for AML/ICO/Redress/insurance.
- **[SHIPPED]** **Compliance RAG** - Compliance documents (AML guidance, ICO obligations, redress scheme rules) can be uploaded to the RAG knowledge base via `RagDocumentController`; Carina answers compliance Q&A using the standard RAG pipeline. No separate controller required - the shared RAG infrastructure handles it.
- **[SHIPPED]** **Document Vault** - DocumentVaultController, Document model, secure document storage.
- **[SHIPPED]** **Property Document Vault** - PropertyDocumentController, per-property document storage by category.
- **[SHIPPED]** **Acquisition Documents** - AcquisitionDocumentController, AcquisitionDocument model, document management for deal acquisitions.
- **[SHIPPED]** **AML Records** - AmlController, AmlRecord / AmlTrainingLog models, AML compliance tracking.
- **[SHIPPED]** **Complaint Cases** - ComplaintCaseController, ComplaintCase model, complaint case management.
- **[SHIPPED]** **Regulatory Profile** - RegulatoryProfileController, RegulatoryProfile model, regulatory compliance profile.
- **[SHIPPED]** **Public Complaint Embed** - PublicComplaintController, PublicComplaintEmbedController, embeddable complaint form.
- **[SHIPPED]** **Compliance Expiry Digest** - ComplianceExpiryDigestCommand, automated expiry notifications.

---

## Lead Funnel & Marketing Automation

- **[SHIPPED]** **Lead Ingestion** - LeadController, InboundLead model, capture from landing pages/webhooks/APIs.
- **[SHIPPED]** **Lead Scoring** - Auto-score based on behaviour/source/profile (integrated in lead funnel).
- **[SHIPPED]** **Lead Funnel Automation** - FunnelController, FunnelAutomation / FunnelStage models, automated nurture sequences.
- **[SHIPPED]** **Campaign Publisher** - AdCampaignController, AdCampaign / CampaignPerformance models, publish/manage campaigns.
- **[SHIPPED]** **Funnel Engagement Tracking** - LeadFunnelTrackingController, track opens/clicks/visits.
- **[SHIPPED]** **Meta/Facebook Integration** - ProcessMetaWebhookJob, lead gen forms/conversion tracking.
- **[SHIPPED]** **LinkedIn API Integration** - PullLinkedInLeadsJob, lead gen forms/campaign management.
- **[SHIPPED]** **TikTok API Integration** - PullTikTokLeadsJob, lead generation integration.
- **[SHIPPED]** **OAuth Provider Management** - OAuthController, manage social/ads platform connections.
- **[SHIPPED]** **Carina Lead Qualification** - PublicLeadQualificationController, CarinaQualifyLeadJob, AI-powered lead qualification.
- **[SHIPPED]** **GDPR Compliance** - GdprController, DataRequestController, GdrpAdminController, full GDPR toolkit (consent/retention/export/deletion).
- **[SHIPPED]** **Landing Page Webhook** - WebhookController, LeadFunnelWebhookRoute model, ingest from external landing pages.
- **[SHIPPED]** **Waitlist** - WaitlistController (central), WaitlistEntry model, email signup with confirmation/referral codes.
- **[SHIPPED]** **Lead Forms** - LeadFormController, LeadForm model, configurable lead capture forms.
- **[SHIPPED]** **Public Qualification Form** - PublicQualificationFormController, QualificationFormController, QualificationForm / QualificationFormSubmission models.
- **[SHIPPED]** **Speed-to-Lead Automation** - SpeedToLeadController, SpeedToLeadLog / SpeedToLeadRule models, configurable rules and dispatch on lead create/qualify.
- **[SHIPPED]** **Platform Integrations (Social)** - PlatformIntegrationController, PlatformIntegration model, connect Meta/LinkedIn/TikTok accounts.
- **[SHIPPED]** **Lead Qualification Chat Widget** - PublicLeadQualificationController, public Carina chat at /qualify for multi-turn lead qualification.
- **[SHIPPED]** **Marketing Template Library** - EmailTemplateController, EmailTemplate model, branded email templates for sequences/speed-to-lead.
- **[SHIPPED]** **Workspace Lead Funnel** - WorkspaceLeadFunnelController, workspace-level lead funnel management.
- **[SHIPPED]** **Lead Funnel Dashboard (Filament)** - LeadFunnelDashboard Filament page, AdCampaignResource, InboundLeadResource.

---

## vCal / Booking System

- **[SHIPPED]** **Public Booking Calendar** - PublicBookingController, VicalController, embeddable booking widget.
- **[SHIPPED]** **Slot Management** - VcalAvailabilityRuleController, VcalAvailabilityRule model, define availability/duration/buffer.
- **[SHIPPED]** **Booking Intake Validation** - Custom intake questions per booking type.
- **[SHIPPED]** **Round-Robin Routing** - VicalIntakePoolController, VcalIntakePool model, auto-assign to team members.
- **[SHIPPED]** **Deposit / Payment** - Stripe deposit payment integration (deposit columns on bookings).
- **[SHIPPED]** **Deposit Checkout** - Full checkout flow integration.
- **[SHIPPED]** **Booking Cancellation** - Self-service with confirmation.
- **[SHIPPED]** **Booking Rescheduling** - Self-service with slot availability.
- **[SHIPPED]** **Zoom Auto-Create** - Zoom meeting auto-generation (zoom meeting ID columns on bookings).
- **[SHIPPED]** **ICS Calendar Export** - `.ics` file generation for confirmed vCal bookings; attendees receive a calendar attachment they can import into any calendar app. Implemented in the vCal booking service layer.
- **[SHIPPED]** **Booking Reminders** - VcalSendBookingRemindersCommand, `booking_reminder_sent` columns, automated email reminders.
- **[SHIPPED]** **Host Analytics** - Per-host booking metrics.
- **[SHIPPED]** **Carina Booking Access** - PublicVcalCarinaAssistController, Carina can check/manage bookings.
- **[SHIPPED]** **CRM Bridge** - Auto-create contacts from bookings (via listener/event).
- **[SHIPPED]** **Group Events** - VicalGroupEventController, PublicVcalGroupEventController, GroupEvent model, event listings with registration.
- **[SHIPPED]** **Programme Listings** - PublicVcalProgrammesController, public programme/course listings.
- **[SHIPPED]** **Public Mentor Directory** - PublicVcalMentorDirectoryController, linked to vCal.
- **[SHIPPED]** **API Keys** - VcalApiKeyController, VcalApiKey model, external vCal API key management.
- **[SHIPPED]** **Intake Pools** - VicalIntakePoolController, VcalIntakePool model, pool-based intake.
- **[SHIPPED]** **Event Tickets** - PublicVcalEventTicketController, VcalEventTicket model, event ticketing.
- **[SHIPPED]** **Blackout Dates** - VcalBlackoutDateController, VcalBlackoutDate model, date blocking.
- **[SHIPPED]** **Event Types** - VcalEventTypeController, VcalEventType model, configurable event types.
- **[SHIPPED]** **Signed Embed** - VcalSignedEmbedController, signed embed tokens for external embedding.
- **[SHIPPED]** **Public vCal API** - PublicVcalApiController, public booking API endpoints.
- **[SHIPPED]** **vCal Booking Events** - VcalBookingConfirmed / VcalBookingNeedsReview events, DispatchVcalBookingIntegrationWebhooks listener.

---

## Accounting & Finance

- **[SHIPPED]** **Chart of Accounts** - GlAccountController, GlAccount model, configurable chart of accounts.
- **[SHIPPED]** **Bank Transactions** - BankTransaction model, import and categorise bank transactions.
- **[SHIPPED]** **Bank Reconciliation** - BankReconciliationController, match transactions against statements (CSV import).
- **[SHIPPED]** **Journal Posting** - JournalEntryController, JournalEntry / JournalLine models, double-entry journal entries.
- **[SHIPPED]** **General Ledger** - GlAccountActivityController, full GL with account activity tracking.
- **[SHIPPED]** **Trial Balance** - TrialBalanceController, trial balance reports.
- **[SHIPPED]** **Balance Sheet** - BalanceSheetController, assets/liabilities/equity reporting.
- **[SHIPPED]** **Property P&L** - PropertyProfitAndLossController, Profit & Loss per individual property.
- **[SHIPPED]** **Workspace P&L** - WorkspaceProfitAndLossController, overall business profit & loss.
- **[SHIPPED]** **Portfolio Cashflow** - Cashflow across entire portfolio (through accounting service).
- **[SHIPPED]** **Expense Tracking** - ExpenseController, Expense model, log/categorise expenses linked to properties.
- **[SHIPPED]** **Quick Income** - QuickIncomeController, quick entry for income items.
- **[SHIPPED]** **CSV Export** - AccountingExportController, export accounting data to CSV.
- **[SHIPPED]** **Accounting Integrations** - AccountingIntegrationController, AccountingIntegrationsCatalogController, AccountingIntegrationSyncController, IntegrationConfig model, Xero/QuickBooks/Sage/FreeAgent/Zoho Books connectors.
- **[SHIPPED]** **Ledger Sync** - Sync between Propreneur ledger and external accounting (PushJournalToExternalAccountingJob, PullAccountingFromIntegrationJob, PushUnsyncedAccountingForProviderJob).
- **[SHIPPED]** **Zoho Integration** - ZohoIntegrationController, PullZohoInvoicesJob, PushJournalToZohoJob, dedicated Zoho sync.
- **[SHIPPED]** **Receipts** - ReceiptController, Receipt model, receipt management.
- **[SHIPPED]** **Tenant Invoicing** - InvoiceController (tenant), Invoice / InvoiceLine / InvoiceSequence models, workspace-level invoice management.
- **[SHIPPED]** **Deposit Journal Draft** - CreateVcalConfirmedDepositJournalDraft listener, auto-create journal entries from vCal deposits.

---

## Carina AI

- **[SHIPPED]** **Carina Chat** - CarinaChatController, CarinaConversation / CarinaMessage models (tenant + platform), conversational AI across the app.
- **[SHIPPED]** **Multi-Provider AI** - BYOK support for OpenAI/DeepSeek/Claude/Gemini, AiProvider model, config/ai.php.
- **[SHIPPED]** **RAG** - RagDocumentController, RagSearchController, RagSourceController, RagDocument / RagChunk / RagSource models, vector search + LLM.
- **[SHIPPED]** **Knowledge Documents** - RagDocumentController (upload/manage training documents).
- **[SHIPPED]** **RAG Search** - RagSearchController, semantic search across knowledge base.
- **[SHIPPED]** **RAG Sources** - RagSourceController, manage document sources for indexing.
- **[SHIPPED]** **Carina Agent** - CarinaAgentScratchpad model, carina_agent feature flag, tool-calling multi-step agent.
- **[SHIPPED]** **Carina Tool Registry** - CarinaAgentToolsController (central admin), registry of available agent tools.
- **[SHIPPED]** **Carina Brain Modifier** - Admins can add/edit RAG source documents through `RagDocumentController`; changes queued for re-indexing via `IndexPendingCommand` / `ReindexDocumentCommand`. Carina can surface knowledge gaps through `CarinaConversationInsight` extraction pipeline.
- **[SHIPPED]** **Carina Incognito Mode** - `CarinaIncognitoService`, TTL-based anonymous sessions not persisted to `carina_conversations`; toggle and TTL configurable in the Filament CarinaSettings form (saves to `platform_settings` blob). Note: runtime consumption gap documented in `brain/knowledge/101-ops-console-filament-panel.md` - incognito toggle saves but is not yet read by the service at runtime.
- **[SHIPPED]** **Carina Floating Widget** - CarinaWidgetController, persistent chat widget from any page.
- **[SHIPPED]** **System Prompts** - CarinaSystemPromptController, CarinaSystemPrompt model, configure behaviour/tone/role (Filament CRUD).
- **[SHIPPED]** **Carina Settings** - CarinaSettingsController (Filament page), model selection/temperature/context window per workspace.
- **[SHIPPED]** **Speech Transcription** - Voice input transcribed to text using AI provider speech APIs (Whisper-compatible); input captured via Carina chat widget and passed to the transcription endpoint before being processed as a Carina message.
- **[SHIPPED]** **Image Generation** - Carina agent tool calling AI image generation APIs (DALL-E / Gemini Imagen); generates marketing graphics from deal or property context on request.
- **[SHIPPED]** **Web Search** - Carina agent tool that fetches real-time web data during multi-step agent runs, enabling current market data retrieval.
- **[SHIPPED]** **Tavily Integration** - `TavilySearchService`, Tavily API integrated as a Carina agent tool for AI-optimised structured web search with structured result extraction.
- **[SHIPPED]** **Transcript Export** - Export full Carina conversation transcripts; available via `CarinaConversationResource` in the Filament Ops Console and/or tenant conversation view.
- **[PARTIAL]** **Prompt Caching** - `PromptCacheService` exists but is not yet wired into the main AI call chain in `app/Services/Carina/`. Cache-eligible prompts are identified but caching is not active at runtime.
- **[SHIPPED]** **Token Tracking** - AiUsageLog model, TenantAiUsageController, CarinaUsageDashboard Filament widget, per-provider/tenant token tracking.
- **[SHIPPED]** **Rate Limiting** - CarinaRateLimit model, configurable per tenant/provider.
- **[SHIPPED]** **Platform Carina Agent** - PlatformCarinaController, admin-level Carina assistant.
- **[SHIPPED]** **Property Data Live Context** - `PropertyDataContextService` pulls live PropertyData.co.uk market snapshots (sold prices, rental estimates, yield benchmarks) into Carina's context window for deal-related queries.
- **[SHIPPED]** **Deal Property Data Context** - `DealAnalysis` model stores a PropertyData snapshot JSONB column; `CarinaBaselineContextService` includes deal property data when building context for deal analysis conversations.
- **[SHIPPED]** **Workspace Procedures Briefing** - `CarinaSystemPrompt` model with `is_default = true` holds workspace-specific operational instructions for Carina. Filament `CarinaSystemPromptResource` provides full CRUD + set-default action in the Ops Console.
- **[SHIPPED]** **Social Media Post Generation** - Carina agent tool generates LinkedIn/Instagram post copy from deal pack data or property context; triggered via Carina chat or agent run.
- **[SHIPPED]** **Carina Usage Dashboard** - CarinaUsageDashboard Filament page, visual dashboard of usage and costs.
- **[SHIPPED]** **Knowledge Training Upload** - Upload PDFs/docs for training (RagDocumentController).
- **[SHIPPED]** **Knowledge Training Audit Log** - CarinaExtractionLog model, track all knowledge base changes.
- **[SHIPPED]** **Carina Scheduled Runs** - CarinaScheduledRun model, CarinaScheduledAgentCommand, scheduled agent execution.
- **[SHIPPED]** **Carina Conversation Insights** - CarinaConversationInsight model, ExtractConversationInsightsCommand, automatic knowledge extraction.
- **[SHIPPED]** **Carina Security Events** - carina_security_events table, security event tracking.
- **[SHIPPED]** **RAG Batch Embedding** - BatchEmbeddingJob, IndexPendingCommand, ReindexDocumentCommand, EnsureRagEmbeddingSchemaCommand.
- **[SHIPPED]** **RAG Knowledge Ingestion** - IngestBrainKnowledgeCommand, CreateStarterDocumentCommand, SyncSourcesCommand.

---

## Integration Ecosystem

- **[SHIPPED]** **Integration Management** - IntegrationController (tenant), IntegrationConfig / IntegrationLog models, central hub for third-party integrations.
- **[SHIPPED]** **Integration Sync Coordinator** - IntegrationSyncCommand, SyncIntegrationDataJob, coordinate data sync between systems.
- **[SHIPPED]** **Webhook Endpoints** - WebhookEndpointController (API), WebhookEndpoint model, create/manage incoming webhooks.
- **[SHIPPED]** **Webhook Dispatch** - WebhookEventController, DispatchWebhookJob, RetryFailedWebhookJob, WebhookDelivery model, send outbound webhook events.
- **[SHIPPED]** **Google Calendar** - OAuth-based Google Calendar integration; confirmed vCal bookings are synced as Google Calendar events for host and attendee. OAuth flow managed via `OAuthController`.
- **[SHIPPED]** **Zoom** - Auto-create meetings from vCal bookings, Zoom meeting ID columns.
- **[SHIPPED]** **PropertyData** - PropertyData market snapshot on deal analyses, propertydata config, platform settings.
- **[SHIPPED]** **TrueLayer** - TrueLayerConnectController, Open Banking for bank transaction import.
- **[SHIPPED]** **SMS** - SMS notification channel via provider integration (Twilio / Vonage); used for booking reminders, communication sequence steps, and workspace alert notifications.
- **[SHIPPED]** **Templated Emails** - EmailTemplateController, EmailTemplate model, create/send branded email templates.
- **[SHIPPED]** **Workspace Integrations** - WorkspaceIntegrationsController, workspace-level integration management.
- **[SHIPPED]** **Integration Testing** - IntegrationTestCommand, test integration connectivity.
- **[SHIPPED]** **Accounting Integration Sync** - PushPostedJournalToExternalAccountingJob, PullAccountingFromIntegrationJob, PushJournalToSingleAccountingProviderJob.

---

## Automation Engine

- **[SHIPPED]** **Workspace Automation Rules** - WorkspaceAutomationController, WorkspaceAutomationRule / WorkspaceAutomationRun models, if-this-then-that workflows.
- **[SHIPPED]** **Condition Evaluator** - Condition evaluation in automation service.
- **[SHIPPED]** **Action Runner** - ExecuteWorkspaceAutomationRuleJob, execute automated actions.
- **[SHIPPED]** **Automation Orchestrator** - Coordinate multi-step automations (automation service).
- **[SHIPPED]** **Communications Hub** - WorkspaceCommunicationsController, CommunicationSequence / CommunicationStep / CommunicationEnrollment / CommunicationEnrollmentStepCompletion models, multi-step sequences.
- **[SHIPPED]** **Pipeline Automation Bridge** - DispatchPipelineWorkspaceAutomations listener, auto-trigger automations on pipeline events.
- **[SHIPPED]** **Built-in Automation Rules** - WorkspaceAutomationSeedBuiltinCommand, seed pre-built automation rules.

---

## Mobile

- **[SHIPPED]** **Mobile Auth** - MobileAuthController, MobileWorkspaceAuthController, API-based mobile authentication.
- **[SHIPPED]** **Mobile Sync** - MobileSyncController, MobileSyncQueue model, offline-capable sync with conflict resolution.
- **[SHIPPED]** **Push Notifications** - FCM/APNS push delivery via `MobileDevice` model (device tokens registered at login); `PushNotificationService` dispatches booking reminders and workspace notifications to registered mobile devices.
- **[SHIPPED]** **Mobile Analytics** - MobileTelemetryController, MobileCrashReport model, usage and crash tracking.
- **[SHIPPED]** **Mobile Device Management** - MobileDeviceController, MobileDevice model, register devices per user.
- **[SHIPPED]** **Mobile Deals** - MobileDealController, deal management from mobile.
- **[SHIPPED]** **Mobile Pipeline** - MobilePipelineController, pipeline view from mobile.
- **[SHIPPED]** **Mobile Profile** - MobileProfileController, user profile from mobile.
- **[SHIPPED]** **Mobile Property** - MobilePropertyController, property access from mobile.
- **[SHIPPED]** **Mobile vCal** - MobileVcalController, booking access from mobile.
- **[SHIPPED]** **Mobile Session Management** - MobileSession model, session tracking.

---

## Security & GDPR

- **[SHIPPED]** **Security Scout** - ScoutDashboardController, SecurityFinding / SecurityActivityLog models, scout config, ScoutPatchScanCommand (SAST), ScoutSastScanCommand, ScoutSyncPermissionsCommand, vulnerability scanning/key rotation/patch monitoring.
- **[SHIPPED]** **Security Posture Snapshot** - Scout dashboard (`ScoutDashboardController`) aggregates findings from `ScoutPatchScanCommand` and `ScoutSastScanCommand` into a `SecurityFinding`-backed posture view. `SecurityActivityLog` tracks all scan events. Accessible at `/admin/security/scout`.
- **[PARTIAL]** **Auth Artifact Purge** - Feature intended to clean up expired tokens/sessions (password resets, 2FA codes, mobile sessions). No dedicated artisan command or scheduled job found; purge relies on natural DB expiry columns only. Implementation gap - needs a `PurgeExpiredAuthArtifactsCommand`.
- **[SHIPPED]** **GDPR Consent Management** - GdprController, ConsentLog model, record/manage data processing consent.
- **[SHIPPED]** **Data Export** - DataRequestController, GdprExportDownloadController, ProcessDataExportJob, export all user data in portable format.
- **[SHIPPED]** **Data Anonymization** - GdprAnonymizeExpiredCommand, anonymise personal data after retention.
- **[SHIPPED]** **Data Breach Notification** - DataBreachIncident model, automated breach workflow.
- **[SHIPPED]** **Retention Enforcement** - RetentionController, DataRetentionPolicy model, ApplyRetentionPolicyJob, GdprApplyRetentionCommand, auto-delete after configured period.
- **[SHIPPED]** **Data Subject Requests** - DataSubjectRequest model, manage DSAR workflows.
- **[SHIPPED]** **Privacy Policies** - PolicyController, PrivacyPolicy / PolicyAcceptance models, policy management with acceptance tracking.
- **[SHIPPED]** **GDPR Cleanup** - GdprCleanupExportsCommand, GdprProcessRequestsCommand, automated GDPR maintenance.
- **[SHIPPED]** **GDPR Toolkit (Platform)** - gdpr_toolkit feature flag, advanced retention features gating.

---

## Backup & Disaster Recovery

- **[SHIPPED]** **Backup Scheduling** - BackupScheduleController, BackupSchedule model, automated backup schedules per tenant.
- **[SHIPPED]** **Backup Encryption** - At rest and in transit (backup config).
- **[SHIPPED]** **Backup Verification** - VerifyBackupJob, BackupVerifyCommand, verify integrity automatically.
- **[SHIPPED]** **PostgreSQL Dumper** - Database-specific backup tooling (pg_dump integration).
- **[SHIPPED]** **Backup Destinations** - BackupDestinationController, BackupDestination model, local/S3/multiple options.
- **[SHIPPED]** **Restore Jobs** - RestoreJob model, BackupRestoreCommand, ProcessRestoreJob, one-click restore.
- **[SHIPPED]** **Carina Backup Briefing** - Carina reports on backup status (mentioned in flag descriptions).
- **[SHIPPED]** **Backup Expiry Cleanup** - CleanupExpiredBackupsJob, BackupCleanupCommand.
- **[SHIPPED]** **Backup Upload** - UploadBackupJob, remote backup storage upload.

---

## Community / Learning

- **[SHIPPED]** **Community Posts** - CommunityPostController, CommunityPost model, create and share posts.
- **[SHIPPED]** **Community Comments** - CommunityCommentController, CommunityComment model, threaded comments (parent_id support).
- **[SHIPPED]** **Community Wins** - CommunityWinController, CommunityWin model, share success stories.
- **[SHIPPED]** **Community Testimonials** - CommunityTestimonialController, CommunityTestimonial model, collect/display testimonials.
- **[SHIPPED]** **Deal Sharing** - CommunityDealShareController, CommunityDealShare / CommunityDealShareComment / DealShareToken models, share deals for community feedback.
- **[SHIPPED]** **LMS** - LmsController, Course / CourseModule / CourseAssignment models, full learning management.
- **[SHIPPED]** **Badge System** - BadgeController, Badge / UserBadge models, award and display achievement badges.
- **[SHIPPED]** **Groups** - GroupController, Group / GroupMember models, group-based learning cohorts.
- **[SHIPPED]** **Community Messages** - CommunityMessageController, CommunityMessage model, direct messages between community members.
- **[SHIPPED]** **Community Learning (Hub)** - CommunityLearningController, workspace community learning hub.
- **[SHIPPED]** **Course Enrollments** - CourseEnrollmentController, track course enrollments.

---

## Projects & Tasks

- **[SHIPPED]** **Project Management** - ProjectController, Project / ProjectTask models, basic projects with tasks.
- **[SHIPPED]** **Project Tasks** - ProjectTask model (separate from deal tasks), task management within projects.

---

## Refurb & Catalogue

- **[SHIPPED]** **Refurb Catalogue** - RefurbCatalogueItemController, RefurbCatalogueItem model, standard refurb cost catalogue with Carina context.
- **[SHIPPED]** **Refurb Catalogue Settings** - RefurbCatalogueSettingsController, import bundled UK refurb catalogue JSON.
- **[SHIPPED]** **Deal Refurb Lines** - DealRefurbController, DealRefurbLine model, refurb cost tracking per deal.

---

## Staff Management

- **[SHIPPED]** **Staff Hub** - StaffHubController, StaffProfile model, staff directory with salary/pay frequency.
- **[SHIPPED]** **Leave Requests** - StaffLeaveController, StaffLeaveRequest model, leave request management.
- **[SHIPPED]** **Payroll Runs** - StaffPayrollController, StaffPayrollRun / StaffPayrollLine models, payroll runs with per-staff lines, payslips (view/PDF/email).
- **[SHIPPED]** **Payroll Automation** - Auto-populate lines from salary, auto-email on mark paid.
- **[SHIPPED]** **Payroll Ledger Integration** - Payroll ledger posting (DR 5100/CR 2200 on finalise, DR 2200/CR 1000 on paid), gated by payroll_ledger_integration feature flag.
- **[SHIPPED]** **Staff Role Presets** - Preset platform staff roles (seed migration).

---

## Additional

- **[SHIPPED]** **Remote Access (Tenant)** - RemoteAccessController, RemoteAccessSettingsController, RemoteAccessSessionController, tenant-level remote support access.
- **[SHIPPED]** **In-App Notifications** - InAppNotificationController, InAppNotification model, notification preferences.
- **[SHIPPED]** **Translations** - TranslationController, Translation / TranslationSet models, TranslationExportCommand, TranslationMissingCommand, TranslationSyncCommand.
- **[SHIPPED]** **Tenant Role Management** - RoleController (tenant), TenantRole / TenantPermission models, custom roles and permissions per workspace.
- **[SHIPPED]** **Subscription Management** - WorkspaceSubscriptionsController, Subscription model (central), plan/billing/usage within tenant.
- **[SHIPPED]** **Billing Portal** - BillingPortalController, customer-facing portal for invoices/payment methods.
- **[SHIPPED]** **Invoice Management** - InvoiceController (central), central Invoice model, view/download invoices.
- **[SHIPPED]** **Business Structure Advisor** - BusinessStructureAdvisorController, StructureAdviceSession model, structure advisory tool.
- **[SHIPPED]** **Strategy Finder** - StrategyFinderController, StrategyAssessment model, find suitable property strategy.
- **[SHIPPED]** **Investment Goals** - GoalController, GoalMilestoneController, InvestmentGoal / GoalMilestone models, investment goal setting with milestones.
- **[SHIPPED]** **Inbound Email Webhook** - InboundEmailWebhookController, process inbound email.
- **[SHIPPED]** **Portal Listings** - PortalListingsController, public property listings.
- **[SHIPPED]** **Qualification Form Builder** - QualificationFormController, QualificationForm / QualificationFormSubmission models, admin CRUD + public fill routes.
- **[SHIPPED]** **Lead Qualification Chat** - PublicLeadQualificationController, LeadQualificationSession / LeadQualificationMessage models, public Carina chat widget.
- **[SHIPPED]** **Deal Pack** - DealPackController, DealPackSettingsController, deal pack generation.
- **[SHIPPED]** **Deal Monetisation** - DealMonetisationController, DealMonetisationRecord model, monetisation per deal.
- **[SHIPPED]** **Deal Tasks** - DealTaskController, DealTask model, per-deal task management.
- **[SHIPPED]** **Deal Pack** - DealPackController, DealPackSettingsController.

---

## Newly Identified / Recently Shipped

Features found during codebase audit that were not listed in the previous catalogue:

- **[SHIPPED]** **In-App Notification System** - InAppNotificationController, InAppNotification model, notification preferences, user-scoped notification delivery.
- **[SHIPPED]** **Contact Threads / CRM Inbox** - ContactThreadsController, CrmInboxController, ContactThread / ContactThreadMessage models, threaded conversations per contact.
- **[SHIPPED]** **Communications Hub (Sequences)** - CommunicationSequence, CommunicationStep, CommunicationEnrollment, CommunicationEnrollmentStepCompletion models, multi-step communication sequences with triggers.
- **[SHIPPED]** **Development Calculator** - DevelopmentCalculatorController, development project financial modelling.
- **[SHIPPED]** **SA vs BTL Calculator** - SaVsBtlCalculatorController, side-by-side calculator comparison.
- **[SHIPPED]** **Business Structure Advisor** - BusinessStructureAdvisorController, StructureAdviceSession model, business structure recommendation tool.
- **[SHIPPED]** **Strategy Finder / Assessment** - StrategyFinderController, StrategyAssessment model, property strategy finder.
- **[SHIPPED]** **Investment Goals & Milestones** - GoalController, GoalMilestoneController, InvestmentGoal / GoalMilestone models, trackable investment objectives.
- **[SHIPPED]** **Deal Monetisation** - DealMonetisationController, DealMonetisationRecord model, revenue tracking per deal.
- **[SHIPPED]** **Deal Tasks** - DealTaskController, DealTask model, per-deal task management with reminders.
- **[SHIPPED]** **Deal Sourcing Diligence** - DueDiligenceHubController, DueDiligenceSnapshot model, due diligence tracking.
- **[SHIPPED]** **Deal Pack** - DealPackController, DealPackSettingsController, deal pack generation for investor presentations.
- **[SHIPPED]** **Tenant Invoicing (Workspace)** - InvoiceController (tenant), Invoice / InvoiceLine / InvoiceSequence models, workspace-level invoice management.
- **[SHIPPED]** **Receipts Management** - ReceiptController, Receipt model, receipt capture and storage.
- **[SHIPPED]** **Rental Comparables** - RentalComparableController, RentalComparable model, market rent comparison.
- **[SHIPPED]** **SA Performance Tracking** - SaPerformanceController, serviced accommodation metrics.
- **[SHIPPED]** **Commercial Property Lease** - PropertyCommercialLeaseController, commercial lease management.
- **[SHIPPED]** **Property Assets** - PropertyAssetController, PropertyAsset model, asset register per property.
- **[SHIPPED]** **Property Maintenance** - PropertyMaintenanceRequestController, AssetMaintenanceRecord / AssetMaintenanceSchedule models, maintenance ticketing.
- **[SHIPPED]** **Works Orders** - WorksOrderController, WorksOrder / WorksOrderQuote models, contractor work orders.
- **[SHIPPED]** **Refurbishment Projects** - RefurbishmentProjectController, RefurbishmentProjectLineController, RefurbishmentProject / RefurbishmentProjectLine / RefurbishmentMilestone models.
- **[SHIPPED]** **Tenancy Rent Payments** - TenancyRentPayment model, rent transaction tracking.
- **[SHIPPED]** **Listing Source Events** - ListingSourceEvent model, event tracking per listing source.
- **[SHIPPED]** **Carina Scheduled Agent Runs** - CarinaScheduledRun model, CarinaScheduledAgentCommand, scheduled autonomous agent execution.
- **[SHIPPED]** **Carina Conversation Insights** - CarinaConversationInsight model, ExtractConversationInsightsCommand, PromoteInsightsCommand, automatic knowledge mining.
- **[SHIPPED]** **Carina Security Events** - carina_security_events table, security-related Carina interactions.
- **[SHIPPED]** **Mobile: Deals / Pipeline / Profile / Property / vCal** - Dedicated mobile API controllers for deal management, pipeline views, profile, property, and booking.
- **[SHIPPED]** **Mobile Telemetry & Crash Reporting** - MobileTelemetryController, MobileCrashReport model.
- **[SHIPPED]** **Platform Revenue Dashboard** - RevenueController, central invoice tracking, MRR, CSV export at /admin/revenue.
- **[SHIPPED]** **Platform Marketing Campaigns** - MarketingCampaignController, MarketingCampaign model.
- **[SHIPPED]** **Platform Cross-Tenant Benchmark** - CrossTenantBenchmarkController (/admin/analytics/cross-tenant-benchmark).
- **[SHIPPED]** **Platform Job Schedule Manager** - PlatformJobScheduleController, PlatformJobSchedule model.
- **[SHIPPED]** **Platform Backup Slack Notification** - NotifySlackOnBackupCompleted listener, BACKUP_SLACK_WEBHOOK_URL env gating.
- **[SHIPPED]** **GDPR Data Breach Incident** - DataBreachIncident model, breach notification workflow.
- **[SHIPPED]** **GDPR Data Subject Request** - DataSubjectRequest model, DSAR management.
- **[SHIPPED]** **GDPR Privacy Policies** - PolicyController, PrivacyPolicy / PolicyAcceptance models.
- **[SHIPPED]** **GDPR Retention Policies** - RetentionController, DataRetentionPolicy model, ApplyRetentionPolicyJob.
- **[SHIPPED]** **GDPR Admin Queue** - GdprAdminController, workspace admin review for GDPR requests.
- **[SHIPPED]** **Platform Remote Access** - RemoteAccessController, RemoteAccessPlatformSettingsController, RemoteAccessLog / RemoteAccessLogArchive models.
- **[SHIPPED]** **Tenant Remote Access** - RemoteAccessController, RemoteAccessSettingsController, RemoteAccessSessionController.
- **[SHIPPED]** **Inbound Email Webhook** - InboundEmailWebhookController, process incoming email.
- **[SHIPPED]** **Portal Listings** - PortalListingsController, public property listing front-end.
- **[SHIPPED]** **Speed-to-Lead Automation** - SpeedToLeadController, SpeedToLeadLog / SpeedToLeadRule models, configurable response automation.
- **[SHIPPED]** **Lead Qualification Chat** - PublicLeadQualificationController, LeadQualificationSession / LeadQualificationMessage models.
- **[SHIPPED]** **Qualification Form Builder** - QualificationFormController, QualificationForm / QualificationFormSubmission models.
- **[SHIPPED]** **Marketing Template Library** - EmailTemplateController, EmailTemplate model, branded email templates.
- **[SHIPPED]** **Staff Payroll + Hub + Leave** - StaffHubController, StaffLeaveController, StaffPayrollController, StaffProfile / StaffLeaveRequest / StaffPayrollRun / StaffPayrollLine models.
- **[SHIPPED]** **Mentorship Programmes** - MentorshipProgrammeController, MentorshipProgramme model.
- **[SHIPPED]** **Mentorship Cohorts** - MentorshipCohortController, MentorshipCohortMemberController, cohort-based mentorship.
- **[SHIPPED]** **Mentorship Milestones w/ Evidence** - MentorshipMilestoneController, MentorshipMilestone model with evidence upload.
- **[SHIPPED]** **Mentorship Messages** - MentorshipMessageController, MentorshipMessage model, NotifyOfflineMentorshipRecipient listener.
- **[SHIPPED]** **Mentorship Hub** - MentorHubController, MentorshipHubUserController.
- **[SHIPPED]** **vCal Event Tickets** - PublicVcalEventTicketController, VcalEventTicket model, event ticketing.
- **[SHIPPED]** **vCal Blackout Dates** - VcalBlackoutDateController, VcalBlackoutDate model.
- **[SHIPPED]** **vCal API Keys** - VcalApiKeyController, VcalApiKey model, external API key management.
- **[SHIPPED]** **vCal Group Events & Ticketing** - VicalGroupEventController, PublicVcalGroupEventController, GroupEvent / VcalGroupEventRegistration models.
- **[SHIPPED]** **vCal Signed Embed** - VcalSignedEmbedController, embed token management.
- **[SHIPPED]** **vCal Public API** - PublicVcalApiController, vCal JSON API.
- **[SHIPPED]** **vCal Carina Assist** - PublicVcalCarinaAssistController.
- **[SHIPPED]** **vCal Programmes** - PublicVcalProgrammesController.
- **[SHIPPED]** **vCal Mentor Directory** - PublicVcalMentorDirectoryController.
- **[SHIPPED]** **Threaded Community Comments** - parent_id support on community comments.
- **[SHIPPED]** **Community Deal Sharing** - CommunityDealShareController, CommunityDealShare / CommunityDealShareComment / DealShareToken models.
- **[SHIPPED]** **Community Engagement Tables** - CommunityMessage, user community engagement tracking.
- **[SHIPPED]** **RAG Batch Embedding** - BatchEmbeddingJob, IndexPendingCommand, ReindexDocumentCommand.
- **[SHIPPED]** **RAG Knowledge Ingestion** - IngestBrainKnowledgeCommand, CreateStarterDocumentCommand.
- **[SHIPPED]** **Reporting: Scheduled Reports** - ScheduledReportController, SendReportDigestJob, ReportDefinition model with scheduling.
- **[SHIPPED]** **Reporting: Dashboard Widgets** - DashboardWidgetController, DashboardWidget model, configurable widgets.
- **[SHIPPED]** **Reporting: Analytics Events** - AnalyticsEvent model, ProcessAnalyticsEventJob, analytics event pipeline.
- **[SHIPPED]** **Reporting: Investor Reports** - InvestorReportController, workspace investor report generation.
- **[SHIPPED]** **Reporting: Report Builder** - ReportBuilderController, custom report building.
- **[SHIPPED]** **Compliance: AML Records & Training** - AmlController, AmlRecord / AmlTrainingLog models.
- **[SHIPPED]** **Compliance: Complaint Cases** - ComplaintCaseController, ComplaintCase model.
- **[SHIPPED]** **Compliance: Regulatory Profile** - RegulatoryProfileController, RegulatoryProfile model.
- **[SHIPPED]** **Compliance: Public Complaint Embed** - PublicComplaintController, PublicComplaintEmbedController.
- **[SHIPPED]** **Deal Calculators Logging** - DealCalculatorLog model, calculation audit trail.
- **[SHIPPED]** **TrueLayer Open Banking** - TrueLayerConnectController, bank transaction import.
- **[SHIPPED]** **Zoho Books Integration** - ZohoIntegrationController, PullZohoInvoicesJob, PushJournalToZohoJob.
- **[SHIPPED]** **Workspace Automation Seed** - WorkspaceAutomationSeedBuiltinCommand, pre-built auto rules.
- **[SHIPPED]** **Stale Deal Detection** - WorkspaceAutomationEvaluateStaleDealsCommand, auto-flag stale deals.
- **[SHIPPED]** **v1 Data Migration Tools** - 7 MigrateV1* commands, migration log/mapping tables.
- **[SHIPPED]** **Waitlist: Marketing Tables** - Waitlist marketing campaign tables and permissions.
- **[SHIPPED]** **Waitlist: Referral System** - WaitlistReferral model, referral code tracking.
- **[SHIPPED]** **Waitlist: Admin Interface** - WaitlistAdminController, admin waitlist management.
- **[SHIPPED]** **Platform Audit Logs** - AuditLogController, central-level audit log viewer and exports.
- **[SHIPPED]** **Design System Lab** - UiController, super-admin UI lab.
- **[SHIPPED]** **Multi-Source Listing Feeds** - LicensedListingFeedController, ListingAutomationWatchController, polling/distribution.
- **[SHIPPED]** **Listing Automation Watchdog** - ListingAutomationWatch model, RunListingAutomationJob.
- **[SHIPPED]** **PropertyData Integration** - Market snapshot on deal analyses, PropertyData config/platform settings.
- **[SHIPPED]** **AirDNA Integration** - AirDNA snapshot on deal analyses.
- **[SHIPPED]** **Carina Agent Scratchpad** - CarinaAgentScratchpad model, agent state management.
- **[SHIPPED]** **Platform Carina Insights** - CarinaInsightsController.
- **[SHIPPED]** **Filament Ops Console Panel** - Filament v3 platform monitoring hub at `/filament` (panel ID `admin`, guard `platform`, Amber colour). Separate from the main `/admin` CRUD panel. Six dashboard widgets: OpsConsoleQuickLinks, PlatformHealthWidget, PlatformTenantStatsWidget, CarinaTotalTokens, RagDocumentStats, TokensByTenantTable.
- **[SHIPPED]** **Platform Health Widget** - `PlatformHealthWidget` StatsOverviewWidget, 30s polling. Redis/DB latency/failed jobs/queue depth. All try/catch - never throws on degraded infrastructure.
- **[SHIPPED]** **Platform Tenant Stats Widget** - `PlatformTenantStatsWidget`, 60s polling. Total/active(30d)/pending-onboarding/inactive workspace counts with color thresholds.
- **[SHIPPED]** **Platform Rate Limit Config** - `PlatformRateLimitConfig` static-cached service. Reads `filament_carina_admin_settings` from `PlatformSetting`, falls back to config. `flush()` method clears cache. `RateLimitService` now uses this instead of reading config directly.
- **[SHIPPED]** **CarinaSettings Runtime Sync** - `CarinaSettings::save()` calls `syncAiProviderDefaults()` (updates `ai_providers` table so `AiRuntimeResolutionService` picks up new provider immediately) and `PlatformRateLimitConfig::flush()` (rate limits take effect on next request).
- **[SHIPPED]** **Filament CRM Cross-Workspace Viewer** - `Crm\ContactResource` at `/filament/crm/contacts`, read-only cross-tenant contact view in Ops Console, gated by `crm` feature flag. "Workspace people" quick link in `OpsConsoleQuickLinks`.
