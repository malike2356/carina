---
sidebar_position: 5
---

# Toolsets

Toolsets group tools into bundles (`terminal`, `file`, `web`, `browser`, `messaging`, etc.). Each gateway platform can enable a different subset.

```bash
carina tools                    # interactive menu
carina tools platform list
carina tools platform show telegram
carina tools platform set sms messaging,search
```

Config file: `~/.carina/toolsets.yaml`. Telegram and SMS use conservative presets by default; CLI and web get full tool access.

Developer details: [Toolset system](/docs/developer/tools/toolsets).
