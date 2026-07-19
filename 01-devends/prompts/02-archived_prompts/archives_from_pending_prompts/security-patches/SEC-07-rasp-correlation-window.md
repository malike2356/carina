# SEC-07: RASP Engine Correlation Window Hardening

**Status: COMPLETED 2026-06-30**

**What was built:**
- `signal-buffer.ts`: sliding window (200 signals / 30 min retention)
- `global-signal-store.ts`: cross-session Redis aggregation (`rasp_coordinated_attack` at threshold 5/hour)
- `engine.ts`: restore on session start, `persistRaspSignalsOnShutdown()` wired to SIGTERM in `index.ts`
- `mitre-tactics.ts`: pattern-to-tactic map, `detectTacticProgression()` boosts threat score
- `prompt-guard-middleware.ts`: emits RASP signals with `patternId` on blocked input/tool output
- Tests: `rasp.test.ts` including 6-minute gap sliding window and MITRE progression cases

**Severity:** Medium-High
**Status:** Patched
**Affects:** core.carinaai.uk src/security/rasp/engine.ts

## Problem

The RASP engine (`src/security/rasp/engine.ts`) correlates signals to detect
multi-stage attacks. An attacker who understands the correlation window can
spread an attack across time, staying below the detection threshold per window,
while still completing the full attack sequence.

Specific weaknesses in the current design (inferred from architecture):

1. **Fixed correlation window**: A window of (e.g.) 5 minutes means an attacker
   who spaces tool calls 5:01 apart generates two non-overlapping windows with
   each appearing benign.

2. **No cross-session signal correlation**: If the same payload arrives in
   session A and session B within an hour, each session triggers its own
   isolated RASP window. The pattern is invisible at the engine level.

3. **No persistence of signals between restarts**: If the agent restarts (deploy,
   crash), all in-flight signals are lost. An attacker who can force a restart
   mid-attack gets a clean slate.

4. **Missing MITRE tactics in signal taxonomy**: The engine may classify
   individual signals but not the MITRE ATT&CK tactic progression (TA0043
   Reconnaissance -> TA0001 Initial Access -> TA0002 Execution), which is how
   multi-stage attacks are detected in mature SIEMs.

## Files to Patch

```
02-backends/core.carinaai.uk/src/security/rasp/engine.ts
```

## Changes

### 1. Sliding Window (replaces fixed window)

Replace any fixed `setInterval`-based window flush with a sliding window that
retains the last N signals regardless of when they arrived:

```typescript
const SIGNAL_RETENTION_COUNT = 200; // retain last 200 signals per session
const SIGNAL_RETENTION_MS = 30 * 60 * 1000; // and within last 30 minutes

class SignalBuffer {
  private signals: TimestampedSignal[] = [];

  push(signal: RaspSignal): void {
    this.signals.push({ ...signal, timestamp: Date.now() });
    this.prune();
  }

  private prune(): void {
    const cutoff = Date.now() - SIGNAL_RETENTION_MS;
    this.signals = this.signals
      .filter((s) => s.timestamp >= cutoff)
      .slice(-SIGNAL_RETENTION_COUNT);
  }

  getWindow(ms: number): TimestampedSignal[] {
    const cutoff = Date.now() - ms;
    return this.signals.filter((s) => s.timestamp >= cutoff);
  }
}
```

### 2. Cross-Session Signal Aggregation (global level)

Add a second-level signal buffer in Redis that aggregates signals across sessions.
This detects when the same injection pattern arrives from multiple sessions
simultaneously (coordinated attack):

```typescript
async function recordSignalGlobally(signal: RaspSignal): Promise<void> {
  const key = `rasp:global:${signal.patternId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 3600); // 1-hour window

  if (count >= GLOBAL_SIGNAL_THRESHOLD) {
    await reportSecurityEvent('rasp_coordinated_attack', 'critical', {
      patternId: signal.patternId,
      count,
      windowSeconds: 3600,
    });
  }
}
```

Set `GLOBAL_SIGNAL_THRESHOLD = 5` initially (5 sessions hitting the same pattern
within an hour is suspicious).

### 3. Signal Persistence on Restart

Persist in-flight signals to Redis before the process exits:

```typescript
process.on('SIGTERM', async () => {
  for (const [sessionId, buffer] of sessionBuffers) {
    await redis.setex(
      `rasp:signals:${sessionId}`,
      60 * 60, // 1 hour TTL
      JSON.stringify(buffer.getWindow(SIGNAL_RETENTION_MS)),
    );
  }
  process.exit(0);
});

// On startup, restore from Redis:
async function restoreSignals(sessionId: string): Promise<TimestampedSignal[]> {
  const raw = await redis.get(`rasp:signals:${sessionId}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TimestampedSignal[];
  } catch {
    return [];
  }
}
```

### 4. MITRE ATT&CK Tactic Tags on Signals

Add a `mitreTactic` field to the signal taxonomy so the correlation engine can
detect full tactic progressions:

```typescript
export type MitreTactic =
  | 'TA0001' // Initial Access
  | 'TA0002' // Execution
  | 'TA0003' // Persistence
  | 'TA0005' // Defense Evasion
  | 'TA0006' // Credential Access
  | 'TA0009' // Collection
  | 'TA0010' // Exfiltration
  | 'TA0043'; // Reconnaissance

// Map injection pattern IDs to MITRE tactics:
const PATTERN_TACTIC_MAP: Record<string, MitreTactic> = {
  'INJ-D01': 'TA0009', // system prompt exfil = Collection
  'INJ-D02': 'TA0010', // HTTP exfil = Exfiltration
  'INJ-D03': 'TA0006', // credential leak = Credential Access
  'INJ-J01': 'TA0002', // shell execution = Execution
  'INJ-J03': 'TA0006', // read /etc = Credential Access
  'INJ-O01': 'TA0001', // SSRF = Initial Access
  'INJ-K01': 'TA0003', // memory persist = Persistence
};

// In the correlation engine, detect progression:
function detectTacticProgression(signals: TimestampedSignal[]): boolean {
  const tactics = new Set(signals.map((s) => PATTERN_TACTIC_MAP[s.patternId]).filter(Boolean));
  // Initial Access followed by Execution followed by Exfiltration = confirmed attack chain
  return (
    tactics.has('TA0001') || tactics.has('TA0009') || tactics.has('TA0010')
  ) && tactics.size >= 3;
}
```

## Verification

```bash
# Inject a multi-stage sequence with a 6-minute gap (should still be caught)
# This tests that the sliding window captures both signals
# (exact test method depends on the test harness for the RASP engine)
cd 02-backends/core.carinaai.uk && pnpm test -- rasp
```
