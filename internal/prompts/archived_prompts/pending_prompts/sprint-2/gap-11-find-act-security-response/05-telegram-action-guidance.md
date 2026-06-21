# Gap 11 - Prompt 05: Telegram Action Guidance

**Gap:** 11 Find-Act Security Response
**Prompt number:** 05 of 06
**Name:** Telegram Action Guidance
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** Prompt 01 (playbook registry and types)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

Before writing a single line, read:

1. `console.labyrinthscout.com/src/alerts/telegram.ts` - the current TelegramAdapter (already
   humanized in the previous session - read the full current file)
2. `console.labyrinthscout.com/src/alerts/types.ts` - `SecurityEvent`
3. `console.labyrinthscout.com/src/actions/playbook-registry.ts` - `findPlaybook()`, `PLAYBOOKS`
4. `console.labyrinthscout.com/src/actions/types.ts` - `ActionPlaybook`, `PlaybookAction`

All paths are relative to `/opt/lampp/htdocs/verlox/carina/internal/servers/`.

---

## Context

The current Telegram message (after humanization from the previous session) tells the operator
WHAT happened in plain English. It does not tell them WHAT TO DO next.

This prompt adds an action guidance section to the Telegram message. For `category: 'human'`
playbooks, the message includes a plain-English "What you can do" block with the top available
actions described in one line each. For `category: 'auto'` playbooks, it tells the operator
what the system already did automatically. For `category: 'monitor'` playbooks, it reassures
them no action is needed.

The message also includes a direct link to the dashboard that deep-links to the pending actions
view, so the operator can go straight to the resolve modal from the Telegram notification.

---

## Step 1: Extend formatMessage()

Modify `telegram.ts` to import and use the playbook registry. The change is additive - the
existing human-friendly summary and technical spoiler sections are preserved. The new section
is added between the summary and the time/dashboard line.

```typescript
// At the top of telegram.ts, add:
import { findPlaybook } from '../actions/playbook-registry.js';
import type { ActionPlaybook } from '../actions/types.js';
```

Add a new helper function to build the action guidance block:

```typescript
function buildActionGuidance(event: SecurityEvent): string {
  const playbook = findPlaybook(event.event_type, event.severity);
  if (!playbook) return '';

  if (playbook.category === 'monitor') {
    return 'No action needed. This is for your awareness only.';
  }

  if (playbook.category === 'auto') {
    const autoActions = playbook.actions
      .filter((a) => a.type === 'button')
      .map((a) => a.label)
      .slice(0, 3);
    if (autoActions.length === 0) return '';
    return 'Labyrinth has already: ' + autoActions.join(', ') + '.';
  }

  // category === 'human': list top actions in plain English
  if (playbook.category === 'human') {
    const topActions = playbook.actions.slice(0, 3);
    if (topActions.length === 0) return '';

    const lines = topActions.map((a) => {
      const prefix = a.destructive ? 'High impact: ' : '';
      return prefix + a.label + ' - ' + shortenDesc(a.description);
    });

    return 'What you can do:\n' + lines.map((l) => '- ' + l).join('\n');
  }

  return '';
}

function shortenDesc(desc: string, maxLen = 60): string {
  if (desc.length <= maxLen) return desc;
  const cut = desc.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + '...';
}
```

In `formatMessage()`, insert the action guidance between the summary paragraph and the
time/dashboard line:

