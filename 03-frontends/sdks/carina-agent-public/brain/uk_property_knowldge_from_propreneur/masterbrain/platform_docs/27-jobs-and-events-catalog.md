# Jobs and events catalog

**Last updated:** 2026-05-14 (added: Lead Funnel jobs/events, Mentoring OS events, Vcal events, Comms Hub jobs, Backup cleanup, Billing retry, Accounting jobs, Automation jobs, Reporting jobs, Scoring jobs)  
**Purpose:** Map `app/Jobs` (queue jobs) and `app/Events` (domain events) to product areas. Listeners are in `app/Listeners/`.

---

## Jobs (`App\Jobs`)

### Accounting

| Job | Purpose |
| --- | --- |
| `Accounting\PullAccountingFromIntegrationJob` | Pull transactions from external accounting provider |
| `Accounting\PullZohoInvoicesJob` | Pull Zoho Books invoices |
| `Accounting\PushJournalToSingleAccountingProviderJob` | Push one journal entry to a single external ledger |
| `Accounting\PushJournalToZohoJob` | Push journal entry to Zoho Books |
| `Accounting\PushPostedJournalToExternalAccountingJob` | Sync posted journal out via Accounting Webhook |
| `Accounting\PushUnsyncedAccountingForProviderJob` | Batch sync unsynced entries for one provider |

### Automation

| Job | Purpose |
| --- | --- |
| `Automation\ExecuteWorkspaceAutomationRuleJob` | Run one workspace automation rule (trigger → action) |

### Backup

| Job | Purpose |
| --- | --- |
| `Backup\CleanupExpiredBackupsJob` | Prune expired backup artefacts |
| `Backup\ProcessRestoreJob` | Restore tenant database from backup |
| `Backup\RunBackupJob` | Execute configured backup |
| `Backup\UploadBackupJob` | Upload backup artefact to destination |
| `Backup\VerifyBackupJob` | Verify backup integrity |

### Billing

| Job | Purpose |
| --- | --- |
| `Billing\CheckExpiringTrialsJob` | Trial expiry handling |
| `Billing\ProcessSubscriptionWebhookJob` | Stripe subscription webhook side effects |
| `Billing\RetryFailedPaymentsJob` | Retry failed Stripe charges |
| `Billing\SendInvoiceReminderJob` | Send one invoice reminder |

### Carina

| Job | Purpose |
| --- | --- |
| `Carina\PruneOldConversations` | Delete aged Carina threads per retention setting |
| `Carina\ProcessRagContext` | (internal) RAG context processing |

### Communications

| Job | Purpose |
| --- | --- |
| `Communications\ProcessCommunicationStepJob` | Run or record one comms sequence step |

### Deals

| Job | Purpose |
| --- | --- |
| `Deals\ImportListingJob` | Async listing import from URL |
| `Deals\PollLicensedListingFeedsJob` | Batch ingest from licensed partner feeds |
| `Deals\ProcessSourcingAlertsJob` | Daily sourcing alert batch |
| `Deals\RunListingAutomationJob` | Run listing automation watches |

### Integrations

| Job | Purpose |
| --- | --- |
| `Integrations\DispatchWebhookJob` | Deliver outbound webhook |
| `Integrations\RetryFailedWebhookJob` | Retry failed delivery |
| `Integrations\SyncIntegrationDataJob` | Provider sync for one tenant |

### Lead Funnel

| Job | Purpose |
| --- | --- |
| `LeadFunnel\CarinaQualifyLeadJob` | AI score one inbound lead |
| `LeadFunnel\CheckLeadActivityJob` | Daily inactivity sweep |
| `LeadFunnel\CreateCrmContactJob` | Convert hot lead to CRM Contact |
| `LeadFunnel\ExecuteAutomationJob` | Run one automation rule |
| `LeadFunnel\ProcessMetaWebhookJob` | Ingest Meta lead gen submission |
| `LeadFunnel\PublishCampaignJob` | Push campaign to ad platform |
| `LeadFunnel\PullLinkedInLeadsJob` | Scheduled poll for LinkedIn leads |
| `LeadFunnel\PullTikTokLeadsJob` | Scheduled poll for TikTok leads |
| `LeadFunnel\SyncCampaignPerformanceJob` | Daily metrics pull |

### Migration

| Job | Purpose |
| --- | --- |
| `Migration\ExportV1DataJob` | v1 export phase |
| `Migration\ImportToV2Job` | v2 import phase |
| `Migration\TransformDataJob` | Transform between v1 and v2 shapes |

### RAG

| Job | Purpose |
| --- | --- |
| `Rag\BatchEmbeddingJob` | Large-document embedding batch |
| `Rag\ProcessDocumentJob` | Chunk + embed one `rag_documents` row |

### Reporting

| Job | Purpose |
| --- | --- |
| `Reporting\CleanupOldReportExecutionsJob` | Prune old executions |
| `Reporting\GenerateReportJob` | Build one report artefact |
| `Reporting\ProcessAnalyticsEventJob` | Ingest one analytics event |
| `Reporting\SendReportDigestJob` | Email digest |

### Scoring

| Job | Purpose |
| --- | --- |
| `Scoring\ScoreAllInvestorsJob` | Batch investor scoring |

### Tenancy

| Job | Purpose |
| --- | --- |
| `Tenancy\CreateTenantDatabaseJob` | Provision tenant database |

---

## Domain events (`App\Events`)

| Event | Area | Listeners |
|-------|------|-----------|
| `Billing\InvoicePaid` | Stripe billing | - |
| `Billing\PaymentFailed` | Stripe billing | - |
| `Billing\SubscriptionCancelled` | Stripe billing | - |
| `Billing\SubscriptionCreated` | Stripe billing | - |
| `Billing\SubscriptionUpdated` | Stripe billing | - |
| `Carina\CarinaConversationDeleted` | Carina | - |
| `Carina\CarinaMessageSent` | Carina | - |
| `Central\BackupJobCompleted` | Platform backup | `LogBackupJobCompleted`, `NotifySlackOnBackupCompleted` |
| `LeadFunnel\HotLeadDetected` | Lead Funnel | `NotifyTenantOwnerOfHotLead`, `SyncLeadFunnelTrialOnTenantUserCreated` |
| `Tenant\MentoringOs\MentorshipMessageSent` | Mentoring OS | `NotifyOfflineMentorshipRecipient` |
| `Tenant\Pipeline\DealCreated` | Pipeline | `DispatchPipelineWorkspaceAutomations`, `DispatchCommunicationSequenceTriggers` |
| `Tenant\Pipeline\DealDeleted` | Pipeline | - |
| `Tenant\Pipeline\DealStageChanged` | Pipeline | `DispatchPipelineWorkspaceAutomations`, `DispatchCommunicationSequenceTriggers` |
| `Tenant\Vcal\VcalBookingConfirmed` | viCal | `CreateVcalConfirmedDepositJournalDraft`, `DispatchVcalBookingIntegrationWebhooks`, `EnrollVcalGuestIntoCommunicationSequence` |
| `Tenant\Vcal\VcalBookingNeedsReview` | viCal | `DispatchVcalBookingIntegrationWebhooks` |

## Related

- `60-artisan-and-scheduler-catalog.md` - Artisan commands, schedule, and PlatformScheduleCatalog
- `59-carina-propreneur-full-codex.md` - product truth
- `108-lead-funnel-module.md` - Lead Funnel jobs detail
- `31-vcal-booking-module.md` - viCal event detail
- `58-mentoring-os-tenant-surface.md` - Mentoring OS detail
