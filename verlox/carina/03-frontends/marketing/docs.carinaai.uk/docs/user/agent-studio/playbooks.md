# Agent Studio playbooks

Carina **Agent Studio > Playbooks** is the operator surface for visual automation playbooks. Authoring runs in **Keprix Visual Playbook Studio**; Carina keeps workspace chrome and proxies the catalog.

Do not confuse this with **Playbook** (`/playbook`), which is the hardware-aware local model catalog.

## How it fits together

```text
Carina workspace (/agent-studio/playbooks)
        |
        |  service list + handoff JWT
        v
Keprix Visual Playbook Studio (/playbooks/studio/{id})
        |
        |  compile + publish
        v
Keprix YAML playbook runtime (POST /api/playbook-runs/start)
```

| Layer | Owner | Carina role |
| --- | --- | --- |
| Visual editor | Keprix | Deep link or iframe handoff only |
| Playbook runtime | Keprix | Trigger via worker runner (prompt 05) |
| Workspace shell | Carina | Nav, list table, authenticated handoff |

Terminology: use **playbook** in operator copy. Avoid **workflow** (competitor term) and **cookbook** (internal only).

## Operator flow

1. Sign in to the Carina workspace.
2. Open **Playbooks** in the sidebar (`/agent-studio/playbooks`).
3. Click **New playbook** or **Edit in Studio** on a row.
4. Carina mints a short-lived handoff token and opens Keprix studio in a new tab.
5. Save in studio, then refresh the Carina list to see the updated row.

**Assign to worker** is enabled after the Aiva starter template prompt (KNIME adoption 02).

## Configuration (self-hosted / ops)

Set on the Carina core web gateway:

| Variable | Purpose |
| --- | --- |
| `KEPRIX_STUDIO_BASE_URL` | Keprix frontend origin for studio deep links |
| `KEPRIX_API_BASE_URL` | Keprix API origin for `GET /api/playbooks/studio` |
| `KEPRIX_SERVICE_TOKEN` | Server-side bearer token for catalog proxy |
| `KEPRIX_HANDOFF_SECRET` | Shared HMAC secret for 5-minute handoff JWTs (`aud: keprix-studio`) |

Keprix must implement prompt **233** (studio routes + `POST /api/auth/handoff/consume`) before handoff works end to end without a separate Keprix login.

## Security notes

- Handoff tokens are HTTPS-only, short-lived, and never logged.
- The browser calls Carina APIs; Carina uses the service token server-side for list calls.
- Rate limit: 10 handoff mints per user per minute.

## Related docs

- [Capability inventory](/docs/capabilities)
- Keprix planning reference: `keprix/planning/prompts/reference/233-visual-playbook-studio-architecture-reference.md`
