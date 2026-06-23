# Propreneur internal dogfood

Use Carina locally for Propreneur client support and reporting while keeping Propreneur time capped.

## Setup

```bash
cd core.carinaai.uk
export LABYRINTH_ENABLED=true
export ACTIVE_SKILL_PACKS=property-uk
export JIT_CREDENTIALS_ENABLED=true
export TOOL_SEQUENCE_GUARD_ENABLED=true
pnpm carina
```

## Support prompts (paste into Carina)

**Weekly client summary**

> Summarise open Propreneur tickets for {{client_name}}. List blockers, next actions, and anything needing human approval. Do not send email; output a draft only.

**Incident note after Scout alert**

> Read the latest Scout security events for this instance. Produce a one-paragraph client-safe incident summary and a separate internal technical appendix.

## Guardrails

- Keep `email-send` and `shell-exec` behind JIT confirmation
- Never paste API keys or `.env` contents into prompts
- Batch Propreneur support to Tue/Thu (operating rule; not enforced in code)
