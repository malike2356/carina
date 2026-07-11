# Carina Mobile: device QA matrix

Manual verification gate before store release. Run against an EAS **preview** build on at least one physical device (iOS and/or Android).

**App path:** `carina/03-frontends/client-apps/carinaMobile`

## Prerequisites

- [ ] EAS `preview` build installed on a physical device
- [ ] `EXPO_PUBLIC_EAS_PROJECT_ID` set to a real Expo project (not `00000000-0000-4000-8000-000000000001`)
- [ ] Carina Cloud account on `https://app.carinaai.uk`
- [ ] Optional: self-hosted gateway on LAN for the S* pass

## How to record results

Fill **Actual result** and **Pass/Fail** during device execution. Code-review notes from prompts 00-04 are pre-filled where automation covered the path; replace with device observations.

**Build under test (fill in):**

| Field | Value |
|---|---|
| Profile | preview |
| Platform | iOS / Android |
| EAS build id | |
| Git commit | |
| Date | |

---

## Cloud mode tests

| ID | Area | Steps | Expected result | Actual result | Pass/Fail |
|---|---|---|---|---|---|
| C01 | Onboarding | Fresh install -> More/onboarding -> Use Carina Cloud | Instance saved; login screen shown | Code path: `onboarding.tsx` sets cloud URL and routes to login | |
| C02 | Login | Enter invalid password; tap Sign in | Error message; stays on login; tabs not shown | Code path: `hostedContext` check blocks tab entry on bad creds | |
| C03 | Chat | Send a message on Chat tab | Streaming reply; tool strip updates if tools run | Code path: SSE via `chat-stream.ts`; Vitest stream URL tests pass | |
| C04 | Chat | Tap New; open Sessions drawer | New empty session; prior session still listed | Code path: `rotateSessionId` + `upsertSessionMeta` on new chat | |
| C05 | Chat | Open Sessions; select older session | Messages restore from local storage | Code path: `switchSession` loads `chat-session` by id | |
| C06 | Chat | Send messages; force-quit app; relaunch | Active session id and messages persist | Code path: `instance-store` + `chat-session` AsyncStorage | |
| C07 | Chat | Type `/clear` in composer | Local messages cleared; server session cleared for client id | Code path: `clearSession(sessionId)` + local clear | |
| C08 | Chat (Android APK) | Focus composer; type with keyboard open | Composer stays fully visible above keyboard; typed text readable | Needs native rebuild (`adjustNothing` + pad by keyboard height). Expo Go alone is not enough to verify | |
| C09 | Mini models (Android APK) | More → On-device mini LLMs; download Llama or Qwen; enable local AI; go offline and chat | Catalog lists Llama 1B, Qwen 1.5B, Gemma 2B; selected model answers offline | Needs New Architecture + llama.rn linked. Older APKs unlinked llama.rn so load always failed | |
| C08 | Trust | Open Trust tab | Public Scout score loads; metrics visible | Code path: `fetchPublicTrust`; scout-trust Vitest passes | |
| C09 | Trust | Open Trust (scout inactive vs active) | Kill switch panel disabled unless Scout active on account | Code path: `canUseKillSwitch` gates panel | |
| C10 | Packs | Open Skill packs (cloud user) | Pack list loads; `property-uk` not shown | Code path: `filterMarketplacePacks`; unit test blocks install | |
| C11 | Packs | Install then uninstall an allowed pack | Success feedback; list updates | Code path: install/uninstall error handling in `usePacks` | |
| C12 | Memory | Open Memory; edit one entry; delete another | List loads; edit saves; delete removes row | Code path: `useMemories` with error handling | |
| C13 | Usage | Open Usage and billing | Quota/plan shown or honest empty state behind cloud gate | Code path: `CloudFeatureGate` + `useBilling` | |
| C14 | Auth | More -> Sign out | Returns to login; no stale user on Trust after re-open | Fixed: explicit `router.replace` to login; trust skips hosted fetch without user | |
| C15 | Push | Enable remote push; send chat; background app during stream | Push notification on device build with real EAS project id | Requires preview build + APNs/FCM credentials | |
| C16 | Scout | Enable Scout alerts; background app | No crash if Scout API unreachable; trust tab shows partial error | Code path: `useScoutAlertMonitor` swallows poll errors | |

---

## Self-hosted mode tests

| ID | Area | Steps | Expected result | Actual result | Pass/Fail |
|---|---|---|---|---|---|
| S01 | Onboarding | Enter LAN gateway URL; optional API key; Test and connect | Connection test passes; lands on Chat tab | Code path: `testGatewayConnection`; localhost rejected on device | |
| S02 | Chat | Send message against self-hosted gateway | Streams reply using bearer key if configured | Code path: `authFromInstance` omit cookies + optional bearer | |
| S03 | Hosted screens | Open Memory, Packs, Usage from More or deep link | Disabled state with reason; no crash | Code path: `CloudFeatureGate` on each screen | |

---

## Native tests (preview/production build only)

| ID | Area | Steps | Expected result | Actual result | Pass/Fail |
|---|---|---|---|---|---|
| N01 | Voice | Tap Mic on Chat (device build) | Speech transcribed into composer | Expo Go shows disabled Mic + reason; requires EAS build | |
| N02 | Widget | Complete a chat task on Android build | Add Carina tasks widget; counts update | Requires preview APK + manual widget add | |

---

## Automated pre-check (run before device pass)

```bash
cd carina/03-frontends/client-apps/carinaMobile
pnpm typecheck
pnpm test
```

Last run: **97 tests passed** (prompt 05 prep). Re-run after any fix before sign-off.

---

## Triage log

| ID | Severity | Issue | Resolution |
|---|---|---|---|
| C14 | P1 | Sign out did not always navigate away from tabs; Trust could fetch hosted Scout without signed-in user | Fixed: `more/index.tsx` explicit login redirect; `useTrustDashboard` requires `user` for hosted Scout/kill switch |
| C15 | Blocker note | Cannot verify push without physical device + FCM/APNs credentials | Documented; see DEPLOY.md push setup |
| N01-N02 | Blocker note | Voice and widget require preview build on device | Documented under Known limitations until device pass |

No open P0 issues from code review.

---

## Known limitations (P2/P3)

| ID | Severity | Limitation |
|---|---|---|
| P2 | Scout status chip on Chat uses auth snapshot, not live trust poll | Acceptable for v1; Trust tab is canonical |
| P2 | iOS home screen widget not implemented | Android widget only |
| P2 | Expo Go cannot validate N01, N02, C15 | Use preview build for release QA |
| P3 | Deep link `carina://usage` opens screen; cloud gate shows disabled state for self-hosted | By design |
| P3 | Session drawer does not animate on tablet landscape | Functional; layout acceptable |

---

## Sign-off

- [ ] All P0 tests pass on device
- [ ] All P1 tests pass on device
- [ ] Known limitations reviewed
- Tester:
- Build profile:
- Build id:
- Date:

---

## Related docs

- [DEPLOY.md](./DEPLOY.md): EAS build, push credentials, preview profile
- [.env.example](./.env.example): required env vars
