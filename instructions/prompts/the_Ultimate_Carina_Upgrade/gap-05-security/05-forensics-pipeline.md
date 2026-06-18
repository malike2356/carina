# Security 05; Forensics Pipeline (Enterprise Incident Response)

**Source:** NEW; No agent has this. Carina will be the first.
**Status:** Missing in all agents. Carina's telemetry + security files provide the foundation.
**Effort:** 4 weeks

---

## SPECIFICATION

### What This Is

When a security incident occurs, you need to know: WHAT happened, WHEN, WHO did it, HOW they did it, WHAT was affected, and HOW to prevent it next time. Forensics answers all of these with immutable evidence, chain of custody, and automated timeline reconstruction.

No AI agent platform has this. Carina will be the first.

### Forensics Architecture

```
Incident Detected (by RASP, prompt guard, tool sequence guard, or manual)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    FORENSICS PIPELINE                        │
│                                                             │
│  1. EVIDENCE CAPTURE                                        │
│     ├── Snapshot: agent state, session, memory, config      │
│     ├── Freeze: prevent evidence tampering                  │
│     ├── Hash: SHA-256 every artifact                        │
│     └── Chain: record who accessed what, when               │
│                                                             │
│  2. TIMELINE RECONSTRUCTION                                 │
│     ├── Ingest: all telemetry, logs, tool calls             │
│     ├── Correlate: link events across systems               │
│     ├── Visualize: interactive timeline                     │
│     └── Annotate: flag suspicious patterns                  │
│                                                             │
│  3. ROOT CAUSE ANALYSIS                                     │
│     ├── Attack path: how did the attacker get in?           │
│     ├── Impact: what data/systems were affected?            │
│     ├── Duration: how long was the attacker active?         │
│     └── Recommendations: how to prevent recurrence          │
│                                                             │
│  4. EVIDENCE PRESERVATION                                   │
│     ├── Immutable log: append-only, WORM storage            │
│     ├── Export: CSV, JSON, PDF forensic reports             │
│     ├── Archive: long-term retention with integrity check   │
│     └── Chain of custody: complete access record            │
│                                                             │
│  5. INCIDENT RESPONSE                                       │
│     ├── Playbooks: automated response for known attacks     │
│     ├── Notification: alert security team via channels      │
│     ├── Containment: isolate affected agents/sessions       │
│     └── Recovery: restore from clean state                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION

### 1. Chain of Custody

```typescript
// forensics/chain-of-custody.ts

interface CustodyRecord {
  id: string;
  evidenceId: string;
  action: 'created' | 'accessed' | 'modified' | 'exported' | 'deleted';
  actor: string; // user ID or system
  actorRole: string; // admin, auditor, system
  timestamp: number;
  reason: string; // why was this action taken?
  previousHash: string; // hash chain for tamper detection
  hash: string; // SHA-256 of this record
}

class ChainOfCustody {
  private records: CustodyRecord[] = [];
  
  /**
   * Record a custody action. Each record links to the previous
   * via hash chain, making tampering detectable.
   */
  record(action: Omit<CustodyRecord, 'id' | 'previousHash' | 'hash'>): CustodyRecord {
    const previousHash = this.records.length > 0 
      ? this.records[this.records.length - 1].hash 
      : '0'.repeat(64); // Genesis hash
    
    const record: CustodyRecord = {
      ...action,
      id: crypto.randomUUID(),
      previousHash,
      hash: '',
    };
    
    record.hash = this.computeHash(record);
    this.records.push(record);
    
    // Write to immutable log immediately
    this.appendToImmutableLog(record);
    
    return record;
  }
  
  /**
   * Verify the entire chain is intact. Any tampering breaks the chain.
   */
  verify(): { valid: boolean; brokenAt: number | null } {
    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i];
      const expectedPrevious = i > 0 
        ? this.records[i - 1].hash 
        : '0'.repeat(64);
      
      if (record.previousHash !== expectedPrevious) {
        return { valid: false, brokenAt: i };
      }
      
      const recomputed = this.computeHash(record);
      if (recomputed !== record.hash) {
        return { valid: false, brokenAt: i };
      }
    }
    return { valid: true, brokenAt: null };
  }
  
  private computeHash(record: Omit<CustodyRecord, 'hash'>): string {
    return sha256(JSON.stringify({
      id: record.id,
      evidenceId: record.evidenceId,
      action: record.action,
      actor: record.actor,
      timestamp: record.timestamp,
      previousHash: record.previousHash,
    }));
  }
  
  private async appendToImmutableLog(record: CustodyRecord): Promise<void> {
    // Write to append-only storage (WORM; Write Once Read Many)
    // Options: immutable S3 bucket, blockchain-anchored log, append-only DB table
    await db.insert('forensic_custody_log', {
      ...record,
      written_at: Date.now(),
      storage_backend: 'postgres_immutable',
    });
  }
}
```

### 2. Evidence Capture

```typescript
// forensics/evidence-capture.ts

