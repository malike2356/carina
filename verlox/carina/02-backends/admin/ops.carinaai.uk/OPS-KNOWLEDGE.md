# Ops Assistant Knowledge Base

This file is read by the Ops Assistant at request time. Add any knowledge here and the assistant will immediately know it - no restart required.

## How to update

Just edit this file. The assistant reads it fresh on every chat message. You can add:
- New feature descriptions
- Configuration guides
- Troubleshooting tips
- Architecture notes
- Business logic explanations

---

## Platform Overview

ops.carinaai.uk is the VERLOX internal operations panel. It provides:
- Tenant/workspace management for Aiva (AI employee platform)
- Security monitoring via Labyrinth Scout integration
- Billing, pricing, and usage control
- Server management (Docker containers, logs, file editing)
- AI engine configuration (models, tools, deployments)

## Recent Changes

(Add notes here when features ship)

- 2026-07-16: Trust score mitigation: WAV and base risk queries now exclude acknowledged/mitigated events. Operators can review and acknowledge resolved security events to keep the trust score accurate. Score dropped from 59 (Elevated) to 14 (Low risk).
- 2026-07-16: Added Ops Assistant (floating chat, bottom-right). Powered by DeepSeek.
- 2026-07-16: Redesigned Google OAuth, Human Assist Bridge, and Agent Tools pages.
- 2026-07-16: Added monthly/annual pricing toggle to hireaiva.co.uk.
- 2026-07-15: Added AI Usage page with nav link in Fleet group.
- 2026-07-15: Billing Config page reorganized with sub-section headings.

## Page-Specific Guidance

### Billing Config (/billing-config)
- Grouped by product (Aiva, Scout, etc.)
- Sub-sections: "Usage controls" (trial credits, daily caps, soft wall), "Subscription price IDs" (Stripe IDs), "Prepaid top-up prices"
- Trial credits default: 100 credits. Daily cap: 50 messages. Soft wall shows upgrade prompt.
- Price IDs come from Stripe dashboard - do not invent new ones.

### Google OAuth (/google-oauth)
- 3-step wizard: Create client in Google Cloud Console, add redirect URIs, enter credentials.
- Status chip shows "Connected" (green) or "Not configured" (gray).
- Redirect URIs are auto-generated from the system's known domains.

### Human Assist Bridge (/human-assist-bridge)
- Routes Aiva user escalation requests to the VA inbox at verlox.uk/mis.
- Needs: bridge enabled, bridge token set, MIS base URL configured.
- Delivery modes: push+poll (recommended), push only, poll only.
- The bridge token must match what MIS stores for authentication.

### Agent Tools (/admin/agent-tools)
- Card grid showing each tool category with on/off status.
- Per-category settings: enabled, requires approval, max calls per message, timeout.
- Tenant overrides: enter workspace ID to customize per-tenant.
- Recent tool call log at the bottom.

### AI Usage (/ai-usage)
- Shows provider cost, BYOK separation, cache savings, margin health.
- Filter by 7/30/90 days.
- Tables break down by provider, tier, and tenant.
- Pricing controls section lets you adjust per-token costs.

### Scout (/scout)
- Live SSE event stream from Scout engine.
- Metrics: score (0-100), critical/warning/info/breach counts (24h).
- Instance management: kill or resume agent instances.
- Self-Mod panel: approve/reject pending runtime tools.
- Requires Scout engine to be running and paired.
- Trust score management: Acknowledge resolved security events in the Scout database to reduce the risk score. Events like blocked injection attempts, test alerts, and transient failures should be acknowledged after review.
- Score formula: WAV = 10 + unack_incidents*15 + unack_breach*20 + min(20, injection*2) + min(10, egress). WV = 15 + tx penalties + suspicious*20. Unified = round((WAV+WV)/2).
- Quick check: `curl -s https://console.labyrinthscout.com/api/public/trust | jq '{risk_score, risk_tier_label}'`

### Server (/server)
- File Browser (/server/files): Monaco editor, path-safe sandbox, read/write files on VPS.
- Services (/server/services): Docker containers + systemd. Restart capability.
- Logs (/server/logs): Live tail via SSE. Select log file from discovered list.

### Channels (/channels)
- Shows all gateway adapters: email, WhatsApp, web, Slack, etc.
- States: connected (green), configured (cyan), partial (amber), error (red), disabled (gray).
- Requires core.carinaai.uk to be reachable.

## Architecture Notes

### Docker Setup
- Container: corecarinaaiuk-carina-ops-1
- Runs on VPS: 80.190.81.208
- Internal port: 4001 (production), 4000 (dev)
- Compiled from TypeScript to dist/ before running
- EJS views are read from /app/views/ at runtime (can be hot-swapped)

### Communication
- Ops talks to Core via CARINA_API_URL (usually http://carina-web:6600 inside Docker)
- Ops talks to Scout via SCOUT_BASE and SCOUT_CONSOLE_BASE
- Auth token: CARINA_WEB_PASSWORD or auto-paired from core.env mount

### Database
- PostgreSQL shared with other services
- Tables: billing_config, ai_platform_*, tenants, agent_tool_categories, etc.
- Query helper in lib/db.ts

## Troubleshooting

### "Scout offline" in sidebar
- Scout engine container may not be running. Check /server/services.
- Or SCOUT_BASE env var is wrong. Check /settings.

### Billing config not saving
- Check database connection. Look at container logs.
- Verify the billing_config table exists (auto-created on startup).

### Cannot pair with Core
- Ensure CARINA_OPS_TOKEN or CARINA_WEB_PASSWORD is set.
- If running in Docker, CARINA_API_URL should point to the internal hostname.

### File browser shows "No allowed roots"
- Set CARINA_SERVER_FS_ROOTS env var with comma-separated paths.
