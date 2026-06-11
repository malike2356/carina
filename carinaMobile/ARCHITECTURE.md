# Carina Mobile Architecture

Companion app for Carina Cloud and self-hosted gateways. General-purpose agent by default; vertical packs are opt-in marketplace items, not bundled defaults.

## Product boundaries

| Surface | Default agent mode | Property-UK pack |
|---|---|---|
| Carina mobile (`mobile/`) | General autonomous agent | Not offered; reserved for Propreneur |
| Propreneur assistant | Property operating intelligence | Built-in vertical |
| Carina Cloud web | General | Installable pack only |

Property-UK workflows, PropCalc, and landlord compliance templates live in Propreneur. The mobile app must never ship property-uk as a default onboarding path or pre-installed pack.

## Layer diagram

```
┌─────────────────────────────────────────────────────────────┐
│  app/ (Expo Router)                                         │
│  (auth) login, onboarding   |   (tabs) chat tasks trust more│
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  src/components   ScoutStatusChip, CarinaLogo, ScreenShell    │
│  src/hooks        useCarinaConfig, useChatStream              │
│  src/store        auth, instance (AsyncStorage)               │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  src/api                                                      │
│  carina-client    REST: health, config, providers, chat     │
│  chat-stream      SSE consumer for GET /api/chat/stream       │
│  scout-trust      GET public trust API (Labyrinth Scout)      │
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  app.carinaai.uk    self-hosted gateway   console.labyrinthscout.com
  /api/chat          same routes           /api/public/trust
  /app/auth          cookie or API key
```

## Navigation

Bottom tabs (Expo Router group `(tabs)`):

1. **Chat** - multi-session drawer, streaming replies, tool activity strip, slash commands
2. **Tasks** - running and completed autonomous jobs (Phase 2)
3. **Trust** - Scout risk score, event feed, kill switch (admin)
4. **More** - packs marketplace, memory, notifications, gateway settings (`/instance`)

Auth stack `(auth)` runs before tabs: connect instance, sign in (hosted), optional Scout pairing.

## Instance modes

| Mode | Base URL | Auth |
|---|---|---|
| Carina Cloud | `https://app.carinaai.uk` | Session cookie via `/app/auth/login` |
| Self-hosted | User-supplied LAN URL | API key in SecureStore (Bearer header) |

`src/store/instance-store.ts` persists mode and base URL in AsyncStorage.

## API contracts (existing backend)

Carina gateway (`core.carinaai.uk/src/gateway/web.ts`):

- `GET /api/health`
- `GET /api/config` - provider list
- `GET /api/providers`
- `POST /api/chat` - non-streaming
- `GET /api/chat/stream?message=&sessionId=` - SSE
- `POST /api/clear`
- `GET /api/hosted/context` - hosted user + installed packs

Hosted auth (`core.carinaai.uk/src/api/hosted-web.ts`):

- `POST /app/auth/login`
- `POST /app/auth/logout`
- `GET /app/auth/me`

Scout public trust (`console.labyrinthscout.com`):

- `GET /api/public/trust`

## Theming

Tokens in `src/theme/tokens.ts` mirror [carinaai.uk](https://carinaai.uk): ink background, teal actions, amber trust accents, Instrument Sans body, Cormorant reserved for marketing moments only.

## Build phases

| Phase | Scope |
|---|---|
| 0 (done) | Router shell, API client, theme, stores |
| 1 (done) | Chat streaming, tool strip, provider picker, slash command palette |
| 2 (done) | Tasks tab from chat activity |
| 3 (done) | Trust tab live data, event feed, kill switch (Carina Cloud Scout proxy) |
| 4 (done) | Local notifications when tasks complete in background |
| 5 (done) | Memory browser, skill packs, offline queue, biometric lock |
| 6 (done) | Session drawer, memory edit, stack back navigation |
| 7 (done) | Remote push (EAS), Scout alerts, session pin/rename, production builds |
| 8 (done) | Self-hosted API key, gateway settings, connection health, task-to-chat deep links |
| 9 (done) | Session share/export, usage billing, haptics/a11y, Android widget, voice input |

## Commands

```bash
cd mobile
pnpm install
pnpm start          # Expo dev server
pnpm typecheck
pnpm test
```

## Directory map

```
mobile/
├── app/                 Expo Router screens
│   ├── (auth)/          Login + onboarding
│   └── (tabs)/          Main tab navigator
├── src/
│   ├── api/             HTTP + SSE clients
│   ├── components/      Shared UI
│   ├── config/          Defaults + product boundaries
│   ├── hooks/           Data hooks
│   ├── store/           Auth + instance persistence
│   └── theme/           Design tokens
├── ARCHITECTURE.md
└── package.json
```
