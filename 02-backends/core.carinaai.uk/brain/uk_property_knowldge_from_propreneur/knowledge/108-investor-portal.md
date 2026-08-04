# Investor Portal

**Last updated:** 2026-05-17

## Overview
A separate authenticated portal for external investors. Investors can register, complete KYC/AML checks, upload proof of funding, browse matched deals, and subscribe to VIP tiers for early deal access. The portal operates independently of your main workspace accounts.

## Core Features
- **Investor registration & login** - Separate sign-up flow for external investors, distinct from workspace users
- **Investor profiles** - Track past deals, capital allocation by asset class, engagement history, and communication preferences
- **KYC/AML compliance** - Submit identity documents and address proof via Credas integration; full compliance status tracking
- **Proof of funding (PoF)** - Upload bank statements, solicitor confirmations per deal; dual verification workflow
- **VIP subscriptions** - Monthly subscription tier for priority deal matching and early access, billed via Stripe
- **Deal matching** - Investors matched to pipeline deals based on their profile and preferences
- **Investor scoring** - Contacts have computable investor scores to prioritise matching

## Getting Started
1. **Set up your investor portal** - Configure your portal branding and KYC requirements
2. **Invite investors** - Share the portal registration link
3. **Investors complete KYC** - ID verification and proof of funding upload
4. **Deals get matched** - Pipeline deals are matched to qualified investors
5. **Investors browse deals** - Qualified investors view matched opportunities

## Key Workflows

### Investor registration
An investor registers via the portal with email and password (separate from workspace accounts). Their record links back to a CRM contact in your workspace. Email verification is required before full access.

### KYC pipeline
KYC records start as pending, then move through in-progress, and resolve to passed, referred (requires manual review), or failed. Credas integration handles ID and address document verification. Ongoing PEP monitoring continues after initial pass.

### Proof of funding per deal
For each deal an investor is interested in, they submit proof of funding - funding type (cash, finance, or blend), amounts, source description, and supporting documents. Dual verification requires solicitor confirmation and deposit-in-principle receipt.

### VIP subscription
Investors can subscribe to a VIP tier with monthly billing. Benefits include early deal access and priority matching. Cancel anytime with tracked reasons.

### Deal matching
Investors are automatically matched to pipeline deals. You control which deals are visible. Matched investors appear on deal detail pages for easy outreach.

## Business Rules
- Investor portal accounts are completely separate from workspace user accounts - different login and auth system
- Every portal user links back to a CRM contact in your workspace
- KYC must pass before investors can view deal details
- Proof of funding requires both solicitor confirmation and deposit-in-principle
- VIP subscriptions are monthly recurring via Stripe
- Cancellation keeps service active until the current billing period ends

## Best Practices
- Complete KYC requirements before sharing deal access
- Use investor scoring to prioritise outreach to high-value investors
- Set up multiple proof of funding verification steps for regulatory compliance
- Promote VIP tiers as a lead generation tool for high-net-worth investors
- Review KYC status reports weekly to keep the pipeline moving

## Related Features
- **Pipeline Automation** - Deals flow into investor matching
- **Compliance** - KYC/AML records integrate with your compliance framework
- **Subscriptions & Billing** - VIP tier billing via Stripe
