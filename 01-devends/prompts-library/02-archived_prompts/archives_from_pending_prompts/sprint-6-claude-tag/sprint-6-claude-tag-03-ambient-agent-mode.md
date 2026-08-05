# Sprint 6 -- Prompt 03: Ambient Agent Mode (Proactive Check-in)

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

**Sprint:** 6 -- Channel-Aware Team Agent
**Prompt number:** 03 of 05
**Name:** Proactive check-in, stale thread follow-up, deadline surfacing
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** 02-channel-context-ingestion.md (needs extracted facts)

---

## Read first

1. Master index: `sprint-6-claude-tag-00-master.md`
2. `02-backends/core.carinaai.uk/src/agents/ambient/fact-extractor.ts` -- from prompt 02
3. `02-backends/core.carinaai.uk/src/agents/ambient/signal-detector.ts` -- from prompt 02
4. `02-backends/core.carinaai.uk/src/agents/check-in.ts` -- existing check-in system
5. `02-backends/core.carinaai.uk/src/agents/heartbeat-state.ts` -- heartbeat pattern

---

## Context

Claude Tag's ambient mode: "If ambient behaviour is enabled, Claude will
proactively keep you updated about whatever it thinks you might need to
know. It'll flag relevant information from across the channels it's in and
the tools it's connected to, and follow up on threads or tasks that have
gone quiet without being resolved."

This is the hardest feature to get right. Too aggressive = annoying spam.
Too passive = useless. The sweet spot: occasional, high-signal, genuinely
useful interjections that feel like a thoughtful teammate, not a nag bot.

---

## Goal

### Step 1: Ambient Check Engine

Create `02-backends/core.carinaai.uk/src/agents/ambient/check-engine.ts`:

