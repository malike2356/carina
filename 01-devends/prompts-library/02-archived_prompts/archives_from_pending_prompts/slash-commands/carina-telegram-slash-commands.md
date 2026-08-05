# Sprint: Add Telegram Slash Commands to Carina

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

**Repo:** `core.carinaai.uk`
**Depends on:** Working Telegram adapter (`src/channels/adapters/telegram-adapter.ts`), existing CLI command registry pattern
**Goal:** Let users type `/help`, `/new`, `/status`, `/tools`, `/stop` in Telegram DMs and get instant responses without invoking the full agent turn.

---

## Context

Hermes (the agent Laud uses) has built-in `/` commands on Telegram because the bot framework handles them natively. Carina does not. When a user types `/help` to Carina on Telegram, she treats it as natural language and runs a full agent turn; wasting tokens and time.

This prompt builds a lightweight slash command layer that intercepts Telegram messages starting with `/` BEFORE they reach the agent, executes the command locally, and responds instantly.

---

## Architecture

```
Telegram webhook
  → telegram-adapter.parse()
    → NEW: SlashCommandRouter (this prompt)
      → if message starts with "/": handle locally, send response, DONE
      → otherwise: pass to agent as normal
```

Commands execute **locally**; no agent invocation, no LLM call, no token usage. The response is immediate.

---

## Part 1: Slash Command Registry

**New file:** `src/channels/slash-commands/registry.ts`

A registry of available commands. Each command has:
- `name`: the command without `/` (e.g., `help`, `new`)
- `description`: what it does (shown in `/help`)
- `handler`: async function that receives context and returns a response string

```typescript
import type { ChannelMessage } from '../channel-adapter.interface.js';

export interface SlashCommand {
  name: string;
  description: string;
  handler: (msg: ChannelMessage) => Promise<string>;
}

const commands = new Map<string, SlashCommand>();

export function registerCommand(cmd: SlashCommand): void {
  commands.set(cmd.name, cmd);
}

export function getCommand(name: string): SlashCommand | undefined {
  return commands.get(name);
}

export function listCommands(): SlashCommand[] {
  return Array.from(commands.values());
}
```

**Register it in the core startup** so commands are loaded before webhooks receive traffic. Find where channels are initialized (likely `src/gateway/channels/directory.ts` or `src/gateway/server.ts`) and add `import './slash-commands/index.js'` at the top of that file.

---

## Part 2: The Five Commands

**New file:** `src/channels/slash-commands/index.ts`

Import and register all commands. This is the file that gets side-effect imported at startup.

```typescript
import { registerCommand } from './registry.js';
import { helpCommand } from './help.js';
import { newCommand } from './new.js';
import { statusCommand } from './status.js';
import { toolsCommand } from './tools.js';
import { stopCommand } from './stop.js';

registerCommand(helpCommand);
registerCommand(newCommand);
registerCommand(statusCommand);
registerCommand(toolsCommand);
registerCommand(stopCommand);
```

### 2a. `/help`; Show available commands

**New file:** `src/channels/slash-commands/help.ts`

Returns a formatted list of all registered commands with descriptions. Dynamically reads from the registry so new commands auto-appear.

```
Carina slash commands:

/new; Start a fresh conversation (forget current context)
/status; System health, active toolsets, uptime
/tools; List active tools + link to full 233-tool catalogue
/stop; Cancel the current task
/help; Show this list
```

Use `listCommands()` from the registry to build the list dynamically.

### 2b. `/new`; Start fresh conversation

**New file:** `src/channels/slash-commands/new.ts`

Clears the current agent session for this user so the next message starts fresh. 

Find how sessions are keyed: look at `channel-session-binding.ts` and the session key used for the agent. The session key is typically something like `tg:<chatId>` or derived from `buildSessionExternalKey()` in `channel-routing.ts`.

To clear the session:
1. Import the session store (likely `src/workspaces/sessions/` or `src/agents/session-store.ts`; search for where agent conversations are persisted)
2. Delete the session entry for this user's key
3. Return: "Fresh conversation started. Previous context cleared."

