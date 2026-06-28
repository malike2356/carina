# Sprint 6 -- Prompt 02: Channel Context Ingestion Pipeline

**Sprint:** 6 -- Channel-Aware Team Agent
**Prompt number:** 02 of 05
**Name:** Pipeline that converts raw channel messages into durable memory facts
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** 01-passive-channel-reading.md (needs message ingestion)

---

## Read first

1. Master index: `sprint-6-claude-tag-00-master.md`
2. `02-backends/core.carinaai.uk/src/memory/` -- memory backends
3. `02-backends/core.carinaai.uk/src/memory/rem/rem-promotion.ts` -- REM promotion (pattern to follow)
4. `02-backends/core.carinaai.uk/src/memory/backends/types.ts` -- memory entry types

---

## Context

Passive channel reading (prompt 01) produces raw message streams. This
prompt builds the pipeline that converts those raw messages into durable
memory facts. The challenge: channels are noisy. Most messages are "lol"
and "thanks" and "here's the link." The pipeline must extract signal from
noise and know what to keep vs discard.

Claude Tag solves this by running the full LLM over channel context. Carina
can do the same, but more efficiently by using REM's promotion pattern:
batch messages, run lightweight extraction, only engage LLM for high-signal
batches.

---

## Goal

### Step 1: Signal Extraction Heuristics

Create `02-backends/core.carinaai.uk/src/agents/ambient/signal-detector.ts`:

```typescript
/**
 * Heuristics-based signal detection. Runs BEFORE LLM to filter noise.
 * Only high-signal batches get LLM extraction.
 */

interface SignalScore {
  batchId: string;
  channelId: string;
  score: number; // 0-100, higher = more likely to contain durable info
  triggers: string[]; // Which heuristics fired
  messages: ChannelMessage[];
}

const SIGNAL_PATTERNS = [
  // Decision indicators
  { pattern: /let'?s (do|go with|try|start|build|ship|launch)/i, weight: 20, label: 'decision' },
  { pattern: /(approved|decided|agreed|confirmed|signed off)/i, weight: 15, label: 'decision' },
  { pattern: /we'?re going to|we will|the plan is/i, weight: 10, label: 'decision' },

  // Deadline indicators
  { pattern: /(deadline|due|by (monday|tuesday|wednesday|thursday|friday|next week|eow|eom))/i, weight: 25, label: 'deadline' },
  { pattern: /(need|must|have to) (this|it|that) (by|before|this week)/i, weight: 20, label: 'deadline' },

  // People/assignment indicators
  { pattern: /@\w+ (is|will be|will) (working on|handling|taking|leading|responsible)/i, weight: 15, label: 'assignment' },
  { pattern: /(assign(ed)?|owner|responsible|point person) (is|:) @?\w+/i, weight: 15, label: 'assignment' },

  // Status updates
  { pattern: /(shipped|deployed|launched|released|went live|in production)/i, weight: 15, label: 'status' },
  { pattern: /(blocked|stuck|waiting on|dependency|depends on)/i, weight: 20, label: 'blocker' },

  // Questions that indicate gaps
  { pattern: /does anyone know|who knows|where (is|are)|what'?s the status/i, weight: 10, label: 'knowledge_gap' },

  // Numeric/data indicators
  { pattern: /\$\d+[km]?|£\d+[km]?|€\d+[km]?|\d+% (increase|decrease|growth|drop)/i, weight: 15, label: 'metric' },
  { pattern: /(revenue|mrr|arr|churn|conversion|traffic|dau|mau) (is|was|at|up|down)/i, weight: 15, label: 'metric' },

  // Project/initiative mentions
  { pattern: /(project|initiative|feature|sprint|release|milestone) \w+/i, weight: 10, label: 'project' },
];

export function scoreChannelBatch(
  channelId: string,
  messages: ChannelMessage[],
): SignalScore {
  let totalScore = 0;
  const triggers: string[] = [];

  const combinedText = messages.map(m => m.text).join(' ');

  for (const { pattern, weight, label } of SIGNAL_PATTERNS) {
    if (pattern.test(combinedText)) {
      totalScore += weight;
      if (!triggers.includes(label)) triggers.push(label);
    }
  }

  // Bonus for messages from multiple people (conversation, not monologue)
  const uniqueUsers = new Set(messages.map(m => m.userId)).size;
  if (uniqueUsers >= 3) totalScore += 10;

  // Bonus for thread replies (deeper discussion)
  const threadCount = messages.filter(m => m.threadTs).length;
  if (threadCount >= 3) totalScore += 10;

  // Penalty for very short messages (likely noise)
  const avgLength = messages.reduce((sum, m) => sum + m.text.length, 0) / messages.length;
  if (avgLength < 30) totalScore -= 10;

  // Bonus for pinned messages (someone thought this was important)
  if (messages.some(m => m.isPinned)) totalScore += 25;

  // Bonus for messages with files (documents, screenshots)
  if (messages.some(m => m.hasFiles)) totalScore += 15;

  return {
    batchId: `batch_${channelId}_${Date.now()}`,
    channelId,
    score: Math.max(0, Math.min(100, totalScore)),
    triggers,
    messages,
  };
}
```

