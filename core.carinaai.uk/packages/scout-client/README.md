# @verlox/carina-scout

MIT-licensed client SDK for [Labyrinth Scout](https://labyrinthscout.com). Carina uses this package to report sanitized telemetry (tool calls, security events, heartbeats) to a Scout server.

This package does **not** include the Scout server. Deploy Scout separately from `console.labyrinthscout.com` (commercial Docker image) or use Carina Cloud pairing.

## Install

```bash
npm install @verlox/carina-core @verlox/carina-scout
```

## Enable

```bash
export LABYRINTH_ENABLED=true
export LABYRINTH_URL=https://your-scout-server.example
export LABYRINTH_API_KEY=your-key
carina scout status
```

## Boundaries

See `docs/kernel/COMMERCIAL_BOUNDARIES.md` in `@verlox/carina-core` for the full product boundary matrix.