interface ForensicSnapshot {
  id: string;
  incidentId: string;
  timestamp: number;
  capturedBy: string;
  
  // Agent state at time of incident
  agentState: {
    sessionId: string;
    agentId: string;
    modelId: string;
    providerId: string;
    messages: MessageSnapshot[]; // last 50 messages
    activeTools: string[];
    memoryState: object;
  };
  
  // System state
  systemState: {
    osInfo: object;
    nodeVersion: string;
    carinaVersion: string;
    uptime: number;
    memoryUsage: object;
    diskUsage: object;
  };
  
  // Security state
  securityState: {
    trustScore: number;
    activeThreats: number;
    shieldStatus: string;
    killSwitchStatus: string;
    recentEvents: SecurityEvent[];
  };
  
  // Evidence artifacts (hashed)
  artifacts: {
    sessionLog: { path: string; hash: string; size: number };
    toolCallLog: { path: string; hash: string; size: number };
    promptLog: { path: string; hash: string; size: number };
    networkLog: { path: string; hash: string; size: number };
    memoryDump: { path: string; hash: string; size: number };
  };
}

class EvidenceCapture {
  private custody: ChainOfCustody;
  
  /**
   * Capture a complete forensic snapshot of the current state.
   * All artifacts are hashed and added to chain of custody.
   */
  async captureSnapshot(incidentId: string): Promise<ForensicSnapshot> {
    const snapshotId = crypto.randomUUID();
    
    // Freeze state; prevent further mutations during capture
    await this.freezeState(incidentId);
    
    const snapshot: ForensicSnapshot = {
      id: snapshotId,
      incidentId,
      timestamp: Date.now(),
      capturedBy: 'forensics-engine',
      
      agentState: await this.captureAgentState(),
      systemState: await this.captureSystemState(),
      securityState: await this.captureSecurityState(),
      artifacts: await this.captureArtifacts(snapshotId),
    };
    
    // Record in chain of custody
    this.custody.record({
      evidenceId: snapshotId,
      action: 'created',
      actor: 'forensics-engine',
      actorRole: 'system',
      timestamp: Date.now(),
      reason: `Incident ${incidentId}: forensic snapshot captured`,
    });
    
    // Store snapshot (immutable)
    await this.storeSnapshot(snapshot);
    
    // Unfreeze
    await this.unfreezeState(incidentId);
    
    return snapshot;
  }
  
  private async captureAgentState() {
    return {
      sessionId: getCurrentSessionId(),
      agentId: getCurrentAgentId(),
      modelId: getCurrentModelId(),
      providerId: getCurrentProviderId(),
      messages: await getRecentMessages(50),
      activeTools: getActiveTools(),
      memoryState: await getMemorySnapshot(),
    };
  }
  
  private async captureArtifacts(snapshotId: string) {
    const artifacts: Record<string, { path: string; hash: string; size: number }> = {};
    
    const files = ['session.log', 'tool-calls.log', 'prompts.log', 'network.log'];
    for (const file of files) {
      const path = `/data/carina/forensics/${snapshotId}/${file}`;
      await copyFile(`/data/carina/logs/${file}`, path);
      const hash = await sha256File(path);
      const size = (await stat(path)).size;
      artifacts[file] = { path, hash, size };
    }
    
    return artifacts;
  }
}
```

### 3. Timeline Reconstruction

```typescript
// forensics/timeline-reconstructor.ts

interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'user_message' | 'agent_response' | 'tool_call' | 'tool_result' |
        'security_event' | 'system_event' | 'network_event' | 'error';
  severity: 'info' | 'warning' | 'critical';
  source: string;
  description: string;
  details: Record<string, unknown>;
  relatedEvents: string[]; // IDs of related events
}

class TimelineReconstructor {
  /**
   * Reconstruct a complete timeline from all available data sources.
   */
  async reconstruct(
    incidentId: string,
    startTime: number,
    endTime: number,
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    // Ingest from all sources
    const sources = await Promise.all([
      this.ingestSessionTelemetry(incidentId, startTime, endTime),
      this.ingestToolCallLogs(incidentId, startTime, endTime),
      this.ingestPromptLogs(incidentId, startTime, endTime),
      this.ingestSecurityEvents(incidentId, startTime, endTime),
      this.ingestNetworkLogs(incidentId, startTime, endTime),
      this.ingestSystemLogs(incidentId, startTime, endTime),
      this.ingestAgentBehaviorLog(incidentId, startTime, endTime),
    ]);
    
    // Merge all events
    for (const source of sources) {
      events.push(...source);
    }
    
    // Sort by timestamp
    events.sort((a, b) => a.timestamp - b.timestamp);
    
    // Correlate related events
    this.correlateEvents(events);
    
    // Flag suspicious patterns
    this.flagSuspiciousPatterns(events);
    
    return events;
  }
  
