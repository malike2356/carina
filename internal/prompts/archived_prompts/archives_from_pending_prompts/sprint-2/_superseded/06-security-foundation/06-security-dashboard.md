# Prompt 06: Security Dashboard in Ops Admin


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

`ops.carinaai.uk` has a Security tab (from `prompts/01-security-tab.md`). This prompt
completes it: live Scout event feed, tool audit log, RASP alert history, secret rotation
status, and a forensics case tracker.

## What to Build

### 1. Scout event feed

In `ops.carinaai.uk/views/security.ejs`, add a live event feed section:
```html
<section class="event-feed">
  <h2>Scout Events (live)</h2>
  <div id="event-feed" class="feed">
    <!-- Populated by SSE connection -->
  </div>
</section>

<script>
const source = new EventSource('/security/events/stream');
source.onmessage = (e) => {
  const event = JSON.parse(e.data);
  const el = document.createElement('div');
  el.className = `event event-${event.severity}`;
  el.innerHTML = `
    <span class="ts">${new Date(event.timestamp).toLocaleTimeString()}</span>
    <span class="type">${event.type}</span>
    <span class="details">${JSON.stringify(event.details)}</span>
  `;
  document.getElementById('event-feed').prepend(el);
};
</script>
```

The SSE endpoint in `ops.carinaai.uk/routes/security.ts` subscribes to Redis pub/sub
(the same channel Scout uses for kill switch events).

### 2. Tool audit log table

A paginated table of all tool executions in the last 7 days:
```
Timestamp           Tool           User           Outcome   Scout
2026-06-19 08:14   nmap           ops-admin      Success   logged
2026-06-19 08:02   metasploit     ops-admin      Approved  logged
2026-06-18 23:11   forensics-pipeline  ops-admin Success   logged
```

Data from `SELECT * FROM scout_events WHERE event_type LIKE 'tool-%' ORDER BY timestamp DESC`.

### 3. RASP alert history

```
Timestamp           Type                Severity  Action Taken
2026-06-19 07:55   prompt-injection    high      blocked
2026-06-18 14:32   anomalous-tool-chain medium    logged
```

### 4. Secret rotation status

A compact table:
```
Key                  Last Rotated    Age    Status
RESEND_API_KEY       45 days ago     45     OK
OPENAI_API_KEY       95 days ago     95     OVERDUE (max 90 days)
CARINA_OPS_TOKEN     12 days ago     12     OK
```

[Rotate] button on each row invokes `POST /security/secrets/rotate` which calls
the Carina core rotate-secret tool via ops API.

### 5. Forensics case tracker

A simple list of forensics pipeline runs:
```
Case ID       Image                Started      Status    Events
case-001      /evidence/disk.dd    2026-06-18   Done      14,203
case-002      /evidence/mem.raw    2026-06-19   Running   --
```

## Verification Checklist

- [ ] Live event feed shows new Scout events within 2 seconds of occurrence
- [ ] Tool audit log shows the last 20 tool executions with timestamps
- [ ] RASP alerts section shows blocked injection attempts
- [ ] Overdue secrets appear with "OVERDUE" status and red highlight
- [ ] [Rotate] button triggers rotation and refreshes the status row

## Files to Create or Modify

- MODIFY `ops.carinaai.uk/views/security.ejs` - add all sections
- MODIFY `ops.carinaai.uk/routes/security.ts` - add SSE stream, secret rotation proxy
- CREATE `ops.carinaai.uk/views/partials/tool-audit.ejs`
- CREATE `ops.carinaai.uk/views/partials/rasp-alerts.ejs`
- CREATE `ops.carinaai.uk/views/partials/secret-status.ejs`
