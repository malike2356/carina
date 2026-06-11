# Carina Mobile completion prompts

Sequential Cursor/Claude prompts to finish `carinaMobile` for internal QA, device testing, and eventual store distribution.

**Working directory:** `/opt/lampp/htdocs/verlox/carina/carinaMobile`

**Live endpoints:**

- Carina Cloud: `https://app.carinaai.uk`
- Scout public trust: `https://console.labyrinthscout.com/api/public/trust`

**Backend references:** `core.carinaai.uk` (gateway + hosted auth), `console.labyrinthscout.com` (public trust API)

## Status

The mobile workspace is real and largely aligned with the current system. Treat it as ready for dogfooding and device QA, not as finished production distribution until Prompt 05 sign-off.

## How to run

1. Paste each prompt into Cursor in order.
2. After each prompt, validate:

```bash
cd /opt/lampp/htdocs/verlox/carina/carinaMobile
pnpm typecheck
pnpm test
```

3. Do not skip ahead if a prompt leaves failing tests or broken auth/session behavior.

## Prompt order

| # | File | Focus |
|---|---|---|
| 0 | [00-bootstrap-env.md](./00-bootstrap-env.md) | Env, EAS prerequisites, doc path fixes |
| 1 | [01-auth-session.md](./01-auth-session.md) | Auth, session id lifecycle, cloud vs self-hosted |
| 2 | [02-feature-parity.md](./02-feature-parity.md) | Tabs and screens match live backend contracts |
| 3 | [03-native-eas.md](./03-native-eas.md) | Push, voice, widget gating; EAS build path |
| 4 | [04-production-polish.md](./04-production-polish.md) | Loading, offline, errors, navigation polish |
| 5 | [05-device-qa.md](./05-device-qa.md) | Device QA matrix and P0/P1 fixes |
| 6 | [06-repo-docs.md](./06-repo-docs.md) | Optional: sync repo-root docs |

## Dependency graph

```
00-bootstrap-env
       |
01-auth-session
       |
02-feature-parity
       |
03-native-eas
       |
04-production-polish
       |
05-device-qa
       |
06-repo-docs (optional)
```

## Fast path (dogfooding)

If you need the quickest route to a usable internal build:

1. **01-auth-session** (session id timing, login base URL)
2. **02-feature-parity** (truthful screens)
3. **00-bootstrap-env** (reproducible builds)
4. **03-native-eas** (push/voice/widget gating)
5. **04-production-polish** then **05-device-qa** before calling it production-ready

## Product boundaries

- General-purpose agent by default.
- `property-uk` is excluded on mobile; it belongs to Propreneur (`src/config/product-boundaries.ts`).
- Do not add property workflows or pre-install vertical packs in these prompts.
