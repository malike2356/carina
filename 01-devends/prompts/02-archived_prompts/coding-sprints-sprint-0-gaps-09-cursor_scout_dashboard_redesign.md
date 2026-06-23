Use these in Cursor in order. They are scoped so it can land the dashboard work without turning into a broad
  rewrite.

  Prompt 1: Restructure the dashboard into useful sections

  In console.labyrinthscout.com, redesign the public /dashboard so it reads like an operator console, not a pile of
  unrelated counters.

  Goal:
  - The dashboard should answer 4 questions fast:
    1. Is Scout healthy?
    2. Is the risk rising or falling?
    3. What needs attention now?
    4. Is the data fresh and trustworthy?
  - The current layout mixes posture, usage, audit, compliance, and trust history too flatly.
  - Move token usage and compliance export out of the main security posture surface.

  Tasks:
  1. Inspect public/dashboard.html and the dashboard widget scripts.
  2. Rework the top of the page into three clear sections:
     - Live Posture
     - Incident Triage
     - Trust / Compliance
  3. In Live Posture, show:
     - current risk score
     - risk delta since last refresh
     - agents protected / active / suspended
     - last heartbeat age
     - last event age
     - data freshness / stale state
  4. In Incident Triage, show:
     - open critical incidents
     - blocked actions
     - injection blocks
     - unresolved runtime incidents
     - time to acknowledge / time to contain if available
  5. In Trust / Compliance, show:
     - latest attestation age
     - latest verification age
     - ERC-8004 state
     - ERC-8126 state
     - wallet configured state
  6. Move token usage out of the main ops view. Put it in a separate usage/compliance area if you keep it at all.
  7. Keep the dashboard dense and operational, but reduce the visual noise from the current mixed layout.
  8. Make sure mobile still works, but do not let the mobile rewrite water down the operator hierarchy.
  9. Keep the current security styling, but make the hierarchy obvious.

  Acceptance criteria:
  - The page has a clear operator story.
  - Live posture, incidents, and trust/compliance are visually separated.
  - Token usage is not a top-line security metric anymore.
  - The dashboard feels like a decision surface, not a telemetry dump.

  Do not touch unrelated backend logic in this pass unless a small view/API adjustment is required for the layout.

  Prompt 2: Fix the data model and metrics so the dashboard tells the truth

  In console.labyrinthscout.com, fix the dashboard backend metrics and API semantics so the UI is showing the right
  data, not approximations disguised as facts.

  Known issues to address:
  - The AUDIT LOG panel is querying security_events, not the immutable audit log.
  - The incident type filter applies LIMIT before type filtering, which can hide matching incidents.
  - Threat metrics are semantically noisy and mix admin/control events into security threat counts.
  - Usage analytics are a rough token estimate and should be clearly separated from security posture.
  - The PDF export is fragile because it hardcodes PDF offsets.
  - The “last updated” timestamp can advance on SSE heartbeats even when nothing real changed.

  Tasks:
  1. Fix /api/dashboard/audit-log so it reads from the real audit log source, not security_events.
  2. Preserve support for search and limit, but make the result labels match the source of truth.
  3. Fix /api/trust/incidents so type filtering happens before the final limit, or do it in SQL if possible.
  4. Review incident classification in trust/incident-types.ts and make sure type1/type2/type3 labels are meaningful
  and not overbroad.
  5. Review threat-metrics.ts and reduce false grouping:
     - separate attack traffic from admin/control events
     - do not count generic warnings as “threats” unless they are actually security-relevant
     - expose blocked vs attack vs anomaly more clearly
  6. Review usage-analytics.ts and make it clear this is an estimate from event metadata, not billing-grade usage.
  7. Add or improve a metric for actual usage only if the source data exists. If not, label it as estimated.
  8. Fix the compliance PDF generation in trust-enterprise.ts so it does not rely on a hardcoded `startxref`.
  9. Make the “last updated” indicator update only when a real metric refresh happens, not every SSE heartbeat.
  10. If any current labels are misleading, correct the labels instead of keeping them for compatibility.

  Files to inspect first:
  - src/api/dashboard.ts
  - src/api/trust-enterprise.ts
  - src/trust/incident-types.ts
  - src/trust/compute-trust-metrics.ts
  - src/dashboard/widgets/threat-metrics.ts
  - src/dashboard/widgets/usage-analytics.ts
  - src/audit/audit-logger.ts
  - public/dashboard/js/widgets/live-feed.js

  Acceptance criteria:
  - The audit panel shows the actual audit log source.
  - Incident filtering is correct.
  - Threat counts are more precise and less noisy.
  - Usage is clearly labeled as estimated if it is not authoritative.
  - The compliance PDF export is structurally valid.
  - The dashboard timestamps do not imply data changed when only a heartbeat arrived.

  Add tests for the changed semantics.

  Prompt 3: Add the missing metrics that matter

  In console.labyrinthscout.com, extend the dashboard with the metrics that actually help an operator make a decision,
  and avoid adding vanity counters.

  Add these missing metrics if the data exists:
  1. Data freshness
  - heartbeat age
  - last event age
  - SSE / subscriber health
  - stale reason

  2. Risk movement
  - risk score delta vs last refresh
  - 24h / 7d trend if the data store allows it
  - incident rate change over time

  3. Incident operations
  - open incidents count
  - acknowledged incidents count
  - unresolved criticals
  - time to acknowledge
  - time to contain
  - time to resolve
  - repeat incident count

  4. Trust state
  - last attestation age
  - last verification age
  - attestation/verification status
  - wallet configured state
  - on-chain request/response state

  5. Control-plane health
  - alert channels configured
  - deception enabled
  - egress filter enabled
  - sandbox enabled
  - redis/db connectivity
  - kill switch armed/disarmed state

  6. Attack detail
  - top tool names
  - top blocked destinations or sources
  - top instance IDs
  - top patterns
  - attack count by incident type

  What not to add as headline metrics:
  - token usage on the security dashboard
  - generic event counts without context
  - compliance exports as a top-level posture signal
  - any metric that cannot be interpreted without another page

  Tasks:
  - Add a visible freshness/status block near the top.
  - Add a risk delta indicator.
  - Add a compact incident ops summary.
  - Add trust health indicators.
  - Add control-plane health indicators if the backing endpoints exist.
  - Keep the main dashboard focused on operational security, not billing or marketing.

  If a metric is not available from the current schema, do not invent it. Either derive it correctly or leave it out.

  Prompt 4: Add tests and clean up the widget wiring

  In console.labyrinthscout.com, add tests for the dashboard changes and fix any widget wiring issues exposed by the
  refactor.

  Tasks:
  1. Add or update tests for:
     - audit log reads from the correct source
     - incident filtering before limit
     - threat metric classification
     - usage analytics labeled as estimated
     - trust history rendering
     - freshness/stale logic
     - compliance PDF generation
  2. Verify all dashboard widget script includes exist and are loaded in the correct order.
  3. Check for missing or dead includes in public/dashboard.html.
  4. Make sure the live-feed/SSE updates only refresh what should refresh.
  5. Ensure the dashboard still loads with no console errors after the changes.
  6. Keep changes focused to the dashboard and its APIs.

  Acceptance criteria:
  - Tests fail before the fix and pass after.
  - The dashboard loads cleanly with no broken widget references.
  - The new sections render with real data where available.


