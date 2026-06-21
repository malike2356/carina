# Gap 09 - Prompt 11: Carina User Intelligence (Dialectic User Profiling)

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement the behavior below in Carina's own voice. No competitor product names, labels, CLI text, UI copy, or config key names may appear verbatim in shipped code. Rename all user-visible elements to Carina equivalents before committing.


**Agent:** Claude Code
**Estimated hours:** 4-5 hrs
**Depends on:** `src/memory/` and `src/profiles/` exist

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## The Problem

Carina stores memories and has operator profiles, but there is no active user modeling - no
system that builds up a structured understanding of WHO the user is: their expertise, preferences,
communication style, goals, and blind spots. This means every conversation starts cold.

The behavioral pattern: after each conversation, a background process reviews the exchange,
extracts structured facts about the user, and stores them in a durable profile. Future
conversations inject this profile into the system prompt so Carina already knows the user
before they type the first word. Carina calls this feature "User Intelligence."

Example: after 10 conversations, Carina knows "this user is a property investor, prefers
bullet-point summaries, is impatient with caveats, has a portfolio in Manchester and Leeds,
always wants yield calculations included." That level of personalization makes responses feel
dramatically sharper.

---

## Read First

```
core.carinaai.uk/src/memory/persistent-memory.ts    (existing memory system)
core.carinaai.uk/src/memory/memory-injection.ts     (where memory is injected into prompts)
core.carinaai.uk/src/profiles/manager.ts            (profile management)
core.carinaai.uk/src/profiles/personality.ts        (personality config)
core.carinaai.uk/src/brain/llm.ts                   (system prompt assembly)
core.carinaai.uk/src/memory/operator-profile.ts     (operator profile)
```

---

## 1. User Model Schema

```typescript
// src/memory/user-model.ts  (new file)

export interface UserFact {
  id: string;
  category: UserFactCategory;
  fact: string;
  confidence: number; // 0.0 - 1.0
  observedAt: Date;
  conversationId: string; // which conversation surfaced this
  confirmedAt?: Date; // set when user explicitly confirms
  contradictedAt?: Date; // set when a later conversation contradicts this
}

export type UserFactCategory =
  | 'expertise'          // domain knowledge level ("expert in UK property law")
  | 'preference'         // communication style ("prefers bullet points over paragraphs")
  | 'goal'               // what they're trying to achieve ("building a HMO portfolio")
  | 'context'            // situational facts ("based in Leeds, portfolio of 12 properties")
  | 'behavior'           // observed patterns ("always asks for yield calculations")
  | 'blind_spot'         // things they consistently miss or get wrong
  | 'constraint'; // limits ("budget under £200k", "no Scotland properties")

export interface UserModel {
  profileId: string;
  facts: UserFact[];
  lastUpdatedAt: Date;
  conversationCount: number;
  /** Compiled summary for injection into system prompt */
  compiledSummary?: string;
  compiledAt?: Date;
}
```

---

## 2. User Model Store

```typescript
// src/memory/user-model-store.ts  (new file)

import { pool } from './db.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS user_model_facts (
  id              TEXT PRIMARY KEY,
  profile_id      TEXT NOT NULL,
  category        TEXT NOT NULL,
  fact            TEXT NOT NULL,
  confidence      REAL NOT NULL DEFAULT 0.8,
  observed_at     TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  confirmed_at    TEXT,
  contradicted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_model_profile ON user_model_facts(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_model_category ON user_model_facts(profile_id, category);
`;

export async function initUserModelStore(): Promise<void> {
  await pool.query(SCHEMA);
}

export async function saveFact(fact: UserFact & { profileId: string }): Promise<void> {
  await pool.query(
    `INSERT INTO user_model_facts
       (id, profile_id, category, fact, confidence, observed_at, conversation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       confidence = $5,
       confirmed_at = user_model_facts.confirmed_at`,
    [fact.id, fact.profileId, fact.category, fact.fact, fact.confidence,
     fact.observedAt.toISOString(), fact.conversationId]
  );
}

