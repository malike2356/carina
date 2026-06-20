# Prompt 03: Alerting and Notification System

## Context

Scout detects events but does not yet alert the operator. Operators need email alerts for
critical events, optional Slack/Teams webhooks, and SMS for P1 incidents. This prompt adds
a configurable alerting layer on top of the existing Scout event system.

## What to Build

### 1. Alert rule engine

Create `console.labyrinthscout.com/src/alerting/rules.ts`:
```typescript
export type AlertRule = {
  id: string;
  name: string;
  condition: {
    severity?: string[]; // ['critical', 'high']
    eventTypes?: string[];
    scoreBelow?: number; // alert when score drops below this
  };
  actions: AlertAction[];
  cooldownMinutes: number; // minimum time between repeat alerts
  enabled: boolean;
};

export type AlertAction = {
  type: 'email' | 'slack' | 'teams' | 'sms' | 'webhook';
  config: Record<string, string>;
};
```

Default rules created on org setup:
- Critical event -> email alert (cooldown: 15 min)
- Score below 50 -> email alert (cooldown: 60 min)
- Score below 30 -> email + SMS (cooldown: 120 min)

### 2. Alert dispatcher

Create `console.labyrinthscout.com/src/alerting/dispatcher.ts`:
```typescript
export async function dispatchAlert(rule: AlertRule, event: ScoutEvent): Promise<void> {
  for (const action of rule.actions) {
    switch (action.type) {
      case 'email':
        await sendAlertEmail(action.config.to, rule, event);
        break;
      case 'slack':
        await sendSlackWebhook(action.config.webhookUrl, rule, event);
        break;
      case 'sms':
        await sendSmsTwilio(action.config.phoneNumber, rule, event);
        break;
      case 'webhook':
        await sendGenericWebhook(action.config.url, action.config.secret, rule, event);
        break;
    }
  }
  await recordAlertFired(rule.id, event.id);
}
```

### 3. Email alerts via Resend

```typescript
async function sendAlertEmail(to: string, rule: AlertRule, event: ScoutEvent): Promise<void> {
  await resend.emails.send({
    from: 'Scout <alerts@scout.carinaai.uk>',
    to,
    subject: `Scout Alert: ${event.severity.toUpperCase()} - ${event.type}`,
    html: buildAlertEmailHtml(rule, event),
  });
}
```

### 4. Slack webhook

```typescript
async function sendSlackWebhook(webhookUrl: string, rule: AlertRule, event: ScoutEvent): Promise<void> {
  const color = event.severity === 'critical' ? 'danger' : event.severity === 'high' ? 'warning' : 'good';
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color,
        title: `Scout Alert: ${event.type}`,
        fields: [
          { title: 'Severity', value: event.severity, short: true },
          { title: 'Asset', value: event.target_asset ?? 'unknown', short: true },
          { title: 'Details', value: JSON.stringify(event.details) },
        ],
        footer: 'Labyrinth Scout',
        ts: Math.floor(new Date(event.timestamp).getTime() / 1000),
      }],
    }),
  });
}
```

### 5. Alert rules management UI

In `console.labyrinthscout.com/public/dashboard.html`, add an Alerts tab:
- Table listing all configured rules with enable/disable toggle
- "Add rule" button - form with condition builder and action picker
- Alert history log (last 20 fired alerts with timestamp and outcome)

## Verification Checklist

- [ ] Trigger a critical event - email arrives within 2 minutes
- [ ] Second critical event within cooldown period - no second email sent
- [ ] Configure Slack webhook - Slack message appears on critical event
- [ ] Configure SMS alert - SMS received on P1 event
- [ ] Alert history shows all fired alerts with timestamps and recipients

## Files to Create or Modify

- CREATE `console.labyrinthscout.com/src/alerting/rules.ts`
- CREATE `console.labyrinthscout.com/src/alerting/dispatcher.ts`
- MODIFY `console.labyrinthscout.com/src/server.ts` - trigger dispatcher on incoming events
- MODIFY `console.labyrinthscout.com/public/dashboard.html` - add Alerts tab
