# Phase 2.8 — Memory + Session Search Tools

## Task
Implement the `memory` and `session_search` tools. These give Carina persistent knowledge across sessions and the ability to search past conversations.

## memory tool

### Specification
Save durable information that persists across sessions. Memory is injected into every future turn.

### Actions
- add: Create a new memory entry
- replace: Update an existing entry (old_text identifies it)
- remove: Delete an entry (old_text identifies it)

### Targets
- 'user': Who the user is — name, role, preferences, communication style
- 'memory': Agent's notes — environment facts, project conventions, tool quirks

### What to save
- User corrects the agent or says "remember this"
- User shares a preference, habit, or personal detail
- Discovered environment facts (OS, tools, project structure)
- Learned conventions, API quirks, workflows
- Priority: user preferences > environment facts > procedural knowledge

### What NOT to save
- Task progress, session outcomes, completed-work logs
- PR numbers, issue numbers, commit SHAs
- Any artifact that will be stale in a week
- Use session_search for recalling past work instead

### Limits
- Total memory: 2,200 characters for agent notes, 1,375 for user profile
- Entries must be compact and focused
- Memory consolidation skill handles compression when approaching limits

### Format
Write as declarative facts, not instructions.
- Good: "User prefers concise responses"
- Bad: "Always respond concisely" (reads as directive in future sessions)

## session_search tool

### Specification
Search past sessions stored in the local session database. FTS5-backed retrieval over SQLite message store.

### Three calling shapes

1. DISCOVERY — pass `query`
   ```
   session_search(query="auth refactor", limit=3)
   ```
   - Runs FTS5, dedupes by session lineage
   - Returns top N sessions with:
     - session_id, title, timestamp, source
     - snippet: FTS5-highlighted match excerpt
     - bookend_start: first 3 messages (the goal)
     - messages: +/-5 messages around the match
     - bookend_end: last 3 messages (the resolution)

2. SCROLL — pass `session_id` + `around_message_id`
   ```
   session_search(session_id="abc123", around_message_id=12345, window=10)
   ```
   - Returns +/-window messages centered on anchor
   - Scroll forward: pass last message id as around_message_id
   - Scroll backward: pass first message id

3. BROWSE — no args
   ```
   session_search()
   ```
   - Returns recent sessions chronologically: titles, previews, timestamps

### FTS5 syntax
- AND is default (multi-word = all terms required)
- OR: "alpha OR beta OR gamma"
- Quotes: "docker networking" (exact phrase)
- Boolean: "python NOT java"
- Wildcards: "deploy*"

### Parameters
- query (string): Search query (discovery shape)
- limit (int, default 3, max 10): Max sessions to return
- sort (enum: newest|oldest): Temporal bias. Omit for relevance-only.
- session_id (string): Session to scroll inside (scroll shape)
- around_message_id (int): Message to center window on (scroll shape)
- window (int, default 5, max 20): Messages per side of anchor
- role_filter (string): Comma-separated roles to include (default: 'user,assistant')

### Use cases
- "What did we decide about the Propreneur IPN deadline?"
- "Where did we leave off on the TuinApp Docker setup?"
- "Find the session where we configured the VPS firewall"

### Implementation notes
- SQLite FTS5 table on session messages
- Indexed on: session_id, message_id, role, content
- Deduplication by session lineage (child sessions grouped with parent)
- Inject most recent completed cron job outputs as context

### Verification
```bash
# Add a memory
memory: { action: "add", target: "memory", content: "Project uses PostgreSQL 16 on port 5432" }

# Search past sessions
session_search: { query: "postgresql database" }

# Browse recent
session_search: {}
```
