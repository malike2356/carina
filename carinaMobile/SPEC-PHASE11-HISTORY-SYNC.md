# SPEC: Cross-Platform Message History Sync (Phase 11)

**Status:** Spec only. Claude to implement.
**Base:** `carina/core.carinaai.uk/` (server) + `carina/carinaMobile/` (mobile) + web UI + Telegram adapter.
**Goal:** Every surface sees the same conversation history. No disconnected chats.

---

## 1. Problem

```
Telegram ("what's the weather?")  ──→  episodic_memories (server)  ←──  Web UI (sees nothing)
                                                                      ←──  Mobile (sees nothing)
```

The agent has full context via `getSessionHistory()` injection into the LLM prompt. But **clients never fetch history from the server**. Each surface is an island; mobile has its own AsyncStorage, Telegram is stateless, web UI doesn't display history at all.

After this spec, every surface that loads a session sees **the same message list**, ordered chronologically, regardless of which surface sent which message.

---

## 2. Server Side: New API Endpoint

### 2.1 Endpoint

```
GET /api/chat/history/:sessionId?limit=100&before=<ISO timestamp>
```

**Authentication:** Same as the chat endpoints; session cookie (hosted), API key (self-hosted), or control auth (operator).

**Response:**
```json
{
  "sessionId": "abc123",
  "messages": [
    {
      "id": "mem-001",
      "role": "user",
      "content": "what's the weather?",
      "createdAt": "2026-06-14T10:00:00.000Z",
      "source": "telegram"
    },
    {
      "id": "mem-002",
      "role": "assistant",
      "content": "It's 18°C and sunny in London.",
      "createdAt": "2026-06-14T10:00:05.000Z",
      "source": "telegram"
    },
    {
      "id": "mem-003",
      "role": "user",
      "content": "remind me to call Annie at 3pm",
      "createdAt": "2026-06-14T10:15:00.000Z",
      "source": "mobile"
    }
  ],
  "hasMore": true,
  "oldestMessageId": "mem-001",
  "newestMessageId": "mem-003"
}
```

**Pagination:** `before` parameter for scrolling up. Omit for latest messages. `hasMore` indicates if there are older messages.

### 2.2 Implementation (server)

**File:** `src/api/chat-history-api.ts` (new)

```typescript
import { Router } from 'express';
import { getSessionHistory } from '../memory/episodic-postgres.js';

export const chatHistoryRouter = Router();

chatHistoryRouter.get('/api/chat/history/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  
  // Scope check: ensure the session belongs to this tenant
  // hostedAccountId or webAuthed or API key auth
  const tenantId = req.session?.hostedAccountId ?? '__operator__';
  if (tenantId !== '__operator__' && !sessionId.startsWith(`${tenantId}:`)) {
    return res.status(403).json({ error: 'Session does not belong to you' });
  }
  
  try {
    const memories = await getSessionHistory(sessionId, limit + 1);
    const hasMore = memories.length > limit;
    if (hasMore) memories.pop(); // remove the extra one used for hasMore check
    
    const messages = memories.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));
    
    res.json({
      sessionId,
      messages,
      hasMore,
      oldestMessageId: messages[0]?.id ?? null,
      newestMessageId: messages[messages.length - 1]?.id ?? null,
    });
  } catch (err) {
    console.error('[chat-history] fetch failed:', err);
    res.status(500).json({ error: 'Failed to load history' });
  }
});
```

**Mount in `src/gateway/web.ts`:**
```typescript
import { chatHistoryRouter } from '../api/chat-history-api.js';
// ... in the web route setup:
app.use(chatHistoryRouter);
```

**Modify `src/memory/episodic-postgres.ts`:** Add optional `before` parameter to `getSessionHistory`:

```typescript
export async function getSessionHistory(
  sessionId: string,
  limit: number,
  before?: Date,
): Promise<Memory[]> {
  let query = `SELECT id, session_id, role, content, created_at
     FROM episodic_memories
     WHERE session_id = $1`;
  const params: unknown[] = [sessionId];
  
  if (before) {
    query += ' AND created_at < $2';
    params.push(before.toISOString());
  }
  query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
  params.push(limit);
  
  const result = await pool.query(query, params);
  return result.rows.map(rowToMemory).reverse(); // return in ASC order
}
```

### 2.3 Source tracking (optional enhancement)

Currently `episodic_memories` has no `source` column. If we want to show which platform a message came from (Telegram, web, mobile, CLI), add a migration:

```sql
ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS source TEXT;
```

Then thread the source through from the channel adapters. Deferred; not required for the core sync to work.

---

## 3. Mobile Client: History Sync

### 3.1 New API client

**File:** `src/api/chat-history-client.ts` (new)