If the session store is in-memory and the key can't be directly deleted, instead set a flag in the response metadata that tells the agent turn runner to start with an empty conversation array. Look at how `CARINA_PROMPT_NOW=true` or session resets are currently handled in `prompt-cache.ts` or the agent turn runner.

### 2c. `/status`; System health snapshot

**New file:** `src/channels/slash-commands/status.ts`

Returns a compact status report:

```
Carina status:
• Uptime: 2h 34m
• Active toolsets: default, security
• Gateway: healthy
• Scout: connected
• Embedding provider: degraded (OpenAI quota)
• Last deploy: 2026-06-26 22:55 UTC
```

Implementation:
- Uptime: track via `process.uptime()` or a startup timestamp stored in a global
- Active toolsets: read from the toolset config (likely `src/tools/toolset.ts` or the active toolset map)
- Gateway health: simple self-check (if this code is running, gateway is up)
- Scout: check `LABYRINTH_ENABLED` env var and whether Scout heartbeat is recent (check Redis key if available)
- Embedding: call `embeddingProviderStatus()` from `src/memory/embeddings.ts`
- Last deploy: read from a file like `dist/.deploy-timestamp` or an env var `DEPLOY_TIMESTAMP`

Keep it compact; no more than 8 lines.

### 2d. `/tools`; Active tools + catalogue link

**New file:** `src/channels/slash-commands/tools.ts`

Returns:

```
Carina tools:
• Active: 22 tools (default toolset)
• Full catalogue: 233 tools across 21 capability layers
• Catalogue: https://docs.carinaai.uk/tools
• Enable more: /packs or "carina tools enable <toolset>"
```

Implementation:
- Active count: count the tools currently loaded/registered in the default session (inspect the runtime tool map; check `src/tools/` for the active tool registry)
- Full count: READ from `platform-knowledge.md` which says "233 tools across 21 capability layers"; or just hardcode "233" as the canonical number from the catalogue
- Catalogue link: point to the docs URL

### 2e. `/stop`; Cancel current task

**New file:** `src/channels/slash-commands/stop.ts`

Cancels any in-progress agent task for this user/channel.

If Carina supports mid-turn cancellation (check the agent turn runner for an abort controller or cancellation token pattern):
1. Find the active turn for this session key
2. Signal cancellation (AbortController.abort() or equivalent)
3. Return: "Current task cancelled."

If no cancellation mechanism exists, return:
"No active task to cancel. (Note: tasks that have already begun tool execution cannot be interrupted mid-flight.)"

---

## Part 3: Router; Intercept Before Agent

**Modify:** `src/channels/adapters/telegram-adapter.ts`

OR create a new interceptor that runs between `parse()` and the agent turn dispatcher.

**Option A; In the adapter (simpler):**

Modify the `parse()` method to detect slash commands and mark them:

```typescript
parse(payload, workerId, workspaceId): InboundMessage | null {
  const update = payload as TelegramUpdate;
  const msg = update.message;
  if (!msg?.text || !msg.from || !msg.chat) return null;
  if (msg.chat.type !== 'private') return null;

  const text = msg.text.trim();

  return {
    channel: 'telegram',
    workerId,
    workspaceId,
    contactId: String(msg.chat.id),
    contactName: msg.from.first_name ?? msg.from.username,
    content: text,
    rawPayload: payload,
    timestamp: new Date(msg.date * 1000),
    threadId: String(msg.message_id),
    // NEW: flag slash commands
    isSlashCommand: text.startsWith('/'),
  };
}
```

But `InboundMessage` / `ChannelMessage` may not have `isSlashCommand`. You'll need to add it to the type definition.

**Option B; Separate interceptor (cleaner):**

Create `src/channels/slash-commands/interceptor.ts`:

