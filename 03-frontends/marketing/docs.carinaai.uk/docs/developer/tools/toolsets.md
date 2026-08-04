---
sidebar_position: 2
---

# Toolset system

Fifteen toolsets group 70+ tools: `terminal`, `file`, `web`, `browser`, `search`, `skills`, `sync`, `messaging`, `media`, `mcp`, `orchestration`, `debug`, `checkpoint`, `integrations`, `ensemble`.

Map definition: `src/tools/toolset.ts` (`TOOLSET_MAP`).

Config engine: `src/tools/toolset-config.ts` with per-platform presets (Telegram gets messaging + file; SMS is minimal; CLI gets all toolsets).

```bash
carina tools platform list
carina tools platform set telegram messaging,file,web,search
carina tools list discord
```

`CarinaAgent.getTools()` filters the registry using the active platform and `toolsets.yaml`.
