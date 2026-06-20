# Action: Group Chat Speaking Rules + Platform Formatting - Scoped to Carina's Real Gateways (Standalone Carina)

## Goal
Build the genuinely valuable, portable parts of this spec - speak-or-stay-silent judgment for group conversations, triple-tap prevention, and per-platform output formatting - scoped to the four gateways Carina actually has (`cli`, `telegram`, `whatsapp`, `web`), with the formatting-adapter layer designed so a future fifth gateway is a small addition, not a rewrite.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **The platform list needs correcting before anything else gets built**: the spec lists seven platforms - "telegram, discord, slack, whatsapp, sms, matrix, signal" - and describes Discord-specific behaviour (`<>`-wrapped link suppression, 2000-char limits, embeds), Slack, Matrix, Signal, and raw SMS formatting. **Carina has exactly four message sources** (`CarinaMessage['source']` in `src/types/index.ts`: `'cli' | 'telegram' | 'whatsapp' | 'web'` - confirmed, no Discord/Slack/Matrix/Signal/SMS gateway exists anywhere in `src/gateway/`). Building Discord-specific link-suppression formatting for a gateway that doesn't exist is exactly the kind of bulk-imported, wrong-product content this whole batch keeps surfacing - skip it, document why, and design the formatting layer so adding a real Discord gateway later is "write one new adapter," not "rearchitect."
- **"Group chat" applies meaningfully to exactly one of Carina's four gateways today**: Telegram bots can be added to group chats (the Telegram Bot API exposes `chat.type: 'group' | 'supergroup'`); WhatsApp-via-Twilio group support is limited and not currently wired up (`grep -n "chat.type\|group" src/gateway/whatsapp.ts` returns nothing); `web` and `cli` are inherently 1:1. So the "when to speak vs. stay silent" logic is, concretely, **Telegram-group-chat logic** for now - write it generically (it's a reusable judgment skill, not Telegram-specific reasoning), but verify it against the one real surface that needs it.
- **The reaction system needs a feasibility check before being designed, not after**: the spec assumes the agent can attach lightweight emoji reactions to messages. The Telegram Bot API DOES support this (`setMessageReaction`, Bot API 7.0+) - check whether the `node-telegram-bot-api` version in `package.json` exposes it (`grep -n '"node-telegram-bot-api"' package.json`, then check that package's typings/changelog for `setMessageReaction` support - it may need a version bump, or may need a raw `bot.sendChatAction`-style escape hatch if the wrapper library lags the Bot API). WhatsApp-via-Twilio has no equivalent reaction-send capability in the API surface Carina currently uses. **If Telegram reactions aren't cleanly available in the installed library version, say so plainly and scope the feature to "Telegram only, when the library supports it" rather than building a cross-platform abstraction for a capability that exists on one platform.**
- Read `src/gateway/telegram.ts`, `src/gateway/whatsapp.ts`, `src/gateway/router.ts`, and `src/types/index.ts`'s `CarinaMessage` shape in full before writing anything - you need to know exactly what metadata (chat type, sender name, mention detection) is and isn't currently captured on the way in.

## Files to create
- `src/gateway/group-chat.ts` - `shouldRespondInGroup(context): { respond: boolean, reason: string }`, `wasMentioned(message, botUsername)`, triple-tap tracking (`hasRecentlyResponded(chatId, messageId)`)
- `src/gateway/group-chat.test.ts`
- `src/gateway/formatting.ts` - the per-platform formatting adapter: `formatForPlatform(text: string, platform: CarinaMessage['source']): string | string[]` (returns an array when splitting is needed, mirroring `whatsapp.ts`'s existing `splitMessage`)
- `src/gateway/formatting.test.ts`

## Files to modify
- `src/gateway/telegram.ts` - capture `chat.type`/`chat.title`/sender display name on inbound messages (needed for group-aware decisions); wire `shouldRespondInGroup` into the reply path; wire reactions if feasible per the check above
- `src/gateway/whatsapp.ts` - route outbound text through `formatForPlatform` (it already has `splitMessage`/`WHATSAPP_MAX` - check whether `formatForPlatform` should subsume that or call into it, to avoid two competing length-handling mechanisms)
- `src/types/index.ts` - extend `CarinaMessage` with whatever group-context fields step 1 determines are missing (e.g. `chatType?: 'private' | 'group'`, `mentioned?: boolean`) - additive only, do not change existing required fields
- `src/gateway/router.ts` - thread the new context through to the orchestrator as system-instruction context (mirror exactly how `systemPromptSuffix` composition already works - this is "more context for the same mechanism," not a new injection path)

## Step-by-step

1. Trace exactly what Telegram message metadata currently reaches `CarinaMessage` (read `telegram.ts`'s message-handling code in full - the `bot.on('message', ...)` or equivalent handler). Identify the gap between what's captured now and what `shouldRespondInGroup` needs (`chat.type`, whether the bot was @mentioned or replied-to, who else is in the conversation). Extend `CarinaMessage` additively to carry it.

2. Implement `wasMentioned(message, botUsername)`: Telegram messages carry `entities` arrays marking `@mentions` and a `reply_to_message` field for replies - a message is "directed at the agent" if it @-mentions the bot's username OR is a reply to one of the bot's own messages. Write this as a pure function over the raw Telegram message shape (easy to unit test without a live bot).

3. Implement `shouldRespondInGroup(context)` as a **judgment-producing function that feeds the agent's reasoning, not a hard gate that silently drops messages**: rather than mechanically deciding "respond: true/false" from keyword rules (which the spec's own list - "can add genuine value," "something witty fits naturally," "would interrupt the vibe" - shows requires actual judgment an LLM is suited for and a regex is not), structure this as: (a) a fast, mechanical pre-filter for the unambiguous cases (`wasMentioned` -> always at least consider responding; pure banter with zero agent-relevant content and no mention -> skip the LLM call entirely, for cost and latency), and (b) for the ambiguous middle, pass the speaking-rules as system-instruction context into the SAME agent turn that would generate a response, and let the agent itself decide whether to produce one or stay silent (a structured "no response needed" signal the router recognises and doesn't deliver). This avoids building a second, cruder judgment layer in front of the one the agent already has.

4. Implement triple-tap prevention (`hasRecentlyResponded`): track `(chatId, messageId)` -> `respondedAt` in a small bounded cache (a `Map` with periodic cleanup, mirroring `GatewayRouter`'s `lastSeen`/`evictStaleSessions` pattern - do not add Redis/Postgres for what is fundamentally an in-process debounce). One response per triggering message, full stop - if the agent's turn produces both a text reply and a reaction, that's a deliberate "response + light acknowledgement" pairing the spec itself allows ("one thoughtful response beats three fragments" is about not sending three separate messages, not about banning a reaction alongside a reply) - design the check around "messages sent," not "any agent output at all."

5. Implement `formatForPlatform` covering the four real targets:
   - `telegram`: structured, medium-length, Markdown/HTML as the bot already supports (check `telegram.ts` for which parse mode is configured) - the spec's guidance applies directly here
   - `whatsapp`: plain text, no markdown tables (convert to bullet lists), no headers (bold/CAPS for emphasis) - per the spec's WhatsApp guidance, which is the one platform-specific section that maps onto a real Carina gateway as-is
   - `web`: whatever the web UI already renders (check `src/gateway/web/` - if it renders Markdown, minimal transformation is needed; if plain text, treat similarly to WhatsApp)
   - `cli`: terminal-appropriate (check how `cli.ts` currently prints agent output - `chalk`-coloured plain text; tables/headers should degrade to something readable in a terminal)
   - Length-limit splitting: reuse/generalise `whatsapp.ts`'s existing `splitMessage` rather than writing a second chunking function - this is exactly the kind of "don't fork shared logic" moment this batch keeps flagging

6. Document the explicitly-excluded platforms (Discord, Slack, Matrix, Signal, SMS) in your completion summary with the one clear reason: "no gateway exists; building format adapters for non-existent gateways is speculative scope, not a porting task. The adapter design (`formatForPlatform(text, platform)`) is intentionally a clean extension point - adding a real Discord gateway later means adding one case, not restructuring this."

7. Write both test files:
   - `group-chat.test.ts`: `wasMentioned` against realistic Telegram message fixtures (plain mention, reply-to-bot, neither); triple-tap prevention across rapid repeated triggers; the mechanical pre-filter correctly fast-paths obvious banter without invoking the agent
   - `formatting.test.ts`: each platform's transformation against representative inputs (a markdown table -> WhatsApp bullet list, an over-length message -> correctly chunked array, etc.)

## Expected behavior
- In a Telegram group, "Hey everyone, what's for lunch?" produces no agent response (mechanical pre-filter, no LLM call spent).
- "@Carina what's the status on the deploy?" produces exactly one response.
- The same triggering message never produces two replies or a reply-plus-reaction-plus-reaction pile-up.
- A markdown table destined for WhatsApp arrives as a clean bullet list; the same content destined for Telegram keeps its table if Telegram's parse mode supports it.
- Discord/Slack/Matrix/Signal/SMS are nowhere in the code, and the completion summary explains why in one sentence each.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/gateway/group-chat.test.ts src/gateway/formatting.test.ts
pnpm test
pnpm build
```
Manual check: add the bot to a real (test) Telegram group, run through the spec's own verification script (casual banter -> silence, direct mention -> response, repeated triggers -> single response).

## Dependencies
- `node-telegram-bot-api`'s support for `setMessageReaction` (verify before designing the reaction feature around it; scope down to "Telegram only, if supported" otherwise)
- None beyond what exists for the formatting/speaking-rules logic itself