```typescript
import { getCommand } from './registry.js';
import type { ChannelMessage } from '../channel-adapter.interface.js';
import type { OutboundMessage } from '../types.js';

export interface SlashInterceptResult {
  handled: boolean;
  response?: string;
}

export async function interceptSlashCommand(msg: ChannelMessage): Promise<SlashInterceptResult> {
  const text = msg.content?.trim() ?? '';
  if (!text.startsWith('/')) return { handled: false };

  const parts = text.split(/\s+/);
  const cmdName = (parts[0]?.slice(1) ?? '').toLowerCase();
  const cmd = getCommand(cmdName);
  
  if (!cmd) {
    return { handled: true, response: `Unknown command: /${cmdName}. Type /help for available commands.` };
  }

  const response = await cmd.handler(msg);
  return { handled: true, response };
}
```

Then find where `parse()` output flows into the agent turn runner. Look in `src/gateway/` for the webhook handler that:
1. Calls adapter.parse()
2. Calls guardInboundMessage()
3. Dispatches to the agent

Between steps 2 and 3, insert:

```typescript
const slashResult = await interceptSlashCommand(parsedMessage);
if (slashResult.handled) {
  // Send response immediately, skip agent
  await adapter.send({ content: slashResult.response, contactId: parsedMessage.contactId });
  return { status: 200, body: { ok: true } };
}
```

---

## Part 4: Type Definitions

**Modify:** `src/channels/channel-adapter.interface.ts`

Add `isSlashCommand?: boolean` to the `ChannelMessage` type (if using Option A).

**Modify:** `src/channels/types.ts` (or wherever `InboundMessage` is defined)

Same; add `isSlashCommand?: boolean` to `InboundMessage`.

---

## Part 5: Tests

**New file:** `src/channels/slash-commands/registry.test.ts`

Tests for:
- Registering and retrieving commands
- `listCommands()` returns all registered
- Unknown command returns undefined

**New file:** `src/channels/slash-commands/interceptor.test.ts`

Tests for:
- Non-slash message → `handled: false`
- `/help` → returns list with all registered commands
- `/new` → clears session, returns confirmation
- `/status` → returns compact status
- `/tools` → returns active count + catalogue reference
- `/stop` → returns cancellation status
- `/unknowncmd` → returns "Unknown command" message
- Empty message → `handled: false`
- Message without leading slash → `handled: false`

---

## Read These Before Coding

1. `src/channels/adapters/telegram-adapter.ts`; current parse/send, see where to hook in
2. `src/channels/channel-adapter.interface.ts`; `ChannelMessage` type
3. `src/channels/channel-routing.ts`; session key building
4. `src/channels/channel-session-binding.ts`; how sessions are stored/retrieved
5. `src/gateway/channels/inbound-guards.ts`; where messages are gated before agent
6. `src/gateway/server.ts`; find the webhook endpoint that receives Telegram updates
7. `src/tools/toolset.ts`; active toolset configuration
8. `src/memory/embeddings.ts`; `embeddingProviderStatus()` for /status
9. `src/agents/conversation-discipline.ts`; `buildPlatformProjectAwarenessBlock()` reference
10. `src/platform/platform-knowledge.md`; authoritative tool count (233)

---

## Verification

After building, test with curl (simulating a Telegram webhook):

```bash
# /help
curl -X POST http://localhost:3333/api/channels/webhook/telegram/<workerId> \
  -H "Content-Type: application/json" \
  -H "x-telegram-bot-api-secret-token: $TELEGRAM_WEBHOOK_SECRET" \
  -d '{"message":{"message_id":1,"text":"/help","date":1719876543,"from":{"id":12345,"first_name":"Test"},"chat":{"id":12345,"type":"private"}}}'

# /status
curl ... -d '{"message":{"message_id":2,"text":"/status",...}}'

# /tools
curl ... -d '{"message":{"message_id":3,"text":"/tools",...}}'

# /new
curl ... -d '{"message":{"message_id":4,"text":"/new",...}}'

# /stop
curl ... -d '{"message":{"message_id":5,"text":"/stop",...}}'
```

Each should return an immediate response with no agent turn invoked.

---

## Do Not

- Do NOT change how non-slash messages are processed
- Do NOT invoke the LLM for slash commands; they are local-only
- Do NOT add slash commands to channels other than Telegram for now
- Do NOT break the existing CLI command registry (the two registries are separate)
- Do NOT modify the Dockerfile or deployment scripts