```typescript
/**
 * AmbientCheckEngine runs periodically (default: every 2 hours).
 * It reviews channel context facts and decides if anything needs surfacing.
 */

interface AmbientCheck {
  type: 'stale_thread' | 'approaching_deadline' | 'status_change' |
        'blocker_unresolved' | 'knowledge_gap' | 'cross_channel_signal';
  priority: 'high' | 'medium' | 'low';
  channelId: string;
  channelName: string;
  message: string; // What to post in the channel
  sourceFactIds: string[]; // Which facts triggered this check
  suggestedAction?: string; // What the user should do
}

export class AmbientCheckEngine {
  private lastCheckTime: Map<string, number> = new Map();
  private checkIntervalMs: number;

  constructor(checkIntervalMs = 2 * 60 * 60 * 1000) { // 2 hours default
    this.checkIntervalMs = checkIntervalMs;
  }

  /**
   * Run ambient checks for all channels with ambient mode enabled.
   * Returns checks that should be surfaced to channels.
   */
  async runAmbientChecks(): Promise<AmbientCheck[]> {
    const checks: AmbientCheck[] = [];
    const now = Date.now();

    const channels = await this.getAmbientChannels();

    for (const channel of channels) {
      // Rate limit: don't check the same channel too often
      const lastCheck = this.lastCheckTime.get(channel.id) || 0;
      if (now - lastCheck < this.checkIntervalMs) continue;
      this.lastCheckTime.set(channel.id, now);

      // Run all check types
      checks.push(
        ...(await this.checkStaleThreads(channel)),
        ...(await this.checkApproachingDeadlines(channel)),
        ...(await this.checkUnresolvedBlockers(channel)),
        ...(await this.checkKnowledgeGaps(channel)),
        ...(await this.checkCrossChannelSignals(channel)),
      );
    }

    // Deduplicate and sort by priority
    return this.prioritise(checks);
  }

  /** Find threads that went quiet without resolution */
  private async checkStaleThreads(channel: AmbientChannel): Promise<AmbientCheck[]> {
    const facts = await this.memoryStore.query({
      type: 'channel_context',
      scope: `channel:${channel.id}`,
      factType: 'status_update',
      orderBy: 'extracted_at',
      order: 'ASC',
    });

    const checks: AmbientCheck[] = [];
    const now = Date.now();
    const STALE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

    for (const fact of facts) {
      const extractedAt = new Date(fact.metadata.extractedAt).getTime();
      if (now - extractedAt > STALE_THRESHOLD_MS) {
        // Thread went quiet -- surface it
        checks.push({
          type: 'stale_thread',
          priority: 'low',
          channelId: channel.id,
          channelName: channel.name,
          message: `I noticed this hasn't had an update in a few days: "${fact.summary}" Is this still active or can it be closed?`,
          sourceFactIds: [fact.id],
          suggestedAction: 'Check in with the owner or mark resolved.',
        });
      }
    }

    return checks;
  }

  /** Find deadlines approaching within 48 hours */
  private async checkApproachingDeadlines(channel: AmbientChannel): Promise<AmbientCheck[]> {
    const facts = await this.memoryStore.query({
      type: 'channel_context',
      scope: `channel:${channel.id}`,
      factType: 'deadline',
    });

    const checks: AmbientCheck[] = [];
    const now = Date.now();
    const WARNING_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 48 hours

    for (const fact of facts) {
      const deadlineDate = fact.metadata?.entities?.dates?.[0];
      if (!deadlineDate) continue;

      const deadline = new Date(deadlineDate).getTime();
      const timeLeft = deadline - now;

      if (timeLeft > 0 && timeLeft < WARNING_WINDOW_MS) {
        const hoursLeft = Math.round(timeLeft / (60 * 60 * 1000));
        checks.push({
          type: 'approaching_deadline',
          priority: timeLeft < 24 * 60 * 60 * 1000 ? 'high' : 'medium',
          channelId: channel.id,
          channelName: channel.name,
          message: `Heads up: "${fact.summary}" is due in about ${hoursLeft} hours.`,
          sourceFactIds: [fact.id],
          suggestedAction: 'Check progress with the owner.',
        });
      }
    }

    return checks;
  }

  /** Find blockers that were reported but never resolved */
  private async checkUnresolvedBlockers(channel: AmbientChannel): Promise<AmbientCheck[]> {
    const facts = await this.memoryStore.query({
      type: 'channel_context',
      scope: `channel:${channel.id}`,
      factType: 'blocker',
      orderBy: 'extracted_at',
    });

    const checks: AmbientCheck[] = [];
    const BLOCKER_STALE_MS = 24 * 60 * 60 * 1000; // 1 day

    for (const fact of facts) {
      const extractedAt = new Date(fact.metadata.extractedAt).getTime();
      if (Date.now() - extractedAt > BLOCKER_STALE_MS) {
        checks.push({
          type: 'blocker_unresolved',
          priority: 'high',
          channelId: channel.id,
          channelName: channel.name,
          message: `This blocker was flagged but I haven't seen a resolution: "${fact.summary}" Is this still blocked?`,
          sourceFactIds: [fact.id],
          suggestedAction: 'Escalate or update status.',
        });
      }
    }

    return checks;
  }

  /** Find questions that went unanswered */
  private async checkKnowledgeGaps(channel: AmbientChannel): Promise<AmbientCheck[]> {
    const facts = await this.memoryStore.query({
      type: 'channel_context',
      scope: `channel:${channel.id}`,
      factType: 'knowledge_gap',
      orderBy: 'extracted_at',
    });

    const checks: AmbientCheck[] = [];
    const GAP_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 hours

    for (const fact of facts) {
      const extractedAt = new Date(fact.metadata.extractedAt).getTime();
      if (Date.now() - extractedAt > GAP_THRESHOLD_MS) {
        checks.push({
          type: 'knowledge_gap',
          priority: 'low',
          channelId: channel.id,
          channelName: channel.name,
          message: `This question from earlier still seems unanswered: "${fact.summary}" Can anyone help?`,
          sourceFactIds: [fact.id],
        });
      }
    }

    return checks;
  }

  /** Find signals in one channel relevant to another */
  private async checkCrossChannelSignals(channel: AmbientChannel): Promise<AmbientCheck[]> {
    // Check if other channels have facts mentioning projects also tracked
    // in this channel. Surface relevant cross-channel context.
    const channelProjects = await this.getChannelProjects(channel.id);
    if (channelProjects.length === 0) return [];

    const checks: AmbientCheck[] = [];

    // Search all other channels for mentions of the same projects
    for (const project of channelProjects) {
      const crossFacts = await this.memoryStore.query({
        type: 'channel_context',
        scope_not: `channel:${channel.id}`,
        search: project,
        limit: 3,
      });

      if (crossFacts.length > 0) {
        const sourceChannels = [...new Set(crossFacts.map(f => f.metadata.channelName))];
        checks.push({
          type: 'cross_channel_signal',
          priority: 'medium',
          channelId: channel.id,
          channelName: channel.name,
          message: `I noticed updates about "${project}" in ${sourceChannels.join(', ')}. Might be relevant here.`,
          sourceFactIds: crossFacts.map(f => f.id),
          suggestedAction: 'Review the cross-channel updates.',
        });
      }
    }

    return checks;
  }

  /** Sort by priority: high first, then medium, then low. Max 3 per channel. */
  private prioritise(checks: AmbientCheck[]): AmbientCheck[] {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sorted = checks.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    // Limit to 3 per channel per check cycle (avoid spam)
    const perChannel = new Map<string, AmbientCheck[]>();
    for (const check of sorted) {
      const existing = perChannel.get(check.channelId) || [];
      if (existing.length < 3) {
        existing.push(check);
        perChannel.set(check.channelId, existing);
      }
    }

    return [...perChannel.values()].flat();
  }
}
```

### Step 2: Ambient Scheduler

```typescript
// In agents/ambient/ambient-scheduler.ts