  private correlateEvents(events: TimelineEvent[]): void {
    // Link tool calls to their results
    // Link user messages to agent responses
    // Link security events to the tool calls that triggered them
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (this.areRelated(events[i], events[j])) {
          events[i].relatedEvents.push(events[j].id);
          events[j].relatedEvents.push(events[i].id);
        }
      }
    }
  }
  
  private flagSuspiciousPatterns(events: TimelineEvent[]): void {
    const patterns = [
      this.detectRapidToolCalls(events),
      this.detectPrivilegeEscalation(events),
      this.detectDataExfiltration(events),
      this.detectUnusualHours(events),
      this.detectAnomalousSequences(events),
    ];
    
    for (const pattern of patterns) {
      if (pattern.detected) {
        // Add annotation events to timeline
        events.push({
          id: crypto.randomUUID(),
          timestamp: pattern.timestamp,
          type: 'security_event',
          severity: pattern.severity,
          source: 'pattern-detector',
          description: pattern.description,
          details: pattern.details,
          relatedEvents: pattern.eventIds,
        });
      }
    }
  }
}
```

### 4. Incident Response Playbooks

```typescript
// forensics/incident-response.ts

interface IRPlaybook {
  id: string;
  name: string;
  trigger: {
    eventTypes: string[];
    severity: 'warning' | 'critical';
    autoExecute: boolean;
  };
  steps: IRStep[];
}

interface IRStep {
  order: number;
  action: 'contain' | 'investigate' | 'notify' | 'recover' | 'report';
  description: string;
  automated: boolean;
  handler?: () => Promise<void>;
}

const PLAYBOOKS: IRPlaybook[] = [
  {
    id: 'prompt-injection',
    name: 'Prompt Injection Attack',
    trigger: {
      eventTypes: ['prompt_guard_alert'],
      severity: 'critical',
      autoExecute: true,  // Auto-contain injection attacks
    },
    steps: [
      {
        order: 1,
        action: 'contain',
        description: 'Block the injected prompt from reaching the model',
        automated: true,
        handler: async () => {
          await killSwitch.activateSession(sessionId);
          await shield.blockPrompt(injectedContent);
        },
      },
      {
        order: 2,
        action: 'investigate',
        description: 'Capture forensic snapshot',
        automated: true,
        handler: async () => {
          await forensics.captureSnapshot(incidentId);
        },
      },
      {
        order: 3,
        action: 'notify',
        description: 'Alert security team',
        automated: true,
        handler: async () => {
          await notifySecurityTeam({
            severity: 'critical',
            title: 'Prompt Injection Attack Detected',
            sessionId,
            timestamp: Date.now(),
          });
        },
      },
      {
        order: 4,
        action: 'recover',
        description: 'Review and unblock if false positive',
        automated: false,  // Human review required
      },
      {
        order: 5,
        action: 'report',
        description: 'Generate incident report',
        automated: true,
        handler: async () => {
          await forensics.generateReport(incidentId);
        },
      },
    ],
  },
  
  {
    id: 'data-exfiltration',
    name: 'Suspected Data Exfiltration',
    trigger: {
      eventTypes: ['egress_filter_alert', 'unusual_tool_sequence'],
      severity: 'critical',
      autoExecute: true,
    },
    steps: [
      {
        order: 1,
        action: 'contain',
        description: 'Block all outbound network traffic for the session',
        automated: true,
      },
      {
        order: 2,
        action: 'investigate',
        description: 'Capture full forensic snapshot and network logs',
        automated: true,
      },
      {
        order: 3,
        action: 'notify',
        description: 'Alert security team with full context',
        automated: true,
      },
      {
        order: 4,
        action: 'recover',
        description: 'Human review of exfiltrated data scope',
        automated: false,
      },
    ],
  },
  
  // ... more playbooks for: credential theft, privilege escalation,
  //     supply chain attack, insider threat, DDoS
];
```

### 5. Forensic Export

```typescript
// forensics/export.ts

