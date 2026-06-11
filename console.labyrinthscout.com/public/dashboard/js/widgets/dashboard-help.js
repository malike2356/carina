(function () {
  'use strict';

  var HELP = {
    'section-live-posture': {
      title: 'Live Posture',
      means: 'A snapshot of whether Scout is receiving telemetry and how exposed your agents are right now.',
      detected: 'Stale when heartbeat or events are older than 10 minutes. Risk score rises with breaches, criticals, and suspended agents.',
      action: 'If stale, check agent connectivity and SSE. If risk is rising, open Incident Triage and the live event stream.',
    },
    'section-incident-triage': {
      title: 'Incident Triage',
      means: 'Open security work that still needs an operator decision.',
      detected: 'Counts critical/breach events that are not acknowledged or mitigated, plus 24h defensive blocks.',
      action: 'Acknowledge handled events in the live stream. Investigate unresolved criticals first; use KILL or session block if compromise is suspected.',
    },
    'section-trust': {
      title: 'Trust / Compliance',
      means: 'On-chain attestation and verification state for public trust reporting.',
      detected: 'Shows ages since last ERC-8004 attestation and ERC-8126 verification, plus wallet configuration.',
      action: 'If attestation is old, run trust:attest. If wallet is not set, configure TRUST_ATTESTER_PRIVATE_KEY before production attestation.',
    },
    'section-action-queue': {
      title: 'Action Queue',
      means: 'Prioritized list of items that need operator attention now.',
      detected: 'Built from unresolved criticals, stale telemetry, kill switch state, missing alerts, offline agents, and wallet gaps.',
      action: 'Work top to bottom. Each item links to the metric or control that resolves it.',
    },
    'posture-risk-score': {
      title: 'Risk Score',
      means: 'Unified 0-100 score derived from runtime incidents, breaches, warnings, and agent health.',
      detected: 'Increases with 30d runtime incidents, breaches, 24h warnings, and agents offline or suspended.',
      action: 'Below 40: monitor. 40-60: review incidents. Above 60: triage immediately. Delta shows change since your last refresh.',
    },
    'posture-agents-active': {
      title: 'Agents Active',
      means: 'Carina instances sending heartbeats within the last 90 seconds and not suspended.',
      detected: 'Zero active with total > 0 means all agents offline or suspended.',
      action: 'Check instance heartbeats, network path to Scout, and whether kill switch or manual suspend is in effect.',
    },
    'posture-heartbeat': {
      title: 'Last Heartbeat',
      means: 'Most recent agent heartbeat received by Scout.',
      detected: 'Older than 90s marks agents offline. Stale alongside events triggers data freshness warning.',
      action: 'Verify the agent process is running, SCOUT endpoint is reachable, and clock skew is minimal.',
    },
    'posture-last-event': {
      title: 'Last Event',
      means: 'Most recent security event ingested into Scout.',
      detected: 'Long gap with fresh heartbeat may mean quiet period; long gap with stale heartbeat means ingestion or agent issue.',
      action: 'Confirm events API and Redis pub/sub if heartbeats arrive but events do not.',
    },
    'posture-freshness': {
      title: 'Data Freshness',
      means: 'Whether dashboard metrics reflect live telemetry or outdated state.',
      detected: 'STALE when last heartbeat and last event are both older than 10 minutes.',
      action: 'Check agent connectivity, Redis, database, and SSE stream. Refresh after restoring telemetry.',
    },
    'posture-kill-switch': {
      title: 'Kill Switch',
      means: 'Global emergency control that suspends all active agents.',
      detected: 'TRIGGERED means a kill was executed; ARMED means ready but not triggered.',
      action: 'Use only for confirmed compromise. After trigger, investigate, then resume instances individually when safe.',
    },
    'incident-open-critical': {
      title: 'Open Critical',
      means: 'Critical or breach severity events not yet acknowledged or mitigated.',
      detected: 'Any unacked critical/breach in the last 24h window.',
      action: 'Open live event stream, ACK false positives, block sessions or KILL agent for confirmed threats.',
    },
    'incident-blocked': {
      title: 'Blocked (24h)',
      means: 'Defensive actions Scout took to stop malicious or policy-violating activity.',
      detected: 'Includes injection blocks, egress blocks, quarantine, and similar mitigations.',
      action: 'Review top blocked destinations and tools. Add persistent blocks if attack pattern repeats.',
    },
    'incident-injection': {
      title: 'Injection Blocks',
      means: 'Prompt injection attempts stopped by the shield in the last 24 hours.',
      detected: 'Events matching injection patterns in event_type or metadata.',
      action: 'Inspect patterns in live stream. If volume spikes, throttle session and review agent prompts and RAG sources.',
    },
    'incident-acknowledged': {
      title: 'Acknowledged',
      means: 'Incidents an operator has reviewed and suppressed from repeat alerting.',
      detected: 'Events with acknowledged=true. Avg time to ack shows response speed.',
      action: 'Ack only after triage. Use Hide acknowledged filter in stream to focus on new work.',
    },
    'incident-runtime': {
      title: 'Runtime Unresolved',
      means: 'Runtime, injection, or breach-related events still open.',
      detected: 'Unacked/unmitigated events matching runtime or attack categories.',
      action: 'Prioritize Type 1 runtime escapes. Quarantine tools and block egress domains as needed.',
    },
    'incident-rate': {
      title: 'Incident Rate',
      means: 'Change in warning/critical/breach volume vs the prior 24h period.',
      detected: 'Positive % means more incidents than yesterday; negative means fewer.',
      action: 'Rising rate with stale data: fix telemetry first. Rising rate with fresh data: escalate triage.',
    },
    'trust-attestation': {
      title: 'Last Attestation',
      means: 'Most recent ERC-8004 on-chain attestation of agent trust posture.',
      detected: 'none if no attestation has been submitted for this identity.',
      action: 'Run pnpm trust:attest from console.labyrinthscout.com when wallet is configured.',
    },
    'trust-verification': {
      title: 'Last Verification',
      means: 'Most recent ERC-8126 unified risk verification on chain.',
      detected: 'Shows age since last submitted verification with WAV/WV scores.',
      action: 'Schedule regular verification via trust:verify. Investigate if risk score jumps between verifications.',
    },
    'trust-wallet': {
      title: 'Wallet',
      means: 'Whether TRUST_ATTESTER_PRIVATE_KEY is configured for on-chain writes.',
      detected: 'NOT SET when attester key is missing or placeholder.',
      action: 'Set wallet key in environment before production attestation. Never commit keys to git.',
    },
    'trust-risk-tier': {
      title: 'Risk Tier',
      means: 'Human-readable band for the unified risk score (low through critical).',
      detected: 'Derived from the same inputs as risk score; may reflect on-chain verification when present.',
      action: 'Use tier for reporting. Drill into incidents when tier is elevated or rising.',
    },
    'panel-top-tools': {
      title: 'Top Tools (Blocked)',
      means: 'Agent tools most often blocked or quarantined in the last 24 hours.',
      detected: 'Ranked from blocked/quarantine event metadata.',
      action: 'Quarantine abusive tools from instance bar TOOLS modal. Review agent skill packs using those tools.',
    },
    'panel-top-destinations': {
      title: 'Top Blocked Destinations',
      means: 'Hostnames or egress targets Scout blocked most often.',
      detected: 'From egress_blocked and related events with hostname metadata.',
      action: 'Add persistent domain blocks via EGRESS on instance bar. Investigate if legitimate API was blocked.',
    },
    'panel-control-plane': {
      title: 'Control Plane',
      means: 'Health of Scout infrastructure: alerts, deception, filters, database, Redis, SSE.',
      detected: 'Shows connected/disabled state for each subsystem.',
      action: 'Fix red items first: configure alert channels, restore Redis/DB, deploy honeypots for deception.',
    },
    'panel-attacks-by-type': {
      title: 'Attacks by Type',
      means: 'Incident classification breakdown (Type 1 runtime, Type 2 privilege, Type 3 reasoning).',
      detected: 'Classified from event_type and description using Scout incident taxonomy.',
      action: 'Type 1: sandbox/runtime. Type 2: egress/privilege. Type 3: injection/reasoning. Triage by type in admin incident timeline.',
    },
    'panel-threat-radar': {
      title: 'Threat Radar',
      means: 'Visual map of recent events by severity ring. Sweep highlights recent activity.',
      detected: 'Dots appear on new events; red flash on critical/breach.',
      action: 'Use with live stream for situational awareness. Click through to stream rows for detail and ACK.',
    },
    'panel-live-stream': {
      title: 'Live Event Stream',
      means: 'Real-time security events from all protected instances.',
      detected: 'New rows appear via SSE. Severity color indicates urgency.',
      action: 'ACK reviewed events. BLOCK/THROTTLE/CLEAR MEM on suspicious sessions. Hide acknowledged to reduce noise.',
    },
    'stat-critical': {
      title: 'Critical (24h)',
      means: 'High-severity security events in the last 24 hours.',
      detected: 'severity=critical in security_events, excluding routine tool_call noise.',
      action: 'Triage each critical in the stream. KILL or quarantine if tool abuse or injection confirmed.',
    },
    'stat-warning': {
      title: 'Warning (24h)',
      means: 'Moderate anomalies or policy notices in the last 24 hours.',
      detected: 'severity=warning events. Not all warnings are attacks; check event_type.',
      action: 'Review context. Acknowledge benign warnings to reduce alert fatigue.',
    },
    'stat-info': {
      title: 'Info (24h)',
      means: 'Informational telemetry and normal operational events.',
      detected: 'severity=info including heartbeats, tool calls, and routine ops.',
      action: 'Usually no action. Spikes may indicate misconfigured logging or flood attack.',
    },
    'stat-breach': {
      title: 'Breach (24h)',
      means: 'Confirmed or suspected compromise-level events requiring immediate response.',
      detected: 'severity=breach: honeypot triggers, kill switch, or explicit breach classification.',
      action: 'Immediate: KILL affected instance, block session, review audit log. Do not resume until root cause is contained.',
    },
    'panel-event-frequency': {
      title: 'Event Frequency',
      means: 'Rolling 60-minute histogram weighted by severity.',
      detected: 'Bar height reflects critical/warning/info/breach mix per minute.',
      action: 'Sudden spikes: check stream for new event types. Sustained elevation: review anomaly chart.',
    },
    'panel-anomaly': {
      title: 'Anomaly Z-Score',
      means: 'Statistical deviation of event rate vs baseline over 10 minutes.',
      detected: 'Z > 3 crosses threshold line; injection overlay shows injection rate.',
      action: 'Investigate when Z exceeds 3. Correlate with incident triage and top event types.',
    },
    'panel-tool-heatmap': {
      title: 'Tool Heatmap',
      means: 'Which agent tools fired in each hour over the last 24h.',
      detected: 'Intensity shows tool_call volume by tool and hour.',
      action: 'Unusual off-hours tool use: inspect sessions. Concentrated file-write or shell-exec: prioritize review.',
    },
    'panel-severity-mix': {
      title: 'Severity Mix',
      means: 'Proportion of event severities in the last 24 hours.',
      detected: 'Donut segments sized by critical/warning/info/breach counts.',
      action: 'Healthy posture is mostly info with zero breach. Growing critical slice needs triage.',
    },
    'panel-threat-level': {
      title: 'Threat Level Gauge',
      means: 'Canvas gauge from 24h severity counts: breach x20 + critical x4 + warning x2, max 100.',
      detected: 'Needle position reflects formula, not identical to unified risk score above.',
      action: 'Use as tactical 24h pulse. Cross-check with Live Posture risk score for operator decisions.',
    },
    'panel-top-events': {
      title: 'Top Event Types',
      means: 'Most frequent event_type values in the last 24 hours.',
      detected: 'Red bars: attack/blocked. Amber: anomaly. Green: normal ops.',
      action: 'Drill into dominant red types in live stream. Block or quarantine recurring abuse patterns.',
    },
    'admin-token-usage': {
      title: 'Estimated Token Usage',
      means: 'Rough token estimate from event metadata, not billing-grade metering.',
      detected: 'Parsed from tokens_used or total_tokens fields when present on events.',
      action: 'Use Carina billing/usage views for authoritative counts. Treat this as a directional gauge only.',
    },
    'admin-audit-log': {
      title: 'Immutable Audit Log',
      means: 'Append-only record of admin, auth, tool, model, and security audit actions.',
      detected: 'Queries audit_log table, not security_events.',
      action: 'Search by action or admin email. Export CSV for compliance. Investigate unexpected admin actions.',
    },
    'admin-compliance': {
      title: 'Compliance Report',
      means: 'SOC2, ISO27001, and EU AI Act readiness export from live Scout telemetry.',
      detected: 'Generated on demand as JSON or PDF.',
      action: 'Export for auditor reviews. Keep JSON for automation; PDF for human sign-off.',
    },
  };

  function openHelp(key) {
    var entry = HELP[key];
    if (!entry) return;
    document.getElementById('help-title').textContent = entry.title;
    document.getElementById('help-means').textContent = entry.means;
    document.getElementById('help-detected').textContent = entry.detected;
    document.getElementById('help-action').textContent = entry.action;
    document.getElementById('help-overlay').removeAttribute('hidden');
  }

  function closeHelp() {
    document.getElementById('help-overlay').setAttribute('hidden', '');
  }

  function injectInfoButtons() {
    document.querySelectorAll('[data-help]').forEach(function (el) {
      if (el.querySelector('.metric-info-btn')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'metric-info-btn';
      btn.setAttribute('aria-label', 'Help for ' + ((HELP[el.dataset.help] && HELP[el.dataset.help].title) || el.dataset.help));
      btn.textContent = 'i';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openHelp(el.dataset.help);
      });
      el.appendChild(btn);
    });
  }

  window.DashboardHelp = { open: openHelp, close: closeHelp, inject: injectInfoButtons };
  window.closeHelp = closeHelp;

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeHelp();
  });

  var helpOverlay = document.getElementById('help-overlay');
  if (helpOverlay) {
    helpOverlay.addEventListener('click', function (e) {
      if (e.target === helpOverlay) closeHelp();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectInfoButtons);
  } else {
    injectInfoButtons();
  }
})();
