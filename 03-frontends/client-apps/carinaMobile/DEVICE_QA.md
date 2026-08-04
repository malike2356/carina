# Carina Mobile: device QA matrix

Manual verification gate before store release. Run against an EAS **preview** build on at least one physical device (iOS and/or Android). Emulator pass is recorded below; physical device still required for push/voice/widget.

**App path:** `carina/03-frontends/client-apps/carinaMobile`

## Prerequisites

- [x] EAS `preview` build installed (emulator `verlox_apps_emu` / `emulator-5554`)
- [x] `EXPO_PUBLIC_EAS_PROJECT_ID` set to a real Expo project (not `00000000-0000-4000-8000-000000000001`)
- [x] Carina Cloud account on `https://app.carinaai.uk` (disposable `deviceqa+…@carinaai.uk` for this pass)
- [ ] Optional: self-hosted gateway on LAN for the S* pass

## How to record results

Fill **Actual result** and **Pass/Fail** during device execution. Code-review notes from prompts 00-04 are pre-filled where automation covered the path; replace with device observations.

**Build under test (fill in):**

| Field | Value |
|---|---|
| Profile | preview |
| Platform | Android (emulator) |
| EAS build id | `f46e5c9f-a451-4f67-a3ee-91d1dda6f483` |
| Git commit | EAS snapshot `ffc9355a` (preview artifact); local fixes after QA: deep-link + error format |
| Date | 2026-07-12 |
| Screenshots | `_qa-screenshots/device-qa-2026-07-12/` |

**Automated pre-check (this pass):** `pnpm typecheck` clean; `pnpm test` **196 passed**.

---

## Cloud mode tests

| ID | Area | Steps | Expected result | Actual result | Pass/Fail |
|---|---|---|---|---|---|
| C01 | Onboarding | Fresh install -> More/onboarding -> Use Carina Cloud | Instance saved; login screen shown | Fresh install landed on cloud login / scan flow | Pass |
| C02 | Login | Enter invalid password; tap Sign in | Error message; stays on login; tabs not shown | "Invalid email or password"; stayed on login | Pass |
| C03 | Chat | Send a message on Chat tab | Streaming reply; tool strip updates if tools run | Message sent; reply bubble showed `Error: [object Object]`; badge "No keys" | Fail |
| C04 | Chat | Tap New; open Sessions drawer | New empty session; prior session still listed | Not exercised this pass | Blocked |
| C05 | Chat | Open Sessions; select older session | Messages restore from local storage | Not exercised this pass | Blocked |
| C06 | Chat | Send messages; force-quit app; relaunch | Active session id and messages persist | Not exercised this pass | Blocked |
| C07 | Chat | Type `/clear` in composer | Local messages cleared; server session cleared for client id | Not exercised this pass | Blocked |
| C08k | Chat (Android APK) | Focus composer; type with keyboard open | Composer stays fully visible above keyboard; typed text readable | Composer usable on emulator APK | Pass |
| C09m | Mini models (Android APK) | More → On-device mini LLMs; download; offline chat | Catalog lists models; offline answer | Entry visible on More; download not run this pass | Blocked |
| C08 | Trust | Open Trust tab | Public Scout score loads; metrics visible | Trust tab opened; metrics visible (`C08_trust.png`) | Pass |
| C09 | Trust | Open Trust (scout inactive vs active) | Kill switch panel disabled unless Scout active on account | Scout off on free account; no crash | Pass |
| C10 | Packs | Open Skill packs (cloud user) | Pack list loads; `property-uk` not shown | Skill packs screen opened (`C10_packs.png`) | Pass |
| C11 | Packs | Install then uninstall an allowed pack | Success feedback; list updates | Not exercised this pass | Blocked |
| C12 | Memory | Open Memory; edit one entry; delete another | List loads; edit saves; delete removes row | Memory browser opened (`C12b_memory.png`); edit/delete not run | Partial |
| C13 | Usage | Open Usage and billing | Quota/plan shown or honest empty state behind cloud gate | Trial, £1.00 credit, day allowance shown (`B01b_usage.png`) | Pass |
| C14 | Auth | More -> Sign out | Returns to login; no stale user on Trust after re-open | Sign out returned to cloud login | Pass |
| C15 | Push | Enable remote push; send chat; background app during stream | Push notification on device build with real EAS project id | Emulator cannot validate FCM delivery | Blocked |
| C16 | Scout | Enable Scout alerts; background app | No crash if Scout API unreachable; trust tab shows partial error | Scout inactive; Trust loaded without crash | Pass |
| A01 | Aiva foundation | Cloud sign-in; open Employees tab and More → Employees | Tab visible; smoke screen loads worker count or empty state | Employees tab visible; listed hired worker | Pass |
| A02 | Aiva foundation | Self-hosted connect; check tabs and More | Employees tab hidden; no Aiva More entry; no crash | Self-hosted connect not completed this pass | Blocked |
| A03 | Aiva foundation | Cloud session with bad/expired token on Employees | Friendly sign-in again; no redbox | Covered by C02 / auth errors; dedicated expire not forced | Partial |

