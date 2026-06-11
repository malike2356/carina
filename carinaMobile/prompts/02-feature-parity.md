# Carina Mobile - Prompt 02: Feature parity for existing screens

## What you are building

Bring every implemented screen to a truthful, working state against the current live system. Mobile should be a real companion to Carina core and Scout, not a partial shell.

**Working directory:** `/opt/lampp/htdocs/verlox/carina/carinaMobile`

Do not add new product features. Only close gaps between existing mobile code and current backend behavior.

---

## Goal

- Each tab either works or is clearly disabled with an honest reason
- No broken paths or aspirational copy
- `property-uk` stays excluded on mobile

---

## Feature audit map

| Surface | Key files | Backend |
|---|---|---|
| Chat | `app/(tabs)/chat/index.tsx`, `useChatSession`, `useCarinaConfig`, `useConnectionStatus` | `/api/chat/stream`, `/api/providers`, `/api/config` |
| Tasks | `app/(tabs)/tasks/index.tsx`, `useTasks`, `task-store` | Local from chat activity |
| Trust | `app/(tabs)/trust/index.tsx`, `useTrustDashboard` | Public trust + hosted Scout proxy |
| More | `app/(tabs)/more/index.tsx` | Settings, links to memory/packs/usage/instance |
| Memory | `app/memory.tsx`, `useMemories`, `memory-client` | Hosted memory API |
| Packs | `app/packs.tsx`, `usePacks`, `packs-client` | `/api/hosted/context` + pack install |
| Usage | `app/usage.tsx`, `useBilling`, `billing-client` | Hosted billing if configured |
| Instance | `app/instance.tsx` | Gateway settings, connection test |

---

## Hooks and clients to review

```
carinaMobile/src/hooks/useTrustDashboard.ts
carinaMobile/src/hooks/usePacks.ts
carinaMobile/src/hooks/useBilling.ts
carinaMobile/src/hooks/useMemories.ts
carinaMobile/src/hooks/useTasks.ts
carinaMobile/src/hooks/useCarinaConfig.ts
carinaMobile/src/hooks/useConnectionStatus.ts
carinaMobile/src/hooks/useScoutAlertMonitor.ts
carinaMobile/src/api/scout-hosted.ts
carinaMobile/src/api/scout-trust.ts
carinaMobile/src/api/memory-client.ts
carinaMobile/src/api/packs-client.ts
carinaMobile/src/api/billing-client.ts
carinaMobile/src/components/KillSwitchPanel.tsx
```

---

## Tasks

### 1. Walk each screen against live API shapes

- Trust payload from `GET https://console.labyrinthscout.com/api/public/trust`
- Hosted context: user + installed packs
- Memory list/update/delete semantics
- Billing/usage when tier/quota endpoints exist
- Kill switch only when cloud user has `scoutActive`

### 2. Handle mode-specific behavior

| Feature | Cloud | Self-hosted |
|---|---|---|
| Remote push prefs | Available | Hidden or disabled |
| Hosted memory | Available | "Requires Carina Cloud" |
| Packs install | Available | Disabled with reason |
| Billing/usage | Available or honest empty | Disabled with reason |
| Kill switch | When scout active | Disabled with reason |
| Public trust feed | Works | Works |

Self-hosted must not crash on hosted-only screens.

### 3. Product boundaries

- Filter `property-uk` from pack lists via `filterMarketplacePacks` in `src/config/product-boundaries.ts`
- Copy must not imply property workflows on mobile

### 4. Error and empty states

Every screen needs:

- Loading spinner or skeleton
- Retry on failure
- Offline message where relevant
- No blank screens on trust, packs, memory, or usage

### 5. Connection health

- `ConnectionStatusChip` and `useConnectionStatus` reflect real gateway reachability
- Self-hosted LAN URL guidance stays accurate (no localhost on device)

### 6. Add or update tests

- Extend `src/config/product-boundaries.test.ts` if pack filtering changes
- Add adapters/normalizers tests if you introduce response shaping
- Trust theme helpers if touched (`src/lib/trust-theme.test.ts`)

---

## Acceptance criteria

- Each tab and stack screen works or shows a clear disabled state with reason
- No screen throws on missing hosted user or self-hosted mode
- `property-uk` never appears as installable
- Copy is operational, not marketing fluff
- `pnpm typecheck && pnpm test` pass

---

## Validation

```bash
cd /opt/lampp/htdocs/verlox/carina/carinaMobile
pnpm typecheck
pnpm test
```

Manual smoke:

1. Trust tab loads public score and events
2. Packs list loads; property-uk absent
3. Memory browser loads for cloud user
4. Self-hosted mode: hosted screens show disabled state, chat still works
