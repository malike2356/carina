# 10: Google Sign-In testing users (Hire Aiva OAuth consent)

**Status: COMPLETED 2026-08-04**
**Priority:** P0 for demos
**Depends on:** 00
**Related incidents:** Jak Miah / Aiva Jakstar; Google `Error 403: access_denied` "hireaiva.co.uk has not completed the Google verification process"

## What was built

- Login UX: Hire Aiva sign-in shows invite-only Google guidance; `error=access_denied` (and related query params) surfaces an explicit email-login banner (`login/page.tsx`).
- Ops checklist below remains the Google Console procedure (founder/operator must list Test users).

## Goal

Any demo guest or Miah-family account can complete Sign in with Google on Hire Aiva without `access_denied` while the OAuth app remains in Testing.

## Context

Google OAuth consent for the company client (project `verlox`) is still **Testing**. Only emails listed under **Test users** can sign in. Unlisted accounts (e.g. `admin@salesgridai.com`) see:

> Access blocked: hireaiva.co.uk has not completed the Google verification process  
> Error 403: access_denied

Code cannot fully fix this. Google Cloud Console must list testers, or the app must be published / verified.

## Operator steps (Google Cloud Console)

1. Open [Google Cloud Console](https://console.cloud.google.com/) project `verlox` (number `420319712907`).
2. APIs & Services > OAuth consent screen.
3. Confirm Publishing status is **Testing** (or start verification if going public).
4. Under **Test users**, add:
   - `jmiah2012@gmail.com` (Jak Miah / Aiva Jakstar)
   - `smiah5160@gmail.com` (Salim)
   - `admin@salesgridai.com` (blocked in screenshot; add if that person must use Google)
   - `lordsesame@gmail.com` (founder)
   - any other demo guest Gmail for the week
5. Save. Wait 1-5 minutes. Ask the guest to retry Sign in with Google (incognito if cached).
6. Longer term: submit OAuth verification / publish to Production when ready for open signup via Google.

## Product interim UX

If Google Sign-In fails with access_denied, Hire Aiva login page shows a human banner: Google Sign-In is on invite list while we finish verification; use email login or ask the host to add your Gmail as a tester.

## Message to guest (copy)

See founder chat; keep this prompt as the ops checklist.

## Acceptance

- [x] Product UX when Google is blocked points to email login / invite list
- [ ] Listed testers can complete Google Sign-In on `admin.hireaiva.co.uk` / `app.carinaai.uk` (founder Console action)
- [x] Unlisted Gmail still denied (expected until publish)
- [x] Email/password path remains available for existing accounts