### Step 2: LLM Extraction for High-Signal Batches

Create `02-backends/core.carinaai.uk/src/agents/ambient/fact-extractor.ts`:

```typescript
/**
 * Extract durable facts from a channel message batch using an LLM.
 * Only called for batches scoring above AMBIENT_SIGNAL_THRESHOLD (default 40).
 */

interface ExtractedFact {
  type: 'decision' | 'deadline' | 'person_working_on' | 'status_update' |
        'blocker' | 'metric' | 'project_reference' | 'contact' | 'link';
  summary: string; // One-sentence summary of the fact
  detail: string; // Full context (2-3 sentences)
  confidence: number; // 0-1, how certain the extraction is
  sourceMessages: string[]; // Permalinks to source messages
  entities: {
    people?: string[]; // People mentioned
    projects?: string[]; // Projects mentioned
    dates?: string[]; // Dates/deadlines mentioned
    metrics?: { name: string; value: string }[];
  };
  // When this fact should be considered stale
  staleAfter?: '24h' | '7d' | '30d' | 'manual';
}

const EXTRACTION_PROMPT = `You are extracting durable facts from channel messages.
Given the messages below, extract any facts that someone working with this team
would need to know. Focus on:

- Decisions made (what was decided, by whom)
- Deadlines and dates (what is due when)
- Who is working on what
- Status changes (shipped, blocked, started)
- Key metrics or numbers mentioned
- Project or initiative references
- People and their roles
- Important links or documents

Skip: small talk, greetings, jokes, links without context, one-word replies.

For each fact, provide:
- type: one of decision, deadline, person_working_on, status_update, blocker, metric, project_reference, contact, link
- summary: one sentence
- detail: 2-3 sentences with context
- confidence: 0-1
- entities: people, projects, dates, metrics mentioned

CHANNEL MESSAGES:
{messages}

Return JSON array of facts. Empty array if nothing durable found.`;

export async function extractFacts(
  channelId: string,
  channelName: string,
  messages: ChannelMessage[],
): Promise<ExtractedFact[]> {
  // Format messages for the LLM
  const formattedMessages = messages.map(m =>
    `[${m.userName}] ${m.text}${m.isPinned ? ' [PINNED]' : ''}`
  ).join('\n');

  const prompt = EXTRACTION_PROMPT.replace('{messages}', formattedMessages);

  // Use a fast/cheap model for extraction (not the primary reasoning model)
  const response = await callLLM({
    model: process.env.CARINA_AMBIENT_EXTRACTION_MODEL || 'openai/gpt-5.4-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    maxTokens: 2000,
  });

  try {
    const facts: ExtractedFact[] = JSON.parse(response.content);
    // Validate and add source permalinks
    return facts.map(f => ({
      ...f,
      sourceMessages: messages.slice(0, 5).map(m => m.permalink),
      staleAfter: f.type === 'deadline' ? 'manual' :
                  f.type === 'metric' ? '30d' :
                  f.type === 'status_update' ? '7d' : '24h',
    }));
  } catch {
    return []; // Parse failure, skip this batch
  }
}
```

