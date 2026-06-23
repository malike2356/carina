# Carina AI - Email & Notification System

**Stack:** Laravel Mail + Postmark (transactional) · Laravel Notifications (database)  
**Push:** WebPush for PWA · Twilio for SMS (security only)

---

## Email Types

### Transactional (Required)

| Email | Trigger | Template | Priority |
|---|---|---|---|
| Welcome | Signup completes | Welcome to Carina - next steps, first prompt suggestions | High |
| Email verification | Signup | "Verify your email address" link (expires 24h) | High |
| Password reset | User request | "Reset your password" link (expires 15 min) | High |
| Password changed | Password updated | "Your password was changed" - security notification | High |
| Invoice | Monthly billing | Invoice PDF from Stripe | High |
| Payment failed | Stripe invoice fails | "Update payment method" with link | High |
| Plan changed | Upgrade/downgrade | Confirmation + new token allowance | Medium |
| Cancellation | Subscription cancels | "What could we improve?" survey link | Medium |
| Account deleted | Account deletion | Confirmation + data deletion notice | Medium |
| Data export ready | Export completes | Download link (expires 7 days) | Medium |

### Usage & Billing (Important)

| Email | Trigger | Content |
|---|---|---|
| Usage warning 50% | Token usage hits 50% | "You've used half your tokens" + upgrade prompt |
| Usage warning 80% | Token usage hits 80% | "Running low on tokens" + upgrade + top-up links |
| Usage warning 100% | Token limit reached | "Out of tokens" - upgrade or buy top-up |
| Top-up receipt | On-demand bundle purchased | Receipt + new token balance |
| Annual renewal notice | 30 days before annual renewal | Upcoming charge + plan details |
| Payment method expiring | Card expires in 30 days | "Update payment method" |

### Engagement (Optional, Opt-In)

| Email | Frequency | Content |
|---|---|---|
| Weekly digest | Monday 09:00 | Usage summary, trending questions, feature tips |
| New feature | Per launch | What's new, how to use it, example prompts |
| Re-engagement | After 14 days inactive | "Carina misses you" - new features, prompt ideas |
| Best practices | Monthly | Tips for getting more from Carina |

---

## In-App Notifications

Bell icon in web UI. Shown on all pages. Mark as read, dismiss.

| Notification | Trigger | Priority |
|---|---|---|
| Analysis complete | Async analysis finishes | Medium |
| Document processed | Upload finishes ingesting | Medium |
| Provider degraded | AI provider switched | Low (shown to admin only) |
| New feature available | Product launch | Low |

## Push Notifications (PWA)

| Notification | Trigger | Channel |
|---|---|---|
| Carina response ready | Async query completes | Browser push |
| Usage warning | Threshold hit | Browser push |
| Document processed | Upload complete | Browser push |

## Architecture

```php
// config/notifications.php
return [
    'channels' => [
        'emergency' => ['mail', 'sms'],      // Payment failed, security alert
        'high' => ['mail', 'database'],       // Verification, password reset
        'medium' => ['mail', 'database', 'push'], // Usage warnings, analysis done
        'low' => ['database', 'push'],          // Weekly digest, feature announcements
        'opt_in' => ['mail'],                  // Marketing, re-engagement
    ],

    'digest_schedule' => '0 9 * * 1',  // Monday 9am
    're_engagement_days' => 14,

    'postmark' => [
        'message_stream' => env('POSTMARK_MESSAGE_STREAM', 'outbound'),
    ],
];
```

## Files

```
app/Notifications/
├── WelcomeNotification.php
├── EmailVerificationNotification.php
├── UsageWarningNotification.php
├── PaymentFailedNotification.php
├── InvoiceNotification.php
├── AnalysisCompleteNotification.php
├── WeeklyDigestNotification.php
└── ReEngagementNotification.php

app/Console/Commands/
├── notifications:send-digest
├── notifications:send-re-engagement
└── notifications:cleanup-old
```