export async function getFacts(
  profileId: string,
  options: { category?: UserFactCategory; minConfidence?: number } = {}
): Promise<UserFact[]> {
  const rows = await pool.query(
    `SELECT * FROM user_model_facts
     WHERE profile_id = $1
       AND ($2::text IS NULL OR category = $2)
       AND confidence >= $3
       AND contradicted_at IS NULL
     ORDER BY confidence DESC, observed_at DESC`,
    [profileId, options.category ?? null, options.minConfidence ?? 0.5]
  );
  return rows.rows.map(rowToFact);
}

export async function markContradicted(factId: string): Promise<void> {
  await pool.query(
    `UPDATE user_model_facts SET contradicted_at = $1 WHERE id = $2`,
    [new Date().toISOString(), factId]
  );
}

function rowToFact(row: any): UserFact {
  return {
    id: row.id,
    category: row.category,
    fact: row.fact,
    confidence: row.confidence,
    observedAt: new Date(row.observed_at),
    conversationId: row.conversation_id,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
    contradictedAt: row.contradicted_at ? new Date(row.contradicted_at) : undefined,
  };
}
```

---

## 3. Post-Conversation Analyzer

This runs after each conversation ends (background, non-blocking):

```typescript
// src/memory/user-model-analyzer.ts  (new file)

import { callAuxiliaryModel } from '../brain/auxiliary-client.js'; // from gap-09-02
import { saveFact, getFacts, markContradicted } from './user-model-store.js';
import crypto from 'crypto';

const ANALYSIS_PROMPT = (transcript: string) => `
You are analyzing a conversation to extract facts about the user for personalization.

Conversation:
${transcript}

Extract factual observations about the user. Focus on:
- Expertise level and domain knowledge
- Communication preferences (how they like responses formatted)
- Goals and what they're trying to achieve
- Contextual facts (location, portfolio size, budget)
- Observed behavioral patterns
- Things they seem to misunderstand or miss

Return a JSON array of facts. Each fact:
{
  "category": "expertise|preference|goal|context|behavior|blind_spot|constraint",
  "fact": "concise factual statement about the user",
  "confidence": 0.0-1.0
}

Return only facts you are confident about from THIS conversation.
Return an empty array if no new facts are apparent.
Return JSON only, no other text.
`;

export async function analyzeConversation(
  profileId: string,
  conversationId: string,
  messages: Array<{ role: string; content: string }>
): Promise<void> {
  // Skip very short conversations
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length < 2) return;

  const transcript = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')
    .slice(0, 8000); // cap for prompt size

  try {
    const raw = await callAuxiliaryModel('userModeling', ANALYSIS_PROMPT(transcript));
    const facts: Array<{ category: string; fact: string; confidence: number }> =
      JSON.parse(raw.trim());

    if (!Array.isArray(facts)) return;

    for (const item of facts) {
      if (!item.category || !item.fact) continue;

      await saveFact({
        id: crypto.randomUUID(),
        profileId,
        category: item.category as any,
        fact: item.fact,
        confidence: Math.min(Math.max(item.confidence ?? 0.7, 0), 1),
        observedAt: new Date(),
        conversationId,
      });
    }
  } catch (err) {
    console.warn('[user-model] Analysis failed (non-fatal):', err);
  }
}
```

---

## 4. Compile User Model Summary

Periodically compile all facts into a concise system prompt block:

```typescript
// src/memory/user-model-compiler.ts  (new file)

import { getFacts } from './user-model-store.js';
import { callAuxiliaryModel } from '../brain/auxiliary-client.js';

const COMPILE_PROMPT = (facts: string) => `
Compile the following observations about a user into a concise 5-10 sentence profile
that can be injected into an AI assistant's system prompt.

Write in second person addressing the AI: "The user is...", "They prefer...", etc.
Focus on information that would make responses more relevant and better-tuned.

User observations:
${facts}

Write the profile:
`;

