# Security 09; Unified RASP Engine (Runtime Application Self-Protection)

**Source:** NEW (No agent has this. Carina's existing detection systems provide the signals.)
**Effort:** 4 weeks

---

## SPECIFICATION

Carina has separate detection systems: prompt guard, tool sequence guard, egress filter, trust scoring. A unified RASP engine correlates ALL signals into a single threat assessment with confidence scoring and automated response.

### Architecture

```
                    ┌──────────────────────────────┐
                    │       RASP ENGINE            │
                    │                              │
  Prompt Guard ────→│  ┌────────────────────────┐  │
  Tool Seq Guard ──→│  │   SIGNAL CORRELATOR     │  │
  Egress Filter ───→│  │   Weight + normalize    │  │──→ Threat Score (0-100)
  Trust State ─────→│  │   Cross-reference       │  │
  Honeypot ────────→│  └────────┬───────────────┘  │──→ Attack Graph
  Anomaly Detector →│           │                   │
  Behavior Log ────→│  ┌────────▼───────────────┐  │──→ Confidence (0-1)
                    │  │   ATTACK GRAPH BUILDER  │  │
                    │  │   Map attack paths      │  │──→ Response Decision
                    │  │   Identify TTPs         │  │
                    │  └────────┬───────────────┘  │──→ Automated Action
                    │           │                   │
                    │  ┌────────▼───────────────┐  │
                    │  │ RESPONSE DISPATCHER     │  │
                    │  │ Block | Contain | Log   │  │
                    │  │ Alert | Rotate | Kill   │  │
                    │  └────────────────────────┘  │
                    └──────────────────────────────┘
```

### Implementation

```typescript
// security/rasp/engine.ts

interface RASPSignal {
  source: string; // 'prompt_guard' | 'tool_sequence' | 'egress_filter' | 'trust_state' | 'honeypot' | 'anomaly'
  type: string; // specific detection type
  severity: number; // 0-1 severity
  confidence: number; // 0-1 confidence
  timestamp: number;
  context: {
    sessionId: string;
    agentId: string;
    toolName?: string;
    details: Record<string, unknown>;
  };
}

interface ThreatAssessment {
  threatScore: number; // 0-100
  confidence: number; // 0-1
  attackType: string | null; // classified attack type
  mitreTactic: string | null; // MITRE ATT&CK tactic
  signals: RASPSignal[]; // all correlated signals
  attackGraph: AttackNode[]; // attack path
  decision: ResponseDecision; // automated response
  timestamp: number;
}

class RASPEngine {
  private signalBuffer: RASPSignal[] = [];
  private readonly CORRELATION_WINDOW = 30000; // 30 seconds

  /**
   * Ingest a new signal and assess the threat.
   */
  async ingest(signal: RASPSignal): Promise<ThreatAssessment> {
    // Add to buffer
    this.signalBuffer.push(signal);
    
    // Prune old signals
    this.signalBuffer = this.signalBuffer.filter(
      s => signal.timestamp - s.timestamp < this.CORRELATION_WINDOW
    );

    // Correlate; weight and combine all signals
    const correlatedSignals = this.correlate(signal);
    
    // Build attack graph
    const attackGraph = this.buildAttackGraph(correlatedSignals);
    
    // Compute threat score
    const threatScore = this.computeThreatScore(correlatedSignals, attackGraph);
    
    // Classify attack
    const { attackType, mitreTactic } = this.classifyAttack(correlatedSignals, attackGraph);
    
    // Decide response
    const decision = this.decideResponse(threatScore, attackType);
    
    // Execute response if confidence is high enough
    if (decision.autoExecute) {
      await this.executeResponse(decision);
    }

    return {
      threatScore,
      confidence: this.computeConfidence(correlatedSignals),
      attackType,
      mitreTactic,
      signals: correlatedSignals,
      attackGraph,
      decision,
      timestamp: Date.now(),
    };
  }

  private correlate(newSignal: RASPSignal): RASPSignal[] {
    // Weight: prompt_guard (0.3), tool_sequence (0.25), egress_filter (0.2),
    //         trust_state (0.15), honeypot (0.05), anomaly (0.05)
    const weights: Record<string, number> = {
      prompt_guard: 0.30,
      tool_sequence: 0.25,
      egress_filter: 0.20,
      trust_state: 0.15,
      honeypot: 0.05,
      anomaly: 0.05,
    };

    // Cross-reference: do multiple detectors agree?
    // Higher weight when multiple sources flag the same session
    const sessionSignals = this.signalBuffer.filter(
      s => s.context.sessionId === newSignal.context.sessionId
    );
    
    const uniqueSources = new Set(sessionSignals.map(s => s.source));
    const crossReferenceBonus = (uniqueSources.size - 1) * 0.15;

    return sessionSignals.map(s => ({
      ...s,
      severity: Math.min(1, s.severity * (1 + crossReferenceBonus)),
    }));
  }

  private decideResponse(threatScore: number, attackType: string | null): ResponseDecision {
    if (threatScore >= 90) {
      return {
        action: 'kill',
        description: `Critical threat detected (${attackType}). Activating kill switch.`,
        autoExecute: true,
      };
    }
    if (threatScore >= 70) {
      return {
        action: 'contain',
        description: `High threat (${attackType}). Containing session.`,
        autoExecute: true,
      };
    }
    if (threatScore >= 50) {
      return {
        action: 'alert',
        description: `Medium threat (${attackType}). Alerting security team.`,
        autoExecute: false, // Human review for medium
      };
    }
    return {
      action: 'log',
      description: 'Low threat. Logging for audit.',
      autoExecute: false,
    };
  }
}
```

### Response Levels

| Score | Action | Auto? | Description |
|-------|--------|-------|-------------|
| 90-100 | KILL | Done:  | Emergency shutdown. Activate kill switch. Notify security team. Capture forensic snapshot. |
| 70-89 | CONTAIN | Done:  | Block session. Isolate agent. Disable outbound network. Alert security. |
| 50-69 | ALERT | Failed:  | Flag for human review. Show in security dashboard. |
| 25-49 | MONITOR | Failed:  | Increase logging verbosity. Watch for escalation. |
| 0-24 | LOG | Failed:  | Record for audit. No action needed. |

### Integration with Existing Carina Systems

```typescript
// RASP ingests from:
// security/prompt-guard.ts → RASPSignal { source: 'prompt_guard' }
// security/tool-sequence-guard.ts → RASPSignal { source: 'tool_sequence' }
// security/egress-filter.ts → RASPSignal { source: 'egress_filter' }
// security/trust-state.ts → RASPSignal { source: 'trust_state' }
// security/honeypot-client.ts → RASPSignal { source: 'honeypot' }
// telemetry/agent-behavior-log.ts → RASPSignal { source: 'anomaly' }

// RASP outputs to:
// security/kill-switch-listener.ts → KILL action
// security/shield-report.ts → CONTAIN action
// forensics/evidence-capture.ts → forensic snapshot
// notifications/ → alerts
```

### CLI Commands

```
carina security rasp status; current RASP state
carina security rasp signals; active signals
carina security rasp threat <id>; threat assessment
carina security rasp graph <id>; attack graph visualization
```