---

## 01 foundation (Aiva parity series)

Manual checks for `carina-mobile-aiva-parity` prompt 01. Automated: `pnpm typecheck` and `pnpm test` (includes `aiva-client.test.ts` and cloud-features Aiva cases).

| ID | Steps | Expected | Pass/Fail |
|---|---|---|---|
| F01 | Sign in Carina Cloud | Employees tab appears between Chat and Tasks; More shows Aiva workspace → Employees | Pass |
| F02 | Open Employees | Loading then worker count / names or empty state; Refresh works | Pass |
| F03 | Self-hosted gateway | Employees tab absent; More has no Aiva block | Blocked |
| F04 | Force expired cloud token then open Employees | Sign in again CTA; no crash | Blocked |

## 02 Home and Employees list

| ID | Steps | Expected | Pass/Fail |
|---|---|---|---|
| H01 | Cloud login with zero employees | Home primary CTA is Hire; empty state hire path works | Blocked (account already had hired worker) |
| H02 | Cloud login with employees | Home CTA opens latest employee; plan/trial hint if present | Pass |
| H03 | Employees tab | List matches web worker count; pull-to-refresh works | Pass (1 worker: QA Receptionist) |
| H04 | Tap employee row | Detail loads by id without redbox | Pass |
| H05 | Hire form | Create employee via API; lands on detail | Partial (hired via API seed; in-app form not driven) |
| H06 | Airplane mode on Home/Employees | Error UI; Retry recovers when online | Blocked |

## 03 Employee detail overview

| ID | Steps | Expected | Pass/Fail |
|---|---|---|---|
| D01 | Open employee from list | Header with initials, name, status chip; usage glance | Pass |
| D02 | Pause then Resume | Status chip updates; matches web after refresh | Pass (confirm dialog → PAUSE → Resume) |
| D03 | Force pause API failure (offline mid-action) | Status rolls back; error message shown | Blocked |
| D04 | Edit name/role and save | Values persist after reload | Blocked |
| D05 | Connect channel button | Opens channels screen with list/connect flows | Pass |
| D06 | Kill network on open | Error + Retry recovers | Blocked |
| D07 | Layout | No clipped title; no horizontal scroll | Pass |

## 04 Channels connect

| ID | Steps | Expected | Pass/Fail |
|---|---|---|---|
| CH01 | Open Channels from employee | Lists connected + available mobile-supported types | Pass |
| CH02 | Connect Telegram with bot token | Success; appears in Connected; pull-to-refresh OK | Blocked (no bot token in this pass) |
| CH03 | Connect Email via inbound forwarding | Success without OAuth | Blocked |
| CH04 | Gmail OAuth (optional) | Browser opens; after return, Refresh shows connected or clear error | Blocked |
| CH05 | Disconnect a channel | Confirm; removed from Connected | Blocked |
| CH06 | Enable/Disable connected channel | Active flag toggles | Blocked |
| CH07 | Deep link `carina://employee/{id}/channels` | Opens channels screen | Pass on preview APK |
| CH08 | Social OAuth types (LinkedIn etc.) | Hidden from Connect list (not broken buttons) | Pass (list showed supported types only) |

