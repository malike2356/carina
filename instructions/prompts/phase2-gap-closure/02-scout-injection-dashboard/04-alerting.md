# Phase 2.7; Multi-Channel Alerting

## Goal
Build Scout's alert delivery system. When a security event occurs (injection detected, anomaly flagged, kill switch triggered), alerts are sent to configured channels based on severity. This fulfills "Multi-channel alerting" on both websites.

## Files to create
```
packages/scout/src/
  alerting/
    alert-service.ts; Alert routing engine
    alert-config.ts; Per-tenant alert preferences
    channels/
      telegram-alerter.ts; Telegram alert delivery
      email-alerter.ts; Email alert delivery
      discord-alerter.ts; Discord alert delivery
      sms-alerter.ts; SMS alert delivery (Twilio)
      dashboard-alerter.ts; In-dashboard alert
    alert-templates.ts; Message templates per alert type
    alert-throttle.ts; Prevents alert storms
    alert-escalation.ts; Escalation if not acknowledged
```

## Alert severity levels
```
CRITICAL; Immediate action required
  - Kill switch triggered
  - Injection attack bypassed shield (all 3 layers failed)
  - Decoy credentials detected in output (data leak confirmed)
  - Unauthorized admin access detected
  
HIGH; Urgent, needs attention within 30 minutes
  - Injection attack with severity "critical" blocked
  - Anomaly: >5x normal token usage
  - Multiple injection attempts from same IP (potential coordinated attack)
  - Kill switch armed but not triggered
  
MEDIUM; Review within 4 hours
  - Injection attack with severity "high" blocked
  - Anomaly: unusual tool usage pattern
  - Stale marker detected (potential replay attack)
  - New IP accessing admin dashboard
  
LOW; Review within 24 hours
  - Injection attempt with severity "medium" blocked  
  - Rate limit exceeded (single instance)
  - New tenant registered
  - Configuration change detected
```

## Channel routing by severity
```typescript
const SEVERITY_ROUTING = {
  CRITICAL: ['telegram', 'email', 'sms', 'dashboard'],
  HIGH:     ['telegram', 'email', 'dashboard'],
  MEDIUM:   ['telegram', 'dashboard'],
  LOW:      ['dashboard']
};
```

## Alert template
```typescript
interface Alert {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: string; // 'injection_blocked', 'anomaly_detected', etc.
  title: string;
  detail: string;
  tenant: string;
  timestamp: Date;
  metadata: Record<string, any>;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
}
```

## Template per channel
```
Telegram (CRITICAL):
 CRITICAL: Injection Attack Bypassed Shield
Tenant: tenant-34
Time: 14:32:01 UTC
Detail: All 3 detection layers missed INJ-007 variant
Action: Kill switch recommended. Dashboard: https://scout.carinaai.uk
Ref: ALERT-2026-06-07-001

Email (HIGH):
Subject: [Scout HIGH] Injection Attack Blocked; tenant-07
Body: [detailed report with full context]

SMS (CRITICAL):
Scout CRITICAL: Kill switch triggered by laud@carinaai.uk. 47 agents stopped.
```

## Alert throttle
Prevents alert storms:
- Max 1 alert per severity per tenant per 5 minutes
- Duplicate alerts (same type, same tenant, within 5 min) → count increments, single notification: "3 injection attacks blocked for tenant-07 in last 5 minutes"
- After 10 suppressed alerts in an hour → escalate to next severity level

## Escalation
If a CRITICAL alert is not acknowledged within 5 minutes:
- Resend to all channels
- Add "UNACKNOWLEDGED; ESCALATING" prefix
If still unacknowledged after 15 minutes:
- SMS to emergency contact number
- Trigger auto-protection: temporarily increase shield sensitivity for affected tenant

## Verification
```bash
# Trigger a CRITICAL alert
# Send injection attack that bypasses all layers (test mode)
# Expected: Telegram + email + SMS + dashboard alert within 30 seconds

# Verify throttle
# Send 5 identical injection attacks in 1 minute
# Expected: 1 notification saying "5 injection attacks blocked in last minute"

# Verify escalation
# Don't acknowledge critical alert for 5 minutes
# Expected: escalated alert appears, countdown timer shown

# Verify channel preferences
# Configure tenant to receive alerts only via email
# Trigger alert → only email received
```
