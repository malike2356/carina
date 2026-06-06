# Security & Activity

**Last updated:** 2026-05-17

## Overview
Security monitoring and activity auditing across the platform. Track login events, security findings (weak passwords, unusual logins, suspicious activity), remote access by platform operators, and setting changes with before/after value tracking. All security events are logged immutably.

## Core Features
- **Security activity log** - Append-only log of all security events (logins, logouts, failed logins, password changes, MFA events, API access, settings changes, permission changes)
- **Security findings** - Automated detection of issues (weak passwords, unusual login locations, expired tokens, exposed API keys, suspicious activity)
- **Remote access logging** - All platform operator access to your workspace is recorded (impersonation, read-only, admin panel) with duration and actions
- **Setting audit trail** - Every change to platform and workspace settings is logged with before and after values
- **My activity** - View your own activity history

## Getting Started
Security logging runs automatically - no setup needed. The Security Dashboard gives you:
1. Recent security events grouped by type
2. Active findings with severity breakdown
3. Remote access log if you're a platform operator
4. Setting change history

## Key Workflows

### Reviewing security events
View the security activity log filtered by event type, severity, date range, or user. All events are classified as info, warning, or critical. IP address and user agent are captured for login events.

### Managing security findings
Automated findings (weak passwords, unusual logins, suspicious activity) appear with severity levels: low, medium, high, critical. Investigate open findings and resolve or dismiss them. Each finding records the affected resource and resolution details.

### Remote access audit
Platform operator access to your workspace is logged with access type, duration, and actions performed. Archived logs are rotated from the main table for performance.

### Setting audit trail
Every settings change is recorded - who changed it, what the old value was, what the new value is, and when it happened. Useful for compliance and troubleshooting.

## Business Rules
- Security activity logs are append-only - never modified or deleted
- Events classified as info, warning, or critical
- Findings have a lifecycle: open, investigating, resolved, dismissed
- All platform operator remote access is logged
- Setting changes preserve before/after values
- IP address and user agent captured on all login/access events

## Best Practices
- Review security findings weekly
- Investigate critical findings immediately
- Use the setting audit trail to track configuration drift
- Monitor for unusual login locations or times
- Keep MFA enabled for all workspace users
- Review remote access logs if you have platform operators

## Related Features
- **Compliance** - Security logs support GDPR and regulatory compliance
- **Backup & Restore** - Security logs should be included in backups
