# Phase 5.3; Scout Dashboard 2.0 + Advanced Security

## Task
Build Scout Dashboard 2.0; real-time monitoring for all Carina agents, threat analytics, compliance reporting, and advanced security features.

## Specification

### Real-time monitoring
- All active agents visible on one dashboard
- Per-agent: session status, tool usage, token consumption, threat level
- Live feed: tool calls as they happen (WebSocket or polling)
- Color-coded threat levels: green (clean), amber (unusual), red (attack detected)

### Threat analytics
- Injection attempts: count, source, pattern, blocked/passed
- Anomaly detection: unusual tool sequences, spikes in activity
- Trend lines: attacks over time (24h, 7d, 30d)
- Top attackers: IP addresses, patterns, targeted workspaces

### Alert configuration
```json
{
  "alerts": {
    "injection_attempt": { "severity": "critical", "channels": ["telegram", "email"] },
    "anomaly_detected": { "severity": "warning", "channels": ["telegram"] },
    "rate_limit_exceeded": { "severity": "info", "channels": ["dashboard"] },
    "kill_switch_triggered": { "severity": "critical", "channels": ["telegram", "email", "sms"] }
  }
}
```

### Usage analytics
- Tokens consumed per workspace per day/week/month
- Tool usage frequency and patterns
- Cost projection based on historical data
- Local vs cloud model usage ratio
- Savings from local routing

### Compliance reporting
- GDPR compliance verification (data retention, right to access, right to delete)
- Exportable audit reports (CSV, PDF)
- Custom report builder (select date range, workspaces, event types)
- Scheduled reports (weekly security summary to admin email)

### Advanced security features

1. Moving target deception (enhanced)
   - Rotate system prompt markers every N minutes
   - Randomize tool names in system instructions
   - Inject decoy credentials that trigger alerts if leaked

2. Behavioral baseline
   - Learn normal usage patterns per user
   - Alert on deviation (sudden spike, unusual tools, odd hours)
   - Self-tuning: baseline updates over time

3. Threat intelligence feed
   - Subscribe to known injection pattern databases
   - Community-shared threat signatures
   - Auto-update shield rules

### Dashboard UI
```
+--------------------------------------------------+
| SCOUT DASHBOARD                     [KILL SWITCH] |
+--------------------------------------------------+
| Agents: 3 active | Threats: 0 | Blocked: 12      |
+--------------------------------------------------+
| Agent         | Status  | Tools | Tokens | Threat |
| carina-main   | active  | 5     | 2.3K   | GREEN  |
| carina-worker1| active  | 2     | 1.1K   | GREEN  |
| carina-cron   | idle    | 0     | 0      | -      |
+--------------------------------------------------+
| LIVE FEED                                        |
| 14:32:01 carina-main | tool:terminal | exit:0    |
| 14:32:03 carina-main | tool:read_file | ok       |
+--------------------------------------------------+
| ATTACKS (24h)                                    |
| [===-------] 3 injection attempts, all blocked   |
+--------------------------------------------------+
```

## Implementation notes
- Dashboard: separate web app or integrated into existing admin
- WebSocket for live feed, fallback to polling
- Data stored in Scout audit database
- Charts: Chart.js for simplicity

## Verification
```bash
# Access dashboard
open https://core.carinaai.uk/scout

# Send injection prompt
# Verify: appears in live feed, threat counter increments

# Trigger kill switch
# Verify: all agents stop, critical alert sent

# Export compliance report
# Verify: CSV contains all required fields
```
