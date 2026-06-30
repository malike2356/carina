# Aiva Cyber Toolset Cleanup

**Status: PENDING**

**Decision date:** 2026-06-30

**Decision:** Active and offensive cyber tools are removed from Carina Aiva. They belong
exclusively in Petraclus (the standalone AI-native cyber operations platform). Aiva retains
only defensive and compliance-oriented security features: enterprise SOC, SIEM at scale,
org compliance reporting, and defensive monitoring.

This prompt documents exactly what to change in the Aiva codebase. No new features are
added. This is a surgical removal.

---

## Background

Aiva shipped a cyber tools module on 2026-06-26 (`feat-001-cyber-tools-api-backend.md`):
- `02-backends/core.carinaai.uk/src/tools/cyber-tools-registry.ts` - 77 tools across 11 phases
- `02-backends/core.carinaai.uk/src/api/cyber-tools-api.ts` - `GET /api/tools/cyber` and `GET /api/tools/cyber/health`
- `02-backends/core.carinaai.uk/packages/web/src/web-server.ts` - router mount at `/api/tools`
- `03-frontends/client-apps/app.carinaai.uk` - `/security/tools` cheatsheet page

The 11 phases in the registry are:
`reconnaissance`, `vulnerability_scanning`, `exploitation`, `web_app_testing`, `wireless`,
`forensics`, `traffic_analysis`, `privacy`, `reverse_engineering`, `blue_team`, `reporting`

---

## What Gets Removed

Remove all tools whose category is one of the following:

| Category | Reason |
| --- | --- |
| `reconnaissance` | Active OSINT. Belongs in Petraclus. |
| `vulnerability_scanning` | Active scanning. Belongs in Petraclus. |
| `exploitation` | Offensive. Belongs in Petraclus. |
| `web_app_testing` | Active exploitation. Belongs in Petraclus. |
| `wireless` | Offensive. Belongs in Petraclus. |
| `forensics` | Engagement-oriented. Belongs in Petraclus. |
| `traffic_analysis` | Active capture. Belongs in Petraclus. |
| `reverse_engineering` | Engagement-oriented. Belongs in Petraclus. |

## What Stays

Keep only tools whose category is one of:

| Category | Reason |
| --- | --- |
| `blue_team` | Defensive monitoring, alert triage, SOC workflows. Core Aiva feature. |
| `reporting` | Compliance and security report generation. Core Aiva feature. |
| `privacy` | Defensive privacy posture tools (audit, not attack). Keep only truly defensive ones. For any tool in `privacy` that routes traffic through Tor or runs ProxyChains: remove it. Those belong in Petraclus. |

---

## File Changes

### 1. `src/tools/cyber-tools-registry.ts`

Filter the `CYBER_TOOLS` array to remove all entries where `category` is in the removed
list above. Do not delete the file. The remaining entries (blue_team, reporting, defensive
privacy) stay.

After filtering, rename the export from `CYBER_TOOLS` to `AIVA_SECURITY_TOOLS` for
clarity. Update all import sites.

Add a comment at the top of the file:
```typescript
// Aiva security tools - defensive and compliance only.
// Active/offensive tools (recon, vuln scan, exploit, wireless, forensics,
// traffic capture, reverse engineering) are in Petraclus.
```

### 2. `src/api/cyber-tools-api.ts`

Update references from `CYBER_TOOLS` to `AIVA_SECURITY_TOOLS`.

Rename the route paths to reflect the narrower scope:
- `GET /api/tools/cyber` becomes `GET /api/tools/security`
- `GET /api/tools/cyber/health` becomes `GET /api/tools/security/health`

Rename the router export from `cyberToolsApiRouter` to `securityToolsApiRouter`.

### 3. `packages/web/src/web-server.ts`

Update the import and mount:
```typescript
// Remove:
import { cyberToolsApiRouter } from '../../src/api/cyber-tools-api.js';
app.use('/api/tools', cyberToolsApiRouter);

// Add:
import { securityToolsApiRouter } from '../../src/api/cyber-tools-api.js';
app.use('/api/tools', securityToolsApiRouter);
```

The mount path `/api/tools` stays the same. Only the router variable name changes.

### 4. `03-frontends/client-apps/app.carinaai.uk`

The `/security/tools` cheatsheet page currently shows all 77 tools including offensive ones.

Update it to:
- Rename the page title from "Security Tools" to "Security Monitoring Tools".
- Remove any tool cards whose category is in the removed list.
- If the filtered list is 5 tools or fewer, replace the cheatsheet with a simple text
  section: "Aiva's security features cover enterprise SOC, SIEM alerting, and compliance
  reporting. For active security testing, see Petraclus."
- The stub file `src/lib/cyber-tools-stub.generated.ts` (regenerated via
  `pnpm cyber-tools:sync`) must be regenerated after the registry change.

---

## What Aiva Keeps in Security

The defensive security features that stay in Aiva are:

**Enterprise SOC (multi-tenant):**
- Multi-customer SIEM dashboards with tenant isolation.
- Alert routing per tenant, role-based access, SLA tracking.
- Managed detection and response (analyst dispatch, automated containment).

**Enterprise SIEM at scale:**
- Horizontal log ingestion across multiple node deployments.
- Cold storage tiering, long-retention compliance logs.
- Cross-tenant correlation (when permitted by data isolation policy).

**Org compliance reporting:**
- SOC2 Type II readiness evidence collection.
- ISO 27001:2022 Annex A control mapping.
- GDPR Article compliance reporting for enterprise customers.
- PCI DSS evidence export.

These features are the correct home for enterprise security at scale. They are not in
Petraclus (which is single-operator, engagement-oriented) and not in Mutant (which is
self-hosted community edition). They are Aiva-only.

---

## Stub Update for Mutant and Petraclus

Mutant's stub responses (Prompt 29, Governance Prompt 30) reference:
```
"upgrade_url": "https://carinaai.uk/upgrade"
```

That URL should point to an Aiva page that mentions enterprise SOC and org compliance
as the specific features the user is upgrading for. Confirm that `carinaai.uk/upgrade`
routes to the correct Aiva marketing or pricing page after this cleanup.

---

## Acceptance Criteria

- `CYBER_TOOLS` is removed from `cyber-tools-registry.ts`. The export is now `AIVA_SECURITY_TOOLS`.
- `GET /api/tools/security` returns only `blue_team` and `reporting` tools (and defensive `privacy` tools).
- `GET /api/tools/cyber` returns 404 (old path removed or redirected).
- TypeScript compiles cleanly: `pnpm build` passes in `core.carinaai.uk`.
- The stub file in `app.carinaai.uk` is regenerated from the filtered registry.
- The `/security/tools` page shows only defensive tools (or the replacement text if the list is short).
- A search for `exploitation` or `wireless_injection` in `cyber-tools-registry.ts` returns no results.
- No tool in the registry has a `category` in the removed list.
