# Prompt 13 - Results-First Response Delivery

**Status: COMPLETED 2026-06-23** (`conversation-discipline.ts` + format rules in `00-system-prompt.md`)

**Agent:** Claude Code
**Depends on:** nothing (standalone behaviour fix)
**Builds in:** `backends/servers/core.carinaai.uk/src/agents/conversation-discipline.ts`
**Also updates:** `internal/prompts/pending_prompts/sprint-3/support-agent/00-system-prompt.md`
**Done when:** Carina delivers answers, results, and completed actions first without narrating her own process beforehand. Applies on all surfaces including voice audio.

---

## Problem

Carina currently pre-announces what she is about to do before doing it. Examples:

- "I'll search for that now. Let me look through your documents..."
- "Let me check your calendar and then compare it with your tasks..."
- "I'm going to analyze your request. First I'll..."
- "Sure, I'll look into that for you. Give me a moment while I..."

On text this is annoying. On voice it is worse: the user hears an entire sentence describing a step that adds nothing before the answer they asked for arrives.

The fix is a single new block in `conversation-discipline.ts` added to `buildConversationDisciplineBlock()`. No other file needs changing in core. The support agent system prompt (`00-system-prompt.md`) also gets the equivalent rule added to its Format rules section.

---

## What is narration and what is not

Narration (ban these):
- Announcing a tool call you are about to make: "I'll search for that now."
- Describing your process before running it: "Let me check your calendar..."
- Multi-step pre-announcement: "First I'll look at X, then I'll check Y, then I'll..."
- Filler that delays the answer: "Give me a moment while I look into this."

Not narration (these are fine):
- Brief human openers: "Sure.", "Got it.", "Right, so:", "Here:"
- A short connector after a result: "That's your last 5 tasks. Want me to add one?"
- A genuine clarifying question before acting: "Which project should I search in?"
- A status note mid-long-task when genuinely useful: "Still running - this file is large."
- Warmth after the answer: "Let me know if you want more detail on any of these."

The rule is: lead with the result. Personality lives in how you deliver it and what comes after it, not in announcing the steps before you take them.

---

## Change 1 - Add `buildResponseDeliveryBlock()` to `conversation-discipline.ts`

Open `backends/servers/core.carinaai.uk/src/agents/conversation-discipline.ts`.

Add the following function after `buildGroupChatBlock()` and before `buildConversationDisciplineBlock()`:

```typescript
export function buildResponseDeliveryBlock(): string {
  return [
    'Response delivery:',
    'Lead with the answer, result, or completed action. Do not narrate the steps you are about to take before you take them.',
    'Do not say "I\'ll search for that now" before searching. Do not say "Let me check your calendar" before checking. Do not say "I\'m going to analyze this" before analyzing. Give the result, then (only if useful) a brief note on where it came from.',
    'Brief natural openers are fine and human: "Sure.", "Got it.", "Right, so:", "Here:". They are not narration. Narration is describing your own process before you run it.',
    'This applies on every surface including voice audio. On voice, a process-narration sentence reads aloud as empty words in front of the actual answer - cut it every time.',
    'Warmth belongs in the answer and in what follows it, not in a pre-flight announcement.',
  ].join('\n');
}
```

Then update `buildConversationDisciplineBlock()` to include the new block:

```typescript
export function buildConversationDisciplineBlock(): string {
  return [
    buildCasualMessagesBlock(),
    '',
    buildGroupChatBlock(),
    '',
    buildResponseDeliveryBlock(),
  ].join('\n');
}
```

That is the complete change to `conversation-discipline.ts`. No imports change. No other files in core need updating.

---

## Change 2 - Add the same rule to the support agent system prompt

Open `internal/prompts/pending_prompts/sprint-3/support-agent/00-system-prompt.md`.

In the `### Format rules` section, add the following as the first rule (before the existing bullet points):

```markdown
- Lead with the answer. Do not describe what you are about to do before doing it. "Let me check that for you" followed by the answer is just padding. Say the answer.
- Brief natural openers are fine: "Sure.", "Got it.", "Right, so:". These are human. They are not narration.
- On voice: process narration is read aloud before the answer arrives. Cut it every time on every surface.
```

The Format rules section after the change should read:

```markdown
### Format rules

- Lead with the answer. Do not describe what you are about to do before doing it. "Let me check that for you" followed by the answer is just padding. Say the answer.
- Brief natural openers are fine: "Sure.", "Got it.", "Right, so:". These are human. They are not narration.
- On voice: process narration is read aloud before the answer arrives. Cut it every time on every surface.
- Keep answers short: two to four sentences for simple questions, a numbered list for step-by-step help.
- Use headers only when you are explaining something with three or more distinct parts.
- Never use bullet points for a single item.
- No em dashes. No emojis.
- Do not start a response with "Great question!" or any filler phrase.
```

---

## Before and after examples

These are concrete illustrations for QA. Use them to test the behaviour after deploying.

**Calendar query**

Before: "Let me check your calendar for you. I'll pull up today's schedule now..."
After: "You have three events today: standup at 9am, client call at 2pm, and a 4pm review. No gaps longer than an hour."

**File search**

Before: "Sure, I'll search through your documents for that. Give me a moment while I look..."
After: "Found it in the Q3 report, page 4: [excerpt]."

**Task action**

Before: "I'm going to add that task for you now. First I'll check your existing list..."
After: "Added: 'Send invoice to ABC Ltd' due Friday."

**Unknown answer (honest)**

Before: "Let me think about that and check what I know. I'm going to look through my knowledge base..."
After: "I don't have a clear answer on that one. Could you describe what you are seeing? I will do my best to help from there."

**Warm opener - still allowed**

Before: (no change needed, this is already correct)
After: "Got it. Your last five memories are: [list]. Want me to add or edit any of them?"

---

## Voice surface note

There is no separate voice response filter in core. The TTS pipeline (`src/api/tts-api.ts`, `src/gateway/telegram-audio.ts`) converts the same response text to audio. Fixing the rule at response generation level (in `conversation-discipline.ts`) means the fix applies to voice automatically. No separate voice-layer change is needed.

---

## Done when

- [ ] `buildResponseDeliveryBlock()` exists in `conversation-discipline.ts` and is exported.
- [ ] `buildConversationDisciplineBlock()` includes `buildResponseDeliveryBlock()` in its output.
- [ ] `pnpm tsc --noEmit` passes with no new errors.
- [ ] `pnpm test` passes with no new failures (no test expects the old narration text verbatim).
- [ ] `00-system-prompt.md` has the three new bullet points at the top of the Format rules section.
- [ ] Manual test: ask Carina "what tasks do I have today?" and confirm the response starts with the task list, not "Let me check your tasks now."
- [ ] Manual test: ask Carina "search my documents for the invoice from March" and confirm the response starts with the result, not a search announcement.
- [ ] No em dashes or emojis appear anywhere in the new text.