```typescript
export interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ChatHistoryResponse {
  sessionId: string;
  messages: ChatHistoryMessage[];
  hasMore: boolean;
  oldestMessageId: string | null;
  newestMessageId: string | null;
}

export async function fetchChatHistory(
  baseUrl: string,
  sessionId: string,
  options?: { limit?: number; before?: string; credentials?: RequestCredentials; apiKey?: string },
): Promise<ChatHistoryResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.before) params.set('before', options.before);
  
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options?.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;
  
  const url = `${baseUrl.replace(/\/+$/, '')}/api/chat/history/${encodeURIComponent(sessionId)}?${params}`;
  const response = await fetch(url, {
    credentials: options?.credentials ?? 'include',
    headers,
  });
  
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`History fetch ${response.status}: ${body || response.statusText}`);
  }
  return response.json();
}
```

### 3.2 Modify `src/hooks/useChatSession.ts`

In the `bootstrap` function (called when a session loads), add a server history fetch:

```typescript
const bootstrap = useCallback(async () => {
  const config = await ensureSessionId();
  setInstance(config);
  
  // Load local messages first (fast, offline)
  const stored = await loadChatMessages(config.sessionId);
  setMessages(stored);
  
  // Then sync with server (may have messages from other surfaces)
  if (instance?.mode === 'cloud' || instance?.baseUrl) {
    try {
      const lastLocalId = stored[stored.length - 1]?.id;
      const server = await fetchChatHistory(
        instance.baseUrl,
        config.sessionId,
        {
          limit: 200,
          credentials: gatewayAuth?.credentials ?? 'omit',
          apiKey: gatewayAuth?.apiKey ?? undefined,
        },
      );
      
      // Merge: server messages that are NOT already in local storage
      const merged = mergeMessages(stored, server.messages);
      if (merged.length !== stored.length) {
        setMessages(merged);
        await saveChatMessages(config.sessionId, merged);
      }
    } catch {
      // Server unavailable; stick with local messages (graceful degradation)
    }
  }
  
  setReady(true);
}, [setInstance, gatewayAuth, instance]);
```

### 3.3 New utility: `src/lib/history-merge.ts` (new)

```typescript
import type { ChatMessage } from '@/api/types';
import type { ChatHistoryMessage } from '@/api/chat-history-client';

export function mergeMessages(
  local: ChatMessage[],
  server: ChatHistoryMessage[],
): ChatMessage[] {
  const localIds = new Set(local.map(m => m.id));
  const localContent = new Set(local.map(m => m.content.slice(0, 40))); // fuzzy dedup
  
  const merged = [...local];
  
  for (const srv of server) {
    // Skip if already present (by ID or by content prefix match)
    if (localIds.has(srv.id)) continue;
    if (localContent.has(srv.content.slice(0, 40))) continue;
    
    merged.push({
      id: srv.id,
      role: srv.role,
      content: srv.content,
      createdAt: srv.createdAt,
      status: 'done' as const,
    });
  }
  
  // Sort by creation time
  merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  return merged;
}
```

### 3.4 Modify `src/api/types.ts`

Add `source` field to `ChatMessage` (optional):

```typescript
export interface ChatMessage {
  // ... existing fields ...
  source?: string; // 'telegram' | 'web' | 'mobile' | 'cli'; which surface sent this
}
```

---

## 4. Web UI: History Display

The web chat UI (`core.carinaai.uk` served pages) currently is a PWA shell that streams chat in real-time. It doesn't persist or display history.

### 4.1 New HTML page feature: History loader

When a user navigates to `/chat?session=abc123` or clicks a session in the session drawer, the page should:

1. Call `GET /api/chat/history/abc123`
2. Render messages in the chat pane (matching the existing message bubble style)
3. Mark messages from other surfaces with a small source badge (e.g., "via Telegram")
4. Support scroll-up pagination: `?before=<oldest timestamp>`

**Implementation note:** This is pure client-side JavaScript. No new server code beyond the endpoint in §2.

### 4.2 Session drawer integration

The existing session drawer (`/dashboard` page) already lists active sessions. Each entry should be clickable → navigates to `/chat?session=<id>`, which loads history.

---

## 5. Telegram: History Retrieval

The Telegram bot adapter receives messages via webhook, sends them to the agent, and replies. Currently:
- Messages are stored in `episodic_memories` (via `saveMemory()`)
- The bot has no `/history` command or scroll-back capability

### 5.1 New bot command: `/history [N]`

When a user types `/history` or `/history 10`:

1. Call `getSessionHistory(sessionId, N)`
2. Format messages as a Telegram message (Markdown):
   ```
   *Last 10 messages:*
   
    You: what's the weather?
    Carina: It's 18°C in London.
    You: remind me about Annie
    Carina: Reminder set for 3pm.
   ...
   ```