export async function compileUserModel(profileId: string): Promise<string> {
  const facts = await getFacts(profileId, { minConfidence: 0.6 });
  if (facts.length === 0) return '';

  const factLines = facts.map(f => `[${f.category}] ${f.fact}`).join('\n');

  try {
    return await callAuxiliaryModel('userModeling', COMPILE_PROMPT(factLines));
  } catch {
    // Fallback: bullet list
    return `User profile based on past conversations:\n` +
      facts.slice(0, 10).map(f => `- ${f.fact}`).join('\n');
  }
}
```

---

## 5. Inject Into System Prompt

```typescript
// src/brain/llm.ts  (in buildSystemPrompt, add after memory injection)

import { compileUserModel } from '../memory/user-model-compiler.js';

// After the main system prompt parts are assembled:
const userModelSummary = await compileUserModel(profileId);
if (userModelSummary) {
  parts.push(`\n## User Profile (learned from past conversations)\n${userModelSummary}`);
}
```

---

## 6. Wire Analyzer Into Session End

```typescript
// src/gateway/session-control.ts  (add to session end handler)

import { analyzeConversation } from '../memory/user-model-analyzer.js';

async function onSessionEnd(sessionId: string, messages: Message[], profileId: string) {
  // Run analysis in background (don't await - non-blocking)
  analyzeConversation(profileId, sessionId, messages)
    .catch(err => console.warn('[user-model] Background analysis error:', err));

  // ... rest of session end handling
}
```

---

## 7. CLI Commands

```typescript
registry.register({
  name: 'profile show-model',
  description: 'Show learned facts about you from past conversations',
  options: [{ name: '--category', description: 'Filter by category' }],
  handler: async ({ category }) => {
    const profileId = getCurrentProfileId();
    const facts = await getFacts(profileId, { category });
    if (facts.length === 0) return 'No user model facts yet. Have more conversations!';
    return facts
      .map(f => `[${f.category}] (${Math.round(f.confidence * 100)}%) ${f.fact}`)
      .join('\n');
  },
});

registry.register({
  name: 'profile show-summary',
  description: 'Show compiled user model summary (as injected into system prompt)',
  handler: async () => {
    const profileId = getCurrentProfileId();
    const summary = await compileUserModel(profileId);
    return summary || 'No user model yet. Have more conversations!';
  },
});

registry.register({
  name: 'profile clear-model',
  description: 'Clear all learned facts (fresh start)',
  handler: async () => {
    const profileId = getCurrentProfileId();
    await clearUserModel(profileId);
    return 'User model cleared.';
  },
});
```

---

## Files to Create

```
core.carinaai.uk/src/memory/user-model.ts
core.carinaai.uk/src/memory/user-model-store.ts
core.carinaai.uk/src/memory/user-model-analyzer.ts
core.carinaai.uk/src/memory/user-model-compiler.ts
```

## Files to Modify

```
core.carinaai.uk/src/brain/llm.ts                   inject compiled user model into system prompt
core.carinaai.uk/src/gateway/session-control.ts     trigger analyzeConversation on session end
core.carinaai.uk/src/memory/migrations.ts           add user_model_facts table migration
core.carinaai.uk/src/cli/commands/                  add profile show-model + show-summary + clear-model
```

---

## Done When

- [ ] After a 3+ turn conversation ends, `analyzeConversation` extracts facts and saves them
- [ ] `carina profile show-model` shows extracted facts with confidence and category
- [ ] `carina profile show-summary` shows the compiled 5-10 sentence profile
- [ ] The compiled profile is injected into the system prompt on subsequent conversations
- [ ] Analysis is non-blocking (runs in background, does not delay session end)
- [ ] Facts below 0.5 confidence are not injected into the system prompt
- [ ] `carina profile clear-model` removes all facts for the current profile
- [ ] User model is profile-scoped (alice and bob have independent models)
- [ ] Unit test: ANALYSIS_PROMPT generates valid JSON from a sample conversation
- [ ] Unit test: getFacts returns only non-contradicted facts above minimum confidence
- [ ] Unit test: compileUserModel returns empty string when no facts exist