export class AmbientScheduler {
  private engine: AmbientCheckEngine;
  private slackClient: SlackClient;

  async start(): Promise<void> {
    // Run ambient checks every 2 hours (configurable)
    const intervalMs = parseInt(
      process.env.CARINA_AMBIENT_CHECK_INTERVAL_MS || '7200000'
    );

    setInterval(async () => {
      try {
        const checks = await this.engine.runAmbientChecks();

        for (const check of checks) {
          await this.deliverCheck(check);
          // Log to Scout audit
          await this.auditAmbientAction(check);
        }
      } catch (err) {
        console.error('[ambient] Check cycle failed:', err);
      }
    }, intervalMs);
  }

  private async deliverCheck(check: AmbientCheck): Promise<void> {
    // Post to the channel as a threaded message
    // Use a specific format so users know it's ambient, not a direct response
    const prefix = check.type === 'approaching_deadline' ? 'Deadline reminder'
      : check.type === 'blocker_unresolved' ? 'Blocker check'
      : check.type === 'stale_thread' ? 'Following up'
      : 'Heads up';

    await this.slackClient.chat.postMessage({
      channel: check.channelId,
      text: `[${prefix}] ${check.message}`,
      // Include context: what facts triggered this
      blocks: this.buildAmbientBlocks(check),
    });
  }
}
```

### Step 3: User Control

```typescript
// Slash commands users can use to control ambient behaviour:

// /ambient on         -- Enable ambient mode for this channel
// /ambient off        -- Disable ambient mode for this channel
// /ambient status     -- Show ambient config for this channel
// /ambient quiet 4h   -- Snooze ambient checks for 4 hours
// /ambient frequency  -- Show/set check frequency
// /ambient dismiss <id> -- Dismiss a specific ambient check

// Carina respects these immediately.
```

---

## Testing

```typescript
// tests/ambient/check-engine.test.ts
describe('AmbientCheckEngine', () => {
  it('finds stale threads with no recent updates');
  it('surfaces approaching deadlines within 48 hours');
  it('flags unresolved blockers');
  it('finds unanswered questions');
  it('detects cross-channel project mentions');
  it('limits to 3 checks per channel per cycle');
  it('respects priority ordering');
});

// tests/ambient/ambient-scheduler.test.ts
describe('AmbientScheduler', () => {
  it('runs checks at configured interval');
  it('delivers checks to correct Slack channel');
  it('logs ambient actions to Scout audit');
  it('respects /ambient off command');
  it('respects /ambient quiet command');
});
```

---

## Existing Carina code to integrate with

- `02-backends/core.carinaai.uk/src/agents/ambient/check-engine.ts` -- new
- `02-backends/core.carinaai.uk/src/agents/ambient/ambient-scheduler.ts` -- new
- `02-backends/core.carinaai.uk/src/agents/check-in.ts` -- pattern reference
- `02-backends/core.carinaai.uk/src/gateway/channels/adapters/slack.ts` -- deliver checks
- `02-backends/core.carinaai.uk/src/audit/` -- Scout audit logging