3. Send as a single message (Telegram has 4096 char limit; cap at last 20-30 messages)

### 5.2 Modifications

**File:** `src/gateway/channels/adapters/telegram-adapter.ts` (or wherever Telegram message handling lives)

Add a command handler:
```typescript
if (text.startsWith('/history')) {
  const count = parseInt(text.split(' ')[1]) || 10;
  const history = await getSessionHistory(sessionId, Math.min(count, 30));
  const formatted = formatHistoryForTelegram(history);
  await sendMessage(chatId, formatted);
  return;
}
```

### 5.3 Inline keyboard: "Show history"

Add an inline keyboard button after each reply: `[ History]` that triggers a history fetch. This is more discoverable than a slash command.

---

## 6. CLI: History Command

The Carina CLI (`carina chat`) has its own local session DB. It should also fetch from the server when in hosted mode.

### 6.1 CLI command

```
carina history [session-id] [--limit N]
```

Implementation: call `GET /api/chat/history/:sessionId`, render as terminal output.

---

## 7. Cross-Channel Consistency Rules

These are rules every surface MUST follow for history to feel unified:

1. **Same message ID format**; `episodic_memories.id` is the canonical ID. Clients store it as the foreign key.
2. **Same ordering**; chronological ascending (oldest first). Server returns this. Clients must not reorder.
3. **Same merge logic**; when merging server history with local: deduplicate by ID, then by content prefix (first 40 chars). Never drop server messages.
4. **Source badges**; optional but recommended. Show a small icon/label on messages from other surfaces so the user knows "I said this on Telegram, now I'm reading it on mobile."
5. **No double-write**; the server already stores every message via `saveMemory()`. Clients should NOT re-send history they received from the server back to the server.
6. **Session scoping**; hosted users only see their own sessions. Operators see all. Self-hosted users see their own.

---

## 8. Migration (if source tracking is added)

```sql
-- Run on Contabo PostgreSQL (carina_central)
ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS idx_episodic_session_created 
  ON episodic_memories (session_id, created_at DESC);
```

Then update `saveMemory()` to accept an optional `source` parameter:
```typescript
export async function saveMemory(
  sessionId: string,
  role: Role,
  content: string,
  source?: string,
): Promise<void> { ... }
```

Backfill existing rows with `source = 'unknown'`.

---

## 9. Files to Touch

### Server (carina/core.carinaai.uk/)
| File | Action |
|------|--------|
| `src/api/chat-history-api.ts` | **NEW**; history endpoint |
| `src/gateway/web.ts` | Mount `chatHistoryRouter` |
| `src/memory/episodic-postgres.ts` | Add `before` param to `getSessionHistory()` |
| `src/memory/migrations.ts` | Optional: add `source` column |
| `src/gateway/channels/adapters/telegram-adapter.ts` | Add `/history` command + inline button |
| `src/cli/chat.ts` | Add `history` command |

### Mobile (carina/carinaMobile/)
| File | Action |
|------|--------|
| `src/api/chat-history-client.ts` | **NEW**; history fetch client |
| `src/lib/history-merge.ts` | **NEW**; merge logic |
| `src/hooks/useChatSession.ts` | Call history fetch in `bootstrap()` |
| `src/api/types.ts` | Add `source` field to `ChatMessage` |

### Web UI
| File | Action |
|------|--------|
| `public/chat.html` or equivalent | Add history loading on session open |
| `public/dashboard.html` | Wire session drawer items to `/chat?session=...` |

### Telegram
| File | Action |
|------|--------|
| (Same as server telegram-adapter) | `/history` command handler |

---

## 10. Build Order

1. **Server:** Add `before` parameter to `getSessionHistory()` (backward-compatible)
2. **Server:** Create `chat-history-api.ts` + mount in `web.ts`
3. **Mobile:** Create `chat-history-client.ts`
4. **Mobile:** Create `history-merge.ts`
5. **Mobile:** Modify `useChatSession.ts` bootstrap
6. **Telegram:** Add `/history` command
7. **Web UI:** Add history loading to chat page
8. **CLI:** Add `history` command
9. **Optional:** Migration for `source` column + backfill
10. **Test:** Send message on Telegram → open mobile → verify it appears
11. **Test:** Send message on mobile → open web → verify it appears
12. **Test:** `/clear` on any surface → all surfaces see empty history

---

## 11. Out of Scope

- Real-time sync (messages appearing live on other surfaces as they're typed). That's Phase 12; requires WebSocket push or polling.
- Rich media sync (images, files). Text-only for Phase 11.
- Read receipts / typing indicators.
- Message deletion/edit propagation (a `/edit` in Telegram updating the server and notifying other clients).
