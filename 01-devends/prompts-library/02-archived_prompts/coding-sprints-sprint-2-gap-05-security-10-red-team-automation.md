# Security 10; Red Team Automation

**Source:** NEW (Carina has deception-client.ts as foundation)
**Effort:** 3 weeks

## SPECIFICATION

Scheduled automated red team exercises that attack Carina's own defenses and report findings. Carina attacks itself to find weaknesses before real attackers do.

### Implementation

```typescript
// security/red-team/automation.ts

interface RedTeamExercise {
  id: string;
  name: string;
  attackType: string;
  mitreTactic: string;
  targetSystems: string[];
  schedule: string; // cron expression
  lastRun: number;
  results: RedTeamResult[];
}

interface RedTeamResult {
  exerciseId: string;
  timestamp: number;
  attackVector: string;
  detected: boolean;
  detectionTime: number; // ms to detect
  blocked: boolean;
  blockTime: number; // ms to block
  falsePositives: number;
  gaps: SecurityGap[];
}

interface SecurityGap {
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  system: string;
  recommendation: string;
  autoCreatedRule: boolean; // did Carina auto-create a detection rule?
}

class RedTeamAutomation {
  private exercises: RedTeamExercise[] = [
    {
      id: 'weekly-prompt-injection',
      name: 'Weekly Prompt Injection Battery',
      attackType: 'prompt_injection',
      mitreTactic: 'TA0040',  // Impact
      targetSystems: ['prompt_guard', 'rasp_engine'],
      schedule: '0 2 * * 0',  // Every Sunday at 2am
    },
    {
      id: 'daily-tool-abuse',
      name: 'Daily Tool Abuse Simulation',
      attackType: 'tool_sequence_attack',
      mitreTactic: 'TA0005',  // Defense Evasion
      targetSystems: ['tool_sequence_guard', 'tool_policy', 'rasp_engine'],
      schedule: '0 3 * * *',  // Every day at 3am
    },
    {
      id: 'weekly-data-exfil',
      name: 'Weekly Data Exfiltration Test',
      attackType: 'data_exfiltration',
      mitreTactic: 'TA0010',  // Exfiltration
      targetSystems: ['egress_filter', 'rasp_engine'],
      schedule: '0 4 * * 1',  // Every Monday at 4am
    },
  ];

  async runExercise(exerciseId: string): Promise<RedTeamResult> {
    const exercise = this.exercises.find(e => e.id === exerciseId);
    if (!exercise) throw new Error(`Unknown exercise: ${exerciseId}`);

    const startTime = Date.now();

    // Execute attack
    const attackResult = await this.executeAttack(exercise.attackType);

    // Measure detection
    const detectionResult = await this.measureDetection(attackResult);

    // Measure blocking
    const blockResult = await this.measureBlocking(attackResult);

    // Identify gaps
    const gaps = this.identifyGaps(detectionResult, blockResult);

    // Auto-create detection rules for critical gaps
    for (const gap of gaps.filter(g => g.severity === 'critical')) {
      await this.autoCreateDetectionRule(gap);
    }

    return {
      exerciseId,
      timestamp: Date.now(),
      attackVector: attackResult.vector,
      detected: detectionResult.detected,
      detectionTime: detectionResult.timeMs,
      blocked: blockResult.blocked,
      blockTime: blockResult.timeMs,
      falsePositives: detectionResult.falsePositives,
      gaps,
    };
  }

  private async autoCreateDetectionRule(gap: SecurityGap): Promise<void> {
    // Automatically create a detection rule based on the gap
    await db.insert('detection_rules', {
      id: crypto.randomUUID(),
      name: `Auto-generated: ${gap.description}`,
      system: gap.system,
      pattern: this.generatePattern(gap),
      severity: gap.severity,
      created_by: 'red-team-automation',
      created_at: Date.now(),
      status: 'active',
    });
    
    gap.autoCreatedRule = true;
  }
}
```

### CLI Commands

```
carina security red-team run <exercise>; run specific exercise
carina security red-team run --all; run all exercises
carina security red-team schedule; view schedule
carina security red-team report; latest findings
carina security red-team gaps; unresolved security gaps
```

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## REFERENCE

Carina foundation: `security/deception-client.ts`; existing adversarial testing client