```typescript
formatMessage(event: SecurityEvent): string {
  const dashboardUrl = process.env.SCOUT_DASHBOARD_URL ?? 'http://localhost:4444';
  const severityLabel = SEVERITY_LABELS[event.severity] ?? event.severity.toUpperCase();
  const eventLabel = humanizeEventType(event.event_type);
  const summary = buildSummary(event);
  const guidance = buildActionGuidance(event);
  const time = friendlyTime(event.created_at);

  const rawDesc =
    event.description.length > 400
      ? event.description.slice(0, 397) + '...'
      : event.description;

  const techDetails = [
    'Type: ' + event.event_type,
    'Severity: ' + event.severity,
    'Instance: ' + event.instance_id,
    'Session: ' + event.session_id,
    'Raw: ' + rawDesc,
  ].join('\n');

  const parts: string[] = [
    '<b>' + escHtml(severityLabel) + ': ' + escHtml(eventLabel) + '</b>',
    '',
    escHtml(summary),
  ];

  if (guidance) {
    parts.push('');
    parts.push(escHtml(guidance));
  }

  parts.push('');
  parts.push('<i>' + escHtml(time) + '</i>');
  parts.push('<a href="' + escHtml(dashboardUrl + '/dashboard?tab=actions') + '">Review in Labyrinth dashboard</a>');
  parts.push('');
  parts.push('<tg-spoiler>Technical details:\n' + escHtml(techDetails) + '</tg-spoiler>');

  return parts.join('\n');
}
```

---

## Step 2: Deep Link to Actions Tab

The dashboard link currently points to `dashboardUrl + '/dashboard'`. Change it to point to
`dashboardUrl + '/dashboard?tab=actions'` so operators land directly on the pending actions
section.

For this to work, the dashboard HTML must read the `tab` query parameter on load and switch
to the correct tab. Add the following logic in `dashboard.html` (in the page-load script area):

```javascript
// Auto-navigate to tab from URL param
(function () {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab) {
    window.addEventListener('load', function () {
      const tabBtn = document.querySelector('[data-tab="' + tab + '"]');
      if (tabBtn) tabBtn.click();
    });
  }
})();
```

If the dashboard uses a different tab-switching mechanism, trace how tabs are activated and
replicate the same approach. The goal is: visiting `/dashboard?tab=actions` should open the
actions/response tab automatically.

Also ensure there is a tab in the dashboard named `actions` (or adapt the query param to match
whatever tab contains the pending-actions widget from Prompt 03). If no such tab exists, add it.

---

## Step 3: Action Summary for Auto-Resolved Events

For auto-resolved events (category: 'auto'), the Telegram message should tell the operator what
the system already did. This is important so the operator knows the system acted and does not
need to do anything manually.

Example message for a hypothetical auto-resolved event:

```
Notice: Unusual AI behaviour

Carina's unique tools used per session is slightly above normal. This
was within auto-remediation range.

Labyrinth has already: Switched to restricted mode, Flagged for elevated monitoring.

Fri, 20 Jun, 20:10 UTC
Review in Labyrinth dashboard

[tap to reveal: Technical details]
```

The key line: "Labyrinth has already: ..." reassures the operator and prevents duplicate manual
effort.

---

## Verification

```typescript
// Unit test: add to src/alerts/__tests__/ or src/actions/__tests__/telegram-guidance.test.ts

import { TelegramAdapter } from '../alerts/telegram';

const adapter = new TelegramAdapter();

const baseEvent = {
  id: 'test-id',
  instance_id: 'carina-local',
  session_id: 'some-session-uuid',
  created_at: new Date(),
  acknowledged: false,
  acknowledged_by: null,
  acknowledged_at: null,
};

test('anomaly_detected critical includes action guidance', () => {
  const msg = adapter.formatMessage({
    ...baseEvent,
    event_type: 'anomaly_detected',
    severity: 'critical',
    description: JSON.stringify({ metricName: 'uniquetoolsused', zScore: 6.1, currentValue: 3, baselineMean: 0.08 }),
  });
  expect(msg).toContain('What you can do');
  expect(msg).toContain('Review in Labyrinth dashboard');
  expect(msg).toContain('tab=actions');
});

test('alert_test includes no-action-needed message', () => {
  const msg = adapter.formatMessage({
    ...baseEvent,
    event_type: 'alert_test',
    severity: 'info',
    description: 'Test alert',
  });
  expect(msg).toContain('No action needed');
});

test('breach_detected includes high-impact actions', () => {
  const msg = adapter.formatMessage({
    ...baseEvent,
    event_type: 'breach_detected',
    severity: 'breach',
    description: 'Confirmed breach via prompt injection',
  });
  expect(msg).toContain('High impact');
  expect(msg).toContain('What you can do');
});
```

Run with: `npx vitest run`