OAuth note: Gmail/Outlook callbacks currently redirect to the web `/aiva/workers` page. After signing in, return to the app (scheme `carina`) and pull to refresh on Channels. Future work can add a mobile redirect URI.

## 05 Approvals inbox

| ID | Steps | Expected | Pass/Fail |
|---|---|---|---|
| I01 | Cloud login with pending email draft | Inbox tab shows badge; list shows type/subject/worker/age | Blocked (no pending drafts on disposable account) |
| I02 | Open detail; Approve | Draft sends; item leaves inbox; matches web | Blocked |
| I03 | Open detail; Reject (confirm) | Item leaves inbox; not sent | Blocked |
| I04 | Double-tap Approve | Only one request; no crash | Blocked |
| I05 | Empty inbox | "Nothing needs you" | Pass (empty Approvals state) |
| I06 | Deep link `carina://inbox` and `carina://approval/email/{id}` | Routes correctly | Partial (`carina://inbox` OK; approval id not available) |

Push deep-link follow-up: remote push payload routing to Inbox is not wired in this prompt; document when push templates include approval ids.

## 06 Billing, wallet, and limits

| ID | Steps | Expected | Pass/Fail |
|---|---|---|---|
| B01 | More → Usage and billing (trial workspace) | Aiva plan, trial days, wallet/credit if present | Pass (trial 30d, £1.00, allowances) |
| B02 | Soft wall workspace | BYOK / top-up / upgrade actions visible as applicable | Partial (Free BYOK shown; soft-wall actions not forced) |
| B03 | Manage billing | Portal opens in browser or controlled error | Blocked |
| B04 | Compare with web `/billing/aiva` | Limits/credit numbers match for same workspace | Blocked |
| B05 | App binary / source check | No new Stripe price IDs hardcoded; pack ids from API only | Pass (source review; no new price IDs) |

## 07 Automations and training

| ID | Steps | Expected | Pass/Fail |
|---|---|---|---|
| AT01 | Open Automations from employee (Team plan) | List shows name, schedule, enabled, last run | Pass (empty list + Create on trial account) |
| AT02 | Create daily Aiva prompt automation | Appears in list after save | Blocked |
| AT03 | Toggle Enable/Disable | Status flips; survives pull-to-refresh | Blocked |
| AT04 | Test run + History | History row appears with status | Blocked |
| AT05 | Non-Team account opens Automations | Upgrade CTA (not a 500); Usage link works | Fail / note: trial account showed Create UI instead of Team upgrade CTA |
| AT06 | Open Training; add FAQ; delete FAQ | List updates; empty state when none | Partial (Training screen opened; FAQ CRUD not run) |
| AT07 | Non-Business account opens Training | Business upgrade CTA or honest plan gate | Partial (screen opened; gate copy not asserted) |
| AT08 | Deep links `carina://employee/{id}/automations` and `.../training` | Open correct screens | Pass on preview APK |

## 08 Conversations, escalations, governance

| ID | Steps | Expected | Pass/Fail |
|---|---|---|---|
| EG01 | Inbox → Conversations segment | List matches web recent threads or empty state | Pass (empty state) |
| EG02 | Open a conversation | Read-only thread; clear read-only label; no reply composer | Blocked (no threads) |
| EG03 | Inbox → Escalations (Team) | Open escalations list or empty state | Pass (empty state via Inbox segment) |
| EG04 | Non-Team Escalations | Upgrade CTA (not a 500) | Partial (empty list shown; no hard 500) |
| EG05 | Tap escalation row | Opens employee overview | Blocked |
| EG06 | More → Governance | Scout status, monitored counts, kill awareness; Trust link works | Pass |
| EG07 | Deep links `carina://inbox/conversations`, `carina://inbox/escalations`, `carina://governance`, `carina://conversation/{id}` | Route correctly | Fail on preview APK: `carina://inbox/escalations` → Unmatched Route. Fixed in source via `app/+native-intent.ts` + `useDeepLinks` host/path join; needs new APK |
| EG08 | Smoke: Home → Employee → Channel → Approval → Billing | Still works after this prompt | Pass (Home → Employee → Channels → Billing path) |

Series note: prompts 01-08 automated gates are green (`pnpm typecheck` + `pnpm test`). Emulator DEVICE_QA executed 2026-07-12; open fails below must clear before store sign-off.

