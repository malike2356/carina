# Phase 1.1; Email Ingestion Pipeline Verification

## Task
Verify and fix the email ingestion pipeline in the Propreneur-v2 Carina service. This pipeline fetches emails via IMAP, classifies them using AI, extracts structured data, and dispatches handler jobs.

## Files involved
- app/Services/Email/EmailIngestionService.php
- app/Services/Email/EmailParserService.php
- app/Services/Email/EmailProcessingPipeline.php
- app/Actions/Email/HandleRentStatement.php
- app/Actions/Email/HandleMaintenanceReport.php
- app/Actions/Email/HandleAccountantReport.php
- app/Actions/Email/HandleTenantUpdate.php
- app/Console/Commands/ProcessInboundEmailsCommand.php
- app/Models/Tenant/EmailIngestionConfig.php
- app/Models/Tenant/EmailProcessingLog.php

## What to verify

1. EmailIngestionService connects to IMAP and fetches unseen messages
   - Test: configure a real EmailIngestionConfig, run emails:process, verify messages appear
   - Check: are messages marked as SEEN after fetch?
   - Check: are attachments handled?

2. EmailParserService classifies and extracts correctly
   - Test: pass a sample rent statement email body, verify it returns "rent_statement"
   - Test: pass a sample maintenance report, verify it returns structured JSON
   - Check: does the AI router work? Is the prompt library loaded correctly?

3. EmailProcessingPipeline orchestrates the full flow
   - Test: create a pending EmailProcessingLog, run the pipeline, verify it:
     a. Classifies the email
     b. Extracts structured data
     c. Updates the log with status 'processed'
     d. Dispatches the correct handler job

4. Handler jobs write to correct Propreneur records
   - HandleRentStatement: creates TenancyRentPayment, finds Property by address ILIKE
   - HandleMaintenanceReport: creates PropertyMaintenanceRequest
   - HandleAccountantReport: creates Document in DocumentVault
   - HandleTenantUpdate: updates PropertyTenancy status/end_date/rent_amount

5. ProcessInboundEmailsCommand works for all tenants
   - Test: run with --tenant= specific tenant, verify only that tenant processed
   - Test: run without --tenant, verify all active tenants processed

## Dependencies
- webklex/laravel-imap must be in composer.json
- EmailIngestionConfig must have valid IMAP credentials
- AI provider must be configured (check AiRouterService)
- email_processing_logs table must exist
- TenancyRentPayment, PropertyMaintenanceRequest, Document, PropertyTenancy models must exist

## Expected output
A working email pipeline where:
- Real estate agent sends an email to the configured inbox
- Carina fetches it within 15 minutes (scheduler runs every 15 min)
- The email is classified and data extracted
- A handler job writes the data into Propreneur
- The admin can see the processed email in the email_processing_logs table

## Verification
```bash
php artisan emails:process
# Check email_processing_logs table for new entries
# Check that handler jobs ran (check TenancyRentPayment etc.)
```
