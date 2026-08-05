# 00: Overview and guardrails (never embarrass again)

**Status:** PENDING (reference; do not implement this file alone)
**Depends on:** none
**Unlocks:** 01-09

## Context for the agent

Hire Aiva is an AI-employee product on the Carina platform. Signup can look polished while the first chat fails. That destroys founder demos (IPN / Salim / investors).

Canonical split (do not renegotiate):

- Carina = shared platform runtime (agent loop, tools, memory, billing plumbing, deploy).
- Aiva = product surface (Hire Aiva branding, workers UI, pricing, onboarding).
- Reference: `shared/workspace-governance/CARINA-AIVA-SOFT-SEPARATION.md`
- Source boundary: only `carina/02-backends/`, `carina/03-frontends/`, `carina/scripts/`

## Failure modes this programme must close

1. Empty agent reply → hardcoded **"I am unable to respond right now."** on web.
2. Empty agent reply → fake greeting **"What would you like me to help with?"** on Telegram/web worker path.
3. User asks Calendar/Gmail/Drive with no grant or `needs_reauth` and gets silence/blank instead of connect CTA.
4. New workspace has no Tools grants and no guided first win.
5. Huge document HTML in list tools truncates vault titles (regression lock).
6. Demo guest eval missing (no golden "first message must succeed" suite).
7. Platform LLM default/env drift without clear OPS toggle (regression lock).

## Technical guardrails

1. Never create `carina/verlox/` nests. Run `bash scripts/guard-forbidden-carina-nests.sh` if unsure.
2. Writing style: no em dashes (U+2014), no en dashes (U+2013), no emojis in first-party copy.
3. Prefer fixing shared Core paths that Aiva already uses (`aiva-process-message`, `employee-comms`, product tools, sanitize) rather than forking a second agent OS.
4. Do not grant Aiva workers `shell-exec` to imitate personal Hermes bots.
5. Secrets stay in `/opt/lampp/htdocs/verlox/.access/` and VPS env. Never paste secrets into prompts, commits, or chat.
6. Stripe: never create new prices unless owner explicitly asks; use `.access/.stripe-credentials-and-price-id.md`.
7. Tests: Vitest for Core; feature smoke for Hire Aiva web/Telegram documented in 09.
8. Deploy: surgical `carina-web` patch or `deploy.sh` / compose recreate as needed; avoid accidental full nightmare rebuilds.

## Architecture target (first answer path)

```
User first message (web or Telegram)
  -> processAivaMessage / router
  -> if integration intent and grant missing/needs_reauth:
       conversational connect reply (Calendar/Gmail/Drive/Trello)
  -> else agent turn with tools
  -> sanitize user-facing reply
  -> if blank after sanitize:
       aivaEmptyReplyFallback(userMessage)  NEVER generic unable/greeting
  -> persist employee message / send channel
```

## Product copy principles for failure

Always say:

- what you could not do
- why (not connected / needs reconnect / temporary provider issue)
- exact next step (Tools URL / re-ask)

Never say:

- "I am unable to respond right now."
- "What would you like me to help with?" after a concrete ask
- fake tool success

## Out of scope

- Migrating Aiva to Keprix/Hermes.
- Rebuilding marketing demos unless a golden path needs them.
- Full redesign of Hire Aiva pricing pages.

## When finished with any later prompt

1. Run relevant Vitest.
2. Fix writing style on touched copy.
3. Deploy required services.
4. Tick parent README checkboxes.
5. Archive this folder under `02-archived_prompts/archives_from_pending_prompts/` when the whole set ships.
