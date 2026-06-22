# Prompt 03 - Custom Domains, Email, and Public Surfaces

## Objective

Let white-label customers use their own domains and sender identity on the existing hosted platform. This includes app routing, public pages, email identity, and TLS aware deploy behavior.

---

## Context

**Working areas:**

- `backends/servers/core.carinaai.uk/src/gateway/hosted-domain.ts`
- `backends/servers/core.carinaai.uk/src/hosted/plan-gates.ts`
- `backends/servers/core.carinaai.uk/src/hosted/tenant-workspace-config.ts`
- `backends/servers/core.carinaai.uk/src/hosted/usage-warning-email.ts`
- `backends/servers/core.carinaai.uk/packages/web/src/web-server.ts`
- `backends/servers/core.carinaai.uk/docker/nginx/`
- `backends/servers/core.carinaai.uk/docker/scripts/`
- `frontends/marketing/docs.carinaai.uk/`
- `frontends/marketing/carinaai.uk/`

The codebase already understands hosted versus private requests, app host names, and email sending. Extend those surfaces instead of adding one-off routes.

---

## Required Work

1. Add a custom domain model for hosted white-label tenants.
2. Support domain verification and canonical host resolution for branded workspaces.
3. Make email sender name, sender address, and footer branding configurable per tenant or reseller.
4. Update public-facing routes and marketing entry points so they can adopt customer branding where appropriate.
5. Update any host or proxy helpers needed to support customer domains in Docker and nginx.
6. Add smoke tests for domain resolution and sender identity.

---

## Key Files to Update

- `backends/servers/core.carinaai.uk/src/gateway/hosted-domain.ts`
- `backends/servers/core.carinaai.uk/src/hosted/tenant-workspace-config.ts`
- `backends/servers/core.carinaai.uk/src/hosted/usage-warning-email.ts`
- `backends/servers/core.carinaai.uk/src/hosted/plan-gates.ts`
- `backends/servers/core.carinaai.uk/packages/web/src/web-server.ts`
- `backends/servers/core.carinaai.uk/docker/nginx/carina-prod.conf`
- `frontends/marketing/docs.carinaai.uk/docusaurus.config.ts`

---

## Constraints

- Do not let customer domains weaken the canonical Carina control plane.
- Keep the default `carinaai.uk` and `app.carinaai.uk` paths working.
- Domain verification must be explicit, not implied.
- Email identity must never bleed across tenants.

---

## Done When

- a workspace can declare a custom domain
- the host resolver can serve the right brand and workspace context
- email identity reflects the customer or reseller configuration
- docs and public pages can explain the setup
- tests cover host matching and fallback to canonical domains

