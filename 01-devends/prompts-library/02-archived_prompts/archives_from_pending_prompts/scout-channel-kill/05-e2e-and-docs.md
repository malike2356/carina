# Scout Channel Kill -- Prompt 05 of 05: E2E + Docs + Sales Gate
# Depends on: 01-03 minimum (04 if WA enabled)
# Estimated time: 2-3 hours

## Task

### 1. Script

`scout/scripts/e2e-channel-kill.sh`:

- Create org user + link row directly in DB (or API) for a fake telegram user id
- Simulate webhook payload for `/kill` + confirm callback
- Assert agents suspended + audit row + `/v1` filter 403
- Simulate `/resume` with confirm path (or dashboard resume)

### 2. Docs

Update:

- `scout/docs/CLIENT-INTEGRATION.md` with "Emergency halt from Telegram" section
- `scout/README.md` link to CHANNEL-KILL-SWITCH-DESIGN.md
- `scout/docs/SALES-CLAIMS.md` noting channel-based kill is **allowed only when** trusted-channel e2e is green in staging/prod
- `shared/security-assurance/programme/baseline/CHANNEL-EMERGENCY-CONTROL.md` as the shared control note
- `carina/01-devends/planning/operations/SCOUT_CHANNEL_CONTROL_PROMPT_PACK.md` as the build prompt reference

### 3. Env examples

Document in `.env.production.example`:

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
SCOUT_INTERNAL_CONTROL_KEY=
# WHATSAPP_* when enabled
```

## Acceptance Criteria

- e2e script passes locally against engine
- Docs match shipped commands
- No claim of WhatsApp until prompt 04 done and flagged on
- Docs reference the shared control note
- Pending folder archived after this prompt

## Post-build (MANDATORY)

1. Mark 01-05 COMPLETED with What was built  
2. Move `scout-channel-kill/` to `02-archived_prompts/archives_from_pending_prompts/scout-channel-kill/`  
3. Update `01-pending_prompts/README.md`
