# Labyrinth Scout

Labyrinth Scout was an optional, separately-operated control plane for production AI agents
(prompt injection detection, kill switch, real-time security dashboard, honeypots, anomaly
detection, tool policy, egress filtering). It is no longer offered as a product or hosted
anywhere - it has been re-scoped as a personal research project and is not available for
pairing, provisioning, or purchase.

If you previously configured `LABYRINTH_ENABLED`/`LABYRINTH_URL`/`LABYRINTH_API_KEY` in your
Carina `.env`, that integration point still exists in the codebase but has nothing live to
connect to - safe to leave disabled (`LABYRINTH_ENABLED=false` or unset).
