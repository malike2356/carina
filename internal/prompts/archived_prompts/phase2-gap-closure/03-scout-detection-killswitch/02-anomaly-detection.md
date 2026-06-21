# Phase 2.9; Heuristic Anomaly Detection

## Goal
Build Scout's behavioral anomaly detection. Instead of relying solely on known attack patterns, Scout learns normal usage patterns per tenant and alerts on deviations. This catches novel attacks that pattern matching would miss.

## Files to create
```
packages/scout/src/
  anomaly/
    anomaly-detector.ts; Core detection engine
    behavior-baseline.ts; Tenant behavior profiling
    anomaly-types.ts; Detectable anomaly definitions
    baseline-store.ts; Persisted baselines per tenant
    anomaly-config.ts; Detection sensitivity settings
    anomaly-alert.ts; Alert formatting for anomalies
```

## Anomaly types detected

### 1. Token usage spike
```
Normal: tenant-07 uses ~50K tokens/day
Anomaly: tenant-07 uses 500K tokens in 1 hour (10x normal rate)
Alert: HIGH; "Token usage spike: 10x normal rate for tenant-07"
```
Detection: rolling 24h average ± 3 standard deviations

### 2. Unusual tool sequence
```
Normal: tenant-07 uses: chat → terminal → chat → read_file → chat
Anomaly: tenant-07 uses: terminal → terminal → terminal → delete → terminal (all in 30s)
Alert: MEDIUM; "Unusual tool sequence: rapid terminal + delete operations"
```
Detection: Markov chain of tool transitions, alert on low-probability sequences

### 3. Access at unusual hours
```
Normal: tenant-07 active 08:00-22:00 UTC
Anomaly: tenant-07 active at 03:00 UTC
Alert: LOW; "Unusual access time: 03:00 UTC for tenant-07"
```
Detection: time-of-day histogram per tenant

### 4. New tool usage
```
Normal: tenant-07 uses: chat, terminal, read_file, search
Anomaly: tenant-07 uses: write_file, delete (never used before)
Alert: MEDIUM; "First-time tool usage: delete by tenant-07"
```
Detection: tool registry per tenant, flag first use of any tool

### 5. Rapid tool cycling
```
Normal: 1-3 tools per minute
Anomaly: 15+ tool calls in 60 seconds
Alert: HIGH; "Rapid tool cycling: 15 calls/60s for tenant-07"
```
Detection: sliding window tool call rate

### 6. Sensitive tool access
```
Normal: tenant-07 uses: chat, search, read_file
Anomaly: tenant-07 uses: terminal with sudo, write to /etc/
Alert: CRITICAL; "Sensitive tool access: sudo terminal by tenant-07"
```
Detection: predefined sensitive tool/parameter combinations

### 7. New IP / location
```
Normal: tenant-07 accesses from IP 192.168.1.45 (London)
Anomaly: tenant-07 accesses from IP 203.0.113.5 (Unknown location)
Alert: MEDIUM; "New access location for tenant-07"
```
Detection: IP geolocation, flag on new country/city

## Baseline learning
```typescript
class BehaviorBaseline {
  // Learned over 7 days of normal usage
  token_usage_daily_avg: number;
  token_usage_daily_stddev: number;
  active_hours: number[]; // 24-element array, 0-1 probability per hour
  tool_transition_probs: Map<string, Map<string, number>>;
  known_ips: Set<string>;
  known_locations: Set<string>;
  typical_tool_rate_per_minute: number;
  
  // Updated weekly
  last_updated: Date;
  confidence: number; // 0-1, increases with more data
}
```

## Sensitivity configuration
```typescript
interface AnomalyConfig {
  sensitivity: 'low' | 'medium' | 'high'; // Default: 'medium'
  
  // Low = fewer false positives, may miss subtle attacks
  // High = catch everything, more false positives
  
  token_spike_multiplier: number; // Default: 3.0 (3x normal)
  tool_rate_threshold: number; // Default: 10 per minute
  unusual_hour_threshold: number; // Default: 2 AM - 6 AM UTC
  min_baseline_days: number; // Default: 7 (baseline learning period)
}
```

## Response to anomalies
| Anomaly | Severity | Auto-action |
|---|---|---|
| Token spike 3x | MEDIUM | Log, alert dashboard |
| Token spike 10x | HIGH | Alert dashboard + Telegram, temporary rate limit |
| Unusual tool seq | MEDIUM | Log, alert dashboard |
| Sensitive tool | CRITICAL | Alert all channels, require admin approval |
| New IP | LOW | Log, add to known IPs if sustained for 3 days |
| Rapid cycling | HIGH | Alert, temporary rate limit |
| Off-hours access | LOW | Log |

## Verification
```bash
# 1. Establish baseline (7 days of normal usage)

# 2. Simulate token spike
# Make 10x normal API calls in 1 hour
# Expected: HIGH alert within 15 minutes

# 3. Simulate unusual tool sequence  
# Run: terminal → delete → terminal → delete rapidly
# Expected: MEDIUM alert

# 4. Simulate new IP access
# Access from VPN
# Expected: LOW alert, dashboard notification

# 5. Check baseline data
curl /api/admin/scout/anomaly/baselines
# Expected: baseline data for each tenant
```
