# 04: Onboarding first-five-minutes contract

**Status:** PENDING
**Priority:** P0
**Depends on:** 01, 02
**Unlocks:** 07, 09

## Goal

Every new Hire Aiva workspace gets a guaranteed first win in the first five minutes after signup, even before Tools are connected.

## Why

Salim's signup + worker naming was smooth; the cliff was first chat. Smooth marketing onboarding is worthless if chat fails.

## Files to change (expected)

- Onboarding completion / first worker provision paths under:
  - `carina/03-frontends/client-apps/app.carinaai.uk` (Hire Aiva cloud)
  - related Core worker provision if first message seeding lives there
- Optional: post-onboarding system message in the first employee thread
- Hire Aiva first-run checklist UI (lightweight, not a dashboard redesign)

## Requirements

1. Define a **First Five Minutes Contract** in product terms:
   - Minute 0-1: account + worker created
   - Minute 1-2: welcome employee message already in thread (no user message required) explaining top 3 things Aiva can do and that Calendar/Gmail need Tools connect
   - Minute 2-5: any user message yields either a successful answer or a guided connect path (from 01/02)
2. After onboarding_completed_at, seed one system/employee welcome into the default thread for the primary worker.
3. Welcome must use Hire Aiva URLs for Tools, not Carina developer jargon.
4. Prefer a safe demo action that needs no OAuth (e.g. create a Note/Document titled "Welcome checklist" OR list empty calendar guidance). No fake "I checked your calendar."
5. Telemetry: record `aiva_first_reply_ok` / `aiva_first_reply_blank` style event if events already exist nearby; else document the smallest audit hook.
6. Do not block signup on Google OAuth.

## Acceptance criteria

- [ ] Fresh trial signup → open worker chat → welcome already visible without user typing.
- [ ] Typing Salim's calendar ask → connect CTA (with 02).
- [ ] Typing "hi" → warm intro + 3 capabilities, never blank.
- [ ] Writing style scan clean for new copy.

## Deploy

Cloud app (`app.carinaai.uk` / admin.hireaiva) and Core if welcome is server-seeded.
