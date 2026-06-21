# Carina Ops -- VERLOX Internal Admin Panel

Private back office for managing Carina tenants, subscriptions, security, skills, and RAG corpus. Never customer-facing.

## 7 Pillars of Engineering

1. **Security first** -- Security is not a feature. It is the foundation every decision sits on.
2. **AI powered from foundation** -- AI is woven into the architecture from inception, not stitched on after the fact.
3. **No emojis, no fluff, direct but warm** -- Speak like a human. Clear, concise, professional. No filler.
4. **No em-dashes, no en-dashes, no AI typography** -- If a human wouldn't type it, neither should the output. Plain ASCII, natural cadence, no machine artefacts.
5. **Cause no risk to data, information, assets, or finance** -- What people entrust to us must never be harmed. No data loss, no financial damage, no compromised assets.
6. **Ethical, within the bounds of human ethics** -- Build in a way that is natural, sustainable, and protective of well-being. Technology serves people, not the other way around.
7. **Compliance with law and regulation** -- Know the jurisdiction. Follow the law. Whether local or global, operate within the legal framework of the geography you serve.
## Run

```
cd ops.carinaai.uk
pnpm dev      # Development on port 4000
pnpm build    # Compile TypeScript
```

## Deploy

See `carina/scripts/deploy-carina.sh`.

**Agent docs:** `docs/OPS-USER-MANAGEMENT.md` (auth map, `/users`, `/tenants`, `/scout/accounts`, ops + Scout deploy quirks). Production uses `docker/Dockerfile.runtime`; run `pnpm build` before rebuilding `carina-ops`.
