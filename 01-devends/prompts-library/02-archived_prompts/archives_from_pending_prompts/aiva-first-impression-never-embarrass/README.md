# Aiva first impression: never embarrass again

**Prompt set:** 11 prompt files (00-10) plus this README
**Status: COMPLETED 2026-08-04**
**Created:** 2026-08-04
**Owner surface:** Hire Aiva / Carina (shared runtime; Aiva product paths)

## Problem statement

Live demos and real owners were embarrassed by blank or useless Aiva replies:

1. **Salim Miah** (`smiah5160@gmail.com`, workspace `25b0155f-...`, worker `Salim's VA`) signed up smoothly at 20:44 UTC on 2026-08-03. First web message at 20:46: "check my calender for hospital meetings". Reply stored: **"I am unable to respond right now."** Zero Tools grants. Empty `processAivaMessage` result hit the hardcoded fallback in `employee-comms.ts`.
2. **Selorm** (lordsesame) answered vault readiness correctly after the document-list fix, then returned **"What would you like me to help with?"** for a retrospective email ask because Gmail/Drive were `needs_reauth` and blank replies were replaced with a fake greeting.
3. Secondary ops failures (empty `public_website` → carinaai.uk 403; document list truncating huge HTML) compounded distrust that the platform works.

This is a **product first-five-minutes contract** problem, not a reason to kill Carina or move Aiva to Keprix.

## Definition of done (whole programme)

A brand-new Hire Aiva trial account can:

1. Complete signup in under 3 minutes.
2. Send any reasonable first message (hi, check calendar, find email, list docs) and get a **useful, non-blank** reply.
3. If Calendar/Gmail/Drive are missing or `needs_reauth`, get an explicit connect/reconnect CTA with Tools URL; never "unable to respond" / fake greeting.
4. Pass the golden demos in prompt 07 on web and Telegram.
5. Production smoke for Salim workspace retest and Selorm Gmail reconnect path is green.

## Progress

- [x] 00 overview
- [x] 01 never blank first reply
- [x] 02 conversational connect Calendar/Gmail/Drive
- [x] 03 tool grant honesty / reauth
- [x] 04 first-five-minutes contract
- [x] 05 documents list context-safety lock
- [x] 06 telegram/web empty-reply parity
- [x] 07 demo-guest eval harness
- [x] 08 platform LLM defaults OPS toggle
- [x] 09 production smoke and cutover (Salim make-good deferred; Selorm reconnect still founder)
- [x] 10 Google Sign-In testing users (UX shipped; Console Test users founder)

## Founder follow-ups (do not block archive)

1. Reconnect Selorm Gmail + Drive until `connected`.
2. Optional Salim courtesy: Cal connect + retest calendar ask.
3. Add Google OAuth Test users in project `verlox` (see prompt 10 list).

## Archived location

`carina/01-devends/prompts-library/02-archived_prompts/archives_from_pending_prompts/aiva-first-impression-never-embarrass/`
