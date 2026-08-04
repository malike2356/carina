# Compliance (Deep)

**Last updated:** 2026-05-17

## Overview
Comprehensive compliance management for property businesses. Track certificates and obligations (gas safety, EPC, EICR, HMO licences, insurance), AML checks and training, complaint cases, regulatory registrations, and full GDPR compliance - data subject rights, consent logs, breach recording, retention policies, and privacy policies.

## Core Features
- **Compliance items** - Track certificates and obligations per property with expiry dates and reminders (safety, licensing, legal, tax, insurance, finance)
- **Compliance checks** - Checklist items with recurring schedules (monthly, quarterly, annual)
- **Regulatory profiles** - Per-property registrations with regulatory bodies (HSE, FCA, HMRC)
- **AML records** - Record AML checks with status (passed, failed, pending, referred) via Credas or manual
- **AML training logs** - Track staff AML training with certificates and expiry dates
- **Complaint cases** - Full complaint handling workflow from open to resolved
- **GDPR data subject requests** - Handle access, erasure, rectification, portability, and restriction requests
- **Consent logs** - Track consent given and withdrawn with timestamps and sources
- **Data breach recording** - Log breaches with risk assessment, ICO notification tracking
- **Data retention policies** - Define retention periods with auto-delete rules
- **Privacy policies** - Versioned policies with acceptance tracking

## Getting Started
1. Add compliance items for each property - gas certificates, EPCs, EICRs, licences
2. Set reminder periods so you're notified before expiry
3. Record AML checks for investor due diligence
4. Set up GDPR compliance workflows (consent, data requests, breach logs)
5. Configure data retention policies

## Key Workflows

### Managing compliance items
Each item has a category (safety, licensing, legal, tax, insurance, finance) and type (gas safety, EPC, EICR, HMO licence, landlord insurance). Upload certificate documents and set expiry dates. The system auto-calculates status: valid, expiring soon, or expired based on your reminder period.

### AML checks
Record AML checks with method (Credas or manual), status, and check ID. Track who performed the check and when. Staff AML training is logged separately with certificate uploads and expiry.

### Handling a complaint
Complaints move through: open, investigating, resolved, closed, or escalated. Each has a priority (low, medium, high, urgent). Assign cases to team members. Record resolution notes when closed.

### GDPR data subject requests
Handle requests for data access, erasure, rectification, portability, or processing restriction. Track from received through processing to completed or rejected. Erasure requests trigger anonymisation of related lead funnel data.

### Consent management
Log when and where consent was captured (including IP address). Track withdrawal with timestamp. Consents can be given or withdrawn; the full history is preserved.

## Business Rules
- Compliance item status auto-computed from expiry date and reminder period
- Complaint lifecycle: open, investigating, resolved, closed, escalated
- AML checks support Credas integration; status options: passed, failed, pending, referred
- GDPR erasure anonymises linked lead funnel data
- Consent withdrawal preserves full audit trail
- Data breaches track ICO notification status

## Best Practices
- Set reminder periods to 30 days before expiry for safety certificates
- Run monthly compliance checks using checklist items
- Log all AML checks even if informal - they're your audit trail
- Respond to GDPR data subject requests within the statutory 30-day window
- Review retention policies annually against current regulations
- Keep complaint records for at least 6 years (regulatory requirement)

## Related Features
- **Lead Funnel** - GDPR erasure flow for lead data
- **Property Assets & Maintenance** - Compliance items linked to property assets
- **Investor Portal** - KYC/AML checks for investor onboarding
