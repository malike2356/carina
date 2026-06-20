# Prompt 05: Offline Sync for Memory and Sessions

## Context

The desktop app should work without a network connection for read operations. Memory
records, session transcripts, and project metadata should be cached locally so operators
can review past work while travelling or offline. When connectivity resumes, any local
changes sync to the server.

## What to Build

### 1. Local SQLite cache

Use `better-sqlite3` in a Node.js sidecar process, or Tauri's built-in SQLite via
`tauri-plugin-sql`. Use the latter (no Node.js sidecar needed):

```bash
# Add to Cargo.toml
[dependencies]
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

In `tauri.conf.json`:
```json
"plugins": {
  "sql": {}
}
```

In the web UI:
```typescript
import Database from '@tauri-apps/plugin-sql';

const db = await Database.load('sqlite:carina-cache.db');

await db.execute(`CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  messages TEXT,  -- JSON blob
  updated_at TEXT,
  synced_at TEXT
)`);

await db.execute(`CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT,
  tags TEXT,   -- JSON array
  project_id TEXT,
  updated_at TEXT,
  synced_at TEXT
)`);
```

### 2. Sync service

Create `apps/cloud/src/lib/sync.ts`:
```typescript
export class SyncService {
  private db: Database;
  private lastSyncAt: Date | null = null;

  async pullFromServer(): Promise<void> {
    // Fetch sessions and memories updated since lastSyncAt
    const since = this.lastSyncAt?.toISOString() ?? '1970-01-01T00:00:00Z';
    const [sessions, memories] = await Promise.all([
      fetch(`/api/sessions?since=${since}`).then(r => r.json()),
      fetch(`/api/memory/list?since=${since}`).then(r => r.json()),
    ]);

    // Upsert into local SQLite
    for (const s of sessions) {
      await this.db.execute(
        'INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?, ?)',
        [s.id, s.title, JSON.stringify(s.messages), s.updatedAt, new Date().toISOString()]
      );
    }
    this.lastSyncAt = new Date();
  }

  async pushToServer(): Promise<void> {
    // Find records modified locally since last sync
    const pending = await this.db.select(
      'SELECT * FROM sessions WHERE updated_at > synced_at'
    );
    for (const session of pending) {
      await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ messages: JSON.parse(session.messages) }),
      });
    }
  }
}
```

### 3. Conflict resolution

If the same session was modified both locally (offline) and on the server:
- For session messages: append local messages after server messages (no discard)
- For memory content: show a conflict dialog with diff view, user picks which version to keep
- For project metadata: server wins (local changes are overwritten)

### 4. Sync status indicator

In the desktop app title bar (next to the Scout chip), show sync status:
- "Synced" (green dot) when local cache matches server
- "Syncing..." (pulsing amber dot) during sync
- "Offline" (red dot) when server unreachable
- "Changes pending" (amber dot) when local changes exist not yet pushed

### 5. Background sync

Sync automatically every 5 minutes when online:
```typescript
setInterval(async () => {
  if (await offlineManager.detectOffline()) return;
  await syncService.pullFromServer();
  await syncService.pushToServer();
}, 5 * 60 * 1000);
```

Also sync on:
- App startup (if online)
- Coming back online (connectivity restored event)
- Manual "Sync now" button in settings

## Verification Checklist

- [ ] Pull sessions and memories on startup - they appear in offline cache
- [ ] Go offline (disable network adapter) - sessions still browsable from cache
- [ ] Create a new session offline - it saves to SQLite with pending sync flag
- [ ] Come back online - pending session uploads to server automatically
- [ ] Sync status indicator shows correct state during each phase

## Files to Create or Modify

- MODIFY `apps/desktop/src-tauri/Cargo.toml` - add tauri-plugin-sql
- MODIFY `apps/desktop/src-tauri/tauri.conf.json` - add sql plugin
- CREATE `apps/cloud/src/lib/sync.ts`
- MODIFY `apps/cloud/src/App.tsx` - init sync service on startup
- MODIFY `apps/cloud/src/components/StatusBar.tsx` - add sync status indicator
