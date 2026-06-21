# Gap 20 - Node System & Device Architecture

**Gap:** 20
**Sprint:** 2
**Source:** OpenClaw docs (nodes, Canvas, camera, screen recording, location)
**Goal:** Build a full node architecture where iOS, Android, macOS, and headless
  devices connect as peripheral nodes to the Carina Gateway. Nodes provide
  Canvas rendering, camera capture, screen recording, location services, and
  voice wake -- all coordinated through the gateway's WebSocket control plane.

**Primary agent:** Claude Code (server) / Cursor (React Native mobile)
**Estimated hours:** 12-16 h total (across prompts)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Context

Carina has basic node infrastructure:
- `infrastructure/node-host/ws-server.ts` -- WebSocket for remote nodes
- `infrastructure/device-pairing.ts` -- device pairing/tokens
- `api/pairing-routes.ts` -- pairing REST endpoints

But the node system is skeletal compared to OpenClaw's full architecture:
- No Canvas rendering host
- No camera capture bridge
- No screen recording
- No location.get commands
- No challenge nonce signing for device trust
- No node capabilities advertisement

---

## Build Order

```
01-node-protocol.md       Node WebSocket protocol, capability advertisement
02-canvas-host.md         Canvas rendering pipeline, A2UI host
03-camera-screen-location.md  Camera capture, screen recording, location services
04-device-trust.md        Challenge nonce signing v3, device attestation
```
