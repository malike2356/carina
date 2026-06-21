---
sidebar_position: 1
---

# CLI overview

Entry point: `bin/carina.ts` dispatches to `src/cli/registry.ts` (44 commands).

```bash
carina                  # interactive chat (CLI gateway)
carina help             # grouped command list
carina doctor           # health checks
carina completion bash  # shell completion
```

Config lives in `~/.carina/`:

| File | Purpose |
|---|---|
| `.env` | API keys and secrets |
| `config.yaml` | Provider, model, Scout URL |
| `toolsets.yaml` | Per-platform tool toggles |
| `credentials.json` | API key pools and OAuth tokens |

Wizard: `carina setup` writes initial `.env`.