async function generateForensicReport(incidentId: string): Promise<Buffer> {
  const snapshot = await evidenceCapture.loadSnapshot(incidentId);
  const timeline = await timelineReconstructor.reconstruct(
    incidentId,
    snapshot.timestamp - 3600000,  // 1 hour before
    snapshot.timestamp + 3600000,  // 1 hour after
  );
  const chainVerification = await chainOfCustody.verify();
  
  // Generate PDF report
  const report = await pdfGenerator.create({
    title: `Forensic Incident Report; ${incidentId}`,
    sections: [
      { title: 'Executive Summary', content: generateSummary(timeline) },
      { title: 'Timeline', content: generateTimelineTable(timeline) },
      { title: 'Attack Path', content: generateAttackPath(timeline) },
      { title: 'Impact Assessment', content: generateImpactAssessment(timeline) },
      { title: 'Evidence', content: generateEvidenceList(snapshot) },
      { title: 'Chain of Custody', content: chainVerification },
      { title: 'Recommendations', content: generateRecommendations(timeline) },
    ],
    metadata: {
      incidentId,
      classification: determineClassification(timeline),
      generatedAt: new Date().toISOString(),
      generatedBy: 'Carina Forensics Engine',
    },
  });
  
  return report;
}

// Export formats
// carina forensics export <incidentId> --format pdf
// carina forensics export <incidentId> --format json
// carina forensics export <incidentId> --format csv
// carina forensics export <incidentId> --format all
```

### 6. CLI Commands

```
carina forensics snapshot <incidentId>; capture forensic snapshot
carina forensics timeline <incidentId>; reconstruct timeline
carina forensics report <incidentId>; generate forensic report
carina forensics export <incidentId>; export evidence package
carina forensics verify <incidentId>; verify chain of custody
carina forensics list; list all incidents
carina forensics playbook <name>; view IR playbook
carina forensics run <playbook> <incident>; execute playbook
```

### 7. Database Schema

```sql
-- forensics/forensic-schema.sql

CREATE TABLE forensic_incidents (
  id UUID PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  severity VARCHAR(20) NOT NULL,  -- critical, high, medium, low
  status VARCHAR(20) NOT NULL,     -- active, contained, investigating, resolved
  detected_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP,
  session_id UUID,
  agent_id VARCHAR(255),
  classification VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE forensic_snapshots (
  id UUID PRIMARY KEY,
  incident_id UUID REFERENCES forensic_incidents(id),
  captured_at TIMESTAMP NOT NULL,
  captured_by VARCHAR(255) NOT NULL,
  agent_state JSONB NOT NULL,
  system_state JSONB NOT NULL,
  security_state JSONB NOT NULL,
  artifact_hashes JSONB NOT NULL,
  hash VARCHAR(128) NOT NULL  -- SHA-256 of entire snapshot
);

CREATE TABLE forensic_custody_log (
  id UUID PRIMARY KEY,
  evidence_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  reason TEXT,
  previous_hash VARCHAR(128) NOT NULL,
  hash VARCHAR(128) NOT NULL,
  written_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE forensic_timeline_events (
  id UUID PRIMARY KEY,
  incident_id UUID REFERENCES forensic_incidents(id),
  timestamp TIMESTAMP NOT NULL,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  source VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  details JSONB,
  related_events UUID[],
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE forensic_playbook_executions (
  id UUID PRIMARY KEY,
  incident_id UUID REFERENCES forensic_incidents(id),
  playbook_id VARCHAR(100) NOT NULL,
  playbook_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,  -- running, completed, failed
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  steps_completed INTEGER DEFAULT 0,
  steps_total INTEGER NOT NULL,
  automated_only BOOLEAN DEFAULT TRUE
);

-- Indexes for performance
CREATE INDEX idx_incidents_severity ON forensic_incidents(severity);
CREATE INDEX idx_incidents_status ON forensic_incidents(status);
CREATE INDEX idx_incidents_detected ON forensic_incidents(detected_at);
CREATE INDEX idx_snapshots_incident ON forensic_snapshots(incident_id);
CREATE INDEX idx_custody_evidence ON forensic_custody_log(evidence_id);
CREATE INDEX idx_timeline_incident ON forensic_timeline_events(incident_id);
CREATE INDEX idx_timeline_timestamp ON forensic_timeline_events(timestamp);
```

---

## REFERENCE FILES

```
Existing Carina (integrate with):
  security/trust-state.ts; trust scoring feeds forensics
  security/kill-switch-listener.ts; kill switch triggers forensics
  security/shield-report.ts; shield status in forensics
  security/scout-client.ts; Scout events in forensics
  telemetry/session-telemetry.ts; primary data source
  telemetry/agent-behavior-log.ts; behavior patterns
  telemetry/turn-log.ts; per-turn detail
  ops/security-audit.ts; audit trails
```