### Step 3: Deduplication

```typescript
// In fact-extractor.ts

/**
 * Compare a new fact against existing channel facts to avoid duplicates.
 * Uses simple Jaccard similarity on word sets.
 */
function isDuplicateFact(newFact: ExtractedFact, existingFacts: ExtractedFact[]): boolean {
  const newWords = new Set(newFact.summary.toLowerCase().split(/\s+/));

  for (const existing of existingFacts) {
    const existingWords = new Set(existing.summary.toLowerCase().split(/\s+/));
    const intersection = new Set([...newWords].filter(w => existingWords.has(w)));
    const union = new Set([...newWords, ...existingWords]);
    const similarity = intersection.size / union.size;

    if (similarity > 0.7 && existing.confidence > 0.5) {
      // Same fact already extracted. Update the existing one's timestamp.
      return true;
    }
  }

  return false;
}
```

### Step 4: Wiring into Memory

```typescript
// In agents/ambient/fact-extractor.ts

async function persistFacts(
  channelId: string,
  channelName: string,
  facts: ExtractedFact[],
  memoryStore: MemoryBackend,
): Promise<void> {
  const scope = `channel:${channelId}`;

  for (const fact of facts) {
    // Skip low-confidence extractions
    if (fact.confidence < 0.5) continue;

    const entry = {
      type: 'channel_context',
      scope,
      channelName,
      content: fact.detail,
      summary: fact.summary,
      metadata: {
        factType: fact.type,
        confidence: fact.confidence,
        entities: fact.entities,
        sourceMessages: fact.sourceMessages,
        extractedAt: new Date().toISOString(),
        staleAfter: fact.staleAfter,
      },
    };

    await memoryStore.upsert(scope, entry);
  }
}
```

### Step 5: Stale Entry Eviction

```typescript
// In agents/ambient/stale-eviction.ts

/**
 * Periodically clean stale channel facts.
 * Runs every hour via existing TaskScheduler.
 */
export async function evictStaleChannelFacts(memoryStore: MemoryBackend): Promise<number> {
  const now = Date.now();
  const stalenessMap: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    'manual': Infinity, // Never auto-evict
  };

  const allChannelFacts = await memoryStore.query({
    type: 'channel_context',
    orderBy: 'extracted_at',
  });

  let evicted = 0;
  for (const fact of allChannelFacts) {
    const staleAfter = fact.metadata?.staleAfter || '7d';
    const maxAge = stalenessMap[staleAfter] || stalenessMap['7d'];
    const extractedAt = new Date(fact.metadata.extractedAt).getTime();

    if (now - extractedAt > maxAge) {
      await memoryStore.delete(fact.id);
      evicted++;
    }
  }

  return evicted;
}
```

---

## Testing

```typescript
// tests/ambient/signal-detector.test.ts
describe('SignalDetector', () => {
  it('scores decision messages highly');
  it('scores deadline messages highly');
  it('scores small talk low');
  it('adds bonus for pinned messages');
  it('adds penalty for very short messages');
  it('scores multi-user conversations higher');
});

// tests/ambient/fact-extractor.test.ts
describe('FactExtractor', () => {
  it('extracts decisions from message batch');
  it('extracts deadlines with dates');
  it('extracts person assignments');
  it('returns empty array for noise messages');
  it('deduplicates similar facts');
  it('persists facts to memory with channel scope');
});
```

---

## Existing Carina code to integrate with

- `02-backends/core.carinaai.uk/src/agents/ambient/` -- new directory
- `02-backends/core.carinaai.uk/src/memory/backends/` -- existing memory stores
- `02-backends/core.carinaai.uk/src/agents/scheduled-tasks.ts` -- register eviction
- `02-backends/core.carinaai.uk/src/config/schema.ts` -- `CARINA_AMBIENT_SIGNAL_THRESHOLD`
