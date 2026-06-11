# Carina Mobile - Prompt 05: Device QA matrix and release checklist

## What you are building

A device QA checklist, execution of that checklist on a preview build, and fixes for any P0/P1 issues found.

**Working directory:** `/opt/lampp/htdocs/verlox/carina/carinaMobile`

This prompt is the gate before treating mobile as production-distributable.

---

## Goal

- Document required verification flows
- Fix P0/P1 bugs discovered during QA
- Leave P2/P3 limitations explicit in the checklist doc

---

## Prerequisites

- EAS `preview` build installed on physical iOS and/or Android device
- `EXPO_PUBLIC_EAS_PROJECT_ID` set to a real Expo project (not placeholder)
- Carina Cloud account on `https://app.carinaai.uk`
- Optional: self-hosted gateway on LAN for second test pass

---

## Task 1: Create `DEVICE_QA.md`

Create `carinaMobile/DEVICE_QA.md` with a manual test matrix.

Each row: **ID**, **Steps**, **Expected result**, **Actual result** (blank for tester), **Pass/Fail**.

### Cloud mode tests

| ID | Area | Summary |
|---|---|---|
| C01 | Onboarding | Carina Cloud -> login with valid credentials |
| C02 | Login | Bad password shows error; does not enter tabs |
| C03 | Chat | Send message; streaming reply; tool strip updates |
| C04 | Chat | New chat; prior session remains in drawer |
| C05 | Chat | Switch session in drawer; messages restore from local storage |
| C06 | Chat | App kill and relaunch; active session and messages persist |
| C07 | Chat | `/clear` clears local and server session memory |
| C08 | Trust | Public score and events load from Scout |
| C09 | Trust | Kill switch visible only when scout active |
| C10 | Packs | List loads; property-uk not shown |
| C11 | Packs | Install/uninstall if marketplace allows |
| C12 | Memory | List, edit, delete |
| C13 | Usage | Shows quota or honest empty state |
| C14 | Auth | Sign out returns to login |
| C15 | Push | Remote push on device build; notification after backgrounded stream |
| C16 | Scout | Scout alerts enabled; no crash when Scout unreachable |

### Self-hosted mode tests

| ID | Area | Summary |
|---|---|---|
| S01 | Onboarding | LAN URL + optional API key; connection test passes |
| S02 | Chat | Streams against self-hosted gateway |
| S03 | Hosted screens | Memory/packs/billing show disabled state, not errors |

### Native tests (device build only)

| ID | Area | Summary |
|---|---|---|
| N01 | Voice | Transcribes into composer |
| N02 | Widget | Android widget shows task counts after chat activity |

---

## Task 2: Execute checklist

Run the matrix against a `preview` build on at least one physical device.

Record actual results in `DEVICE_QA.md`.

---

## Task 3: Triage and fix

| Severity | Definition | Action |
|---|---|---|
| P0 | Crash, data loss, cannot log in, chat broken | Fix in this prompt |
| P1 | Wrong auth state, session corruption, blank screen | Fix in this prompt |
| P2 | Copy, layout, non-blocking UX | Document under Known limitations |
| P3 | Nice-to-have | Document under Known limitations |

---

## Task 4: Sign-off section

Add to `DEVICE_QA.md`:

```markdown
## Sign-off

- [ ] All P0 tests pass
- [ ] All P1 tests pass
- [ ] Known limitations reviewed
- Tester:
- Build profile:
- Build id:
- Date:
```

---

## Acceptance criteria

- `DEVICE_QA.md` exists with full matrix
- All P0/P1 issues found during QA are fixed or have an explicit blocker note
- `pnpm typecheck && pnpm test` pass
- Remaining limitations are documented, not hidden

---

## Validation

```bash
cd /opt/lampp/htdocs/verlox/carina/carinaMobile
pnpm typecheck
pnpm test
```

After QA execution, link `DEVICE_QA.md` from `DEPLOY.md` under a "Before store release" heading.
