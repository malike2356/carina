# Referrals & Waitlist

**Last updated:** 2026-05-17

## Overview
Referral programme management and product waitlist handling. Generate referral codes with credit rewards, track conversions, and manage a double-opt-in waitlist with interest scoring, segmentation, and referral tracking.

**Promo vs referral (Carina):** Workspace referral codes (`?ref=`) reward the **referring tenant**; they are not signup discounts. For % off or extra trial for the **new** customer, use **promo codes** (`?promo=`). Full guide: `152-promo-codes-vs-referral-codes.md`.

## Core Features
- **Referral codes** - Generate unique codes per workspace with configurable credit amounts and qualifying periods
- **Conversion tracking** - Track referred users through pending, qualified, and credited stages
- **Referral credits** - Earn credits from successful referrals with optional expiry dates
- **Waitlist registration** - Double opt-in signup with email confirmation
- **Interest scoring** - Calculated from user type and interests for prioritisation
- **Waitlist referrals** - Track who referred whom within the waitlist
- **Segmentation** - Filter and query by user type or custom segment

## Getting Started
1. **For platform admins:** Configure referral codes with credit amounts and qualifying periods
2. **For users:** Share your referral code or link
3. **For the waitlist:** Users sign up, confirm their email, and optionally enter a referral code
4. Track referrals and conversions in the dashboard

## Key Workflows

### Referral programme
Users receive a unique referral code. When someone signs up using the code, it's recorded as a pending conversion. After a qualifying period (configurable days), the conversion is marked as qualified. Credits are then awarded and can be applied to future bills. Credits may have expiration dates.

### Waitlist signup
A visitor signs up with email, name, company, user type, and interest areas. They receive a confirmation email with a token. They must confirm (double opt-in) before being fully registered. The confirmation token auto-generates. Interest score is calculated from their profile data.

### Waitlist referrals
Existing waitlist members can refer others. Each referral tracks the referrer, referred email, status (pending, joined, converted), and timestamp. When the referred person joins and confirms, the status updates.

## Business Rules
- Referral lifecycle: pending → qualified (after N days) → credited
- Waitlist uses double opt-in - email confirmation required
- Interest scoring calculated from user type and interests
- Credited referral credits can have expiration dates
- Waitlist can be segmented by user type or custom segment
- Each workspace has its own referral codes

## Best Practices
- Set a reasonable qualifying period (30 days is typical for subscription referrals)
- Use the waitlist interest score to prioritise onboarding
- Promote referral codes at key moments (after positive experiences)
- Review waitlist segmentation to understand your user mix
- Set referral credit expiry to encourage timely use

## Related Features
- **Subscriptions & Billing** - Referral credits apply to subscriptions
- **Onboarding Journey** - New users from waitlist flow into onboarding
- **Comms & Engagement** - Automated emails for waitlist and referral communication
