**Status: COMPLETED 2026-06-21**


# Gap 30 - Documentation: Model Providers, Sandbox & Security Enclosure

**Gap:** 30
**Sprint:** 2
**Type:** Documentation
**Source:** OpenClaw docs (Model providers, Custom providers, API key rotation, Sandboxing, Gateway security, Exposure runbook)
**Target dir:** `marketing/docs/docs.carinaai.uk/docs/`

**Goal:** Write documentation for model provider configuration, sandbox isolation,
  and gateway security hardening. Carina has providers, sandbox code, and
  security features but they are completely undocumented for users.

**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 4-5 h total

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Build Order

```
01-model-providers.md     Provider setup, key rotation, custom providers
02-sandbox-security.md     Sandbox configuration, gateway security, exposure
```

---

## Pages to write

1. `docs/user/configuration/model-providers.md` -- providers, key rotation, custom endpoints
2. `docs/user/security/sandbox-isolation.md` -- sandbox modes, Docker/SSH/OpenShell
3. `docs/user/security/gateway-hardening.md` -- exposure, TLS, auth, firewall

---

## Done When
- [ ] 3 new pages written with real commands
- [ ] Carina voice: "skill packs", "Scout", "Labyrinth", no competitor names
- [ ] Sidebar updated
- [ ] `pnpm build` passes
