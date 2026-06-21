# Gap 29 - Documentation: Operations, Health & Monitoring

**Gap:** 29
**Sprint:** 2
**Type:** Documentation
**Source:** OpenClaw docs (Health checks, Heartbeat, Doctor, Logging, OpenTelemetry, Prometheus, Diagnostics export, Troubleshooting)
**Target dir:** `marketing/docs/docs.carinaai.uk/docs/user/`

**Goal:** Write operations and health documentation. Carina has doctor, heartbeat,
  and check-in systems in source but zero documentation for operators.

**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 3-4 h total

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
01-doctor-health.md       Carina Doctor, health checks, heartbeat
02-logging-monitoring.md  Logging, diagnostics export, troubleshooting
```

---

## Pages to write

1. `docs/user/carina-ops/doctor-and-health.md` -- doctor, health checks, heartbeat
2. `docs/user/carina-ops/logging-and-monitoring.md` -- logs, diagnostics, troubleshooting

---

## Done When
- [ ] 2 new pages written
- [ ] Each page: real commands, real output examples
- [ ] Sidebar updated under "Carina Ops" category
- [ ] `pnpm build` passes