---

## Self-hosted mode tests

| ID | Area | Steps | Expected result | Actual result | Pass/Fail |
|---|---|---|---|---|---|
| S01 | Onboarding | Enter LAN gateway URL; optional API key; Test and connect | Connection test passes; lands on Chat tab | "Use a different gateway" reachable from login; LAN connect not completed | Blocked |
| S02 | Chat | Send message against self-hosted gateway | Streams reply using bearer key if configured | Not run | Blocked |
| S03 | Hosted screens | Open Memory, Packs, Usage from More or deep link | Disabled state with reason; no crash | Not run | Blocked |

---

## Native tests (preview/production build only)

| ID | Area | Steps | Expected result | Actual result | Pass/Fail |
|---|---|---|---|---|---|
| N01 | Voice | Tap Mic on Chat (device build) | Speech transcribed into composer | Mic visible on APK; speech not exercised on emulator | Blocked |
| N02 | Widget | Complete a chat task on Android build | Add Carina tasks widget; counts update | Not run on emulator | Blocked |

---

## Automated pre-check (run before device pass)

```bash
cd carina/03-frontends/client-apps/carinaMobile
pnpm typecheck
pnpm test
```

Last run: **196 tests passed** (2026-07-12 emulator DEVICE_QA; includes `format-unknown-error` + `native-intent` tests). Re-run after any fix before sign-off.

---

## Triage log

| ID | Severity | Issue | Resolution |
|---|---|---|---|
| C14 | P1 | Sign out did not always navigate away from tabs; Trust could fetch hosted Scout without signed-in user | Fixed earlier: `more/index.tsx` explicit login redirect; `useTrustDashboard` requires `user` for hosted Scout/kill switch. Emulator recheck: Pass |
| C03 | P0 | Chat stream shows `Error: [object Object]` on free/"No keys" account | Display hardened with `formatUnknownError` (source). Still need readable server error + BYOK/key path for a real assistant reply. Retest on next preview APK |
| EG07 | P1 | `carina://inbox/escalations` opened Expo Unmatched Route | Fixed in source: `app/+native-intent.ts` + `useDeepLinks` hostname/path join. Needs preview rebuild |
| AT05 | P2 | Trial/free account saw Automations Create UI instead of Team upgrade CTA | Product/gate check; confirm intended trial entitlement vs upgrade CTA |
| C15 | Blocker note | Cannot verify push without physical device + FCM/APNs credentials | Documented; see DEPLOY.md push setup |
| N01-N02 | Blocker note | Voice and widget require preview build on device | Documented under Known limitations until device pass |

Open P0 from this emulator pass: **C03** (chat error / no usable reply). Open P1: **EG07** until rebuilt APK verifies the deep-link fix.

---

## Known limitations (P2/P3)

| ID | Severity | Limitation |
|---|---|---|
| P2 | Scout status chip on Chat uses auth snapshot, not live trust poll | Acceptable for v1; Trust tab is canonical |
| P2 | iOS home screen widget not implemented | Android widget only |
| P2 | Expo Go cannot validate N01, N02, C15 | Use preview build for release QA |
| P3 | Deep link `carina://usage` opens screen; cloud gate shows disabled state for self-hosted | By design |
| P3 | Session drawer does not animate on tablet landscape | Functional; layout acceptable |
| P2 | Emulator is not a substitute for physical DEVICE_QA on push/voice/widget | Re-run blocked rows on a phone |

---

## Sign-off

- [ ] All P0 tests pass on device
- [ ] All P1 tests pass on device
- [x] Known limitations reviewed
- Tester: Auto (Maestro + adb on `verlox_apps_emu`)
- Build profile: preview
- Build id: `f46e5c9f-a451-4f67-a3ee-91d1dda6f483`
- Date: 2026-07-12
- Verdict: **Not signed off.** Emulator matrix largely green for Aiva navigation/billing/inbox empty states; block store release on C03 + EG07 retest after rebuild, then physical device for C15/N01/N02.

---

## Related docs

- [DEPLOY.md](./DEPLOY.md): EAS build, push credentials, preview profile
- [.env.example](./.env.example): required env vars
