**Status: COMPLETED 2026-06-21**

**What was built:**
- `frontends/client-apps/carina-desktop/src/lib/offline/` (cache, merge, sync-service, types)
- `frontends/client-apps/carina-desktop/src/store/sync.ts`
- `frontends/client-apps/carina-desktop/src/hooks/use-offline-sync.ts`
- `frontends/client-apps/carina-desktop/src/components/layout/SyncStatusBar.tsx`
- Tauri SQLite plugin (`tauri-plugin-sql`, `@tauri-apps/plugin-sql`) with localStorage fallback in Vite dev
- Offline banner in `App.tsx`; sidebar sync indicator; Settings > About "Sync now"
- Message outbox queue for offline sends; pull from `/api/memory/sessions` and `/api/memory`

# Prompt 07: Offline Sync for Memory and Sessions

See original spec in `_superseded/04-desktop-app/05-offline-sync.md`.

## Done When (verified)

- Pull sessions and memories on startup when gateway is online
- Gateway down: cached sessions remain browsable (no full UI block)
- Offline session create and message queue with pending sync flags
- Reconnect triggers background sync (startup, 5 min interval, online event, manual)
- Sync status indicator: Synced / Syncing / Offline / Changes pending
