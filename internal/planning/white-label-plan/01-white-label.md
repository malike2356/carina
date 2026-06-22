# White-Label Carina Plan

## Objective

Turn Carina into a product that agencies, consultancies, and niche operators can resell under
their own brand while keeping Carina as the underlying agent platform.

The goal is not cosmetic rebranding. The goal is a repeatable commercial product that lets a
customer launch their own AI agent business with:

- their domain
- their brand
- their workflows
- their data boundaries
- their billing
- their support model

Carina stays the engine. The customer owns the business front end.

---

## Strategic Direction

The right white-label boundary is the control plane and presentation layer, not the core
agent kernel.

Keep Carina opinionated in the parts that create reliability:

- memory
- routing
- tools
- skills or packs
- audit trails
- deploys
- tenant isolation

Expose white-label control in the parts that create commercial flexibility:

- brand identity
- tenant naming
- domain and email
- login and onboarding screens
- product labels
- docs and help pages
- billing and plan names
- marketplace or pack store

This gives partners a real product they can sell without taking on kernel complexity.

---

## Product Model

### 1. Core Kernel

This is the Carina engine.

Responsibilities:

- model routing
- memory and session state
- tools and permissions
- workflow execution
- Scout security hooks
- Docker and deployment primitives
- logs, audit, and health checks

This layer should remain Carina-branded internally and developer-facing.

### 2. White-Label Control Plane

This is the part customers configure and sell.

Responsibilities:

- tenant setup
- brand configuration
- custom domain binding
- email sender and notification identity
- logo, colors, favicon, app title
- onboarding copy
- support contacts
- plan and usage settings
- role-based access
- reseller account management

### 3. Vertical Solution Layer

This is where money is made.

Partners sell a domain-specific AI agent product on top of Carina:

- property
- legal
- recruitment
- finance
- healthcare
- compliance
- customer support
- operations

Each vertical gets its own prompts, workflows, pack bundles, dashboards, and business copy.

---

## Commercial Packaging

### Package A: Self-Hosted White Label

Target:

- technical founders
- agencies
- operators who want full control

Includes:

- Carina stack
- custom branding
- one tenant or workspace
- custom domain support
- configuration-driven branding
- pack install and lifecycle tools

Customer still hosts and operates it.

### Package B: Managed White Label

Target:

- agencies
- consultancy firms
- small SaaS teams
- specialist operators

Includes:

- managed hosting
- tenant creation and isolation
- brand control
- billing integration
- backups
- updates
- support
- monitoring
- usage reporting

This is the main revenue package for most customers.

### Package C: Reseller Platform

Target:

- operators building a portfolio of client AI systems
- agencies serving multiple end clients

Includes:

- multi-tenant admin
- client branding overrides
- separate workspaces per client
- separate billing per client
- per-client permissions
- white-label portal for client handoff

This is the highest-value tier because it lets one buyer earn from many downstream clients.

---

## Tenant Architecture

The architecture should make tenant separation obvious and hard to accidentally break.

Recommended shape:

- one stack per tenant or customer group
- one internal Docker network per stack
- one database schema or database per tenant class, depending on scale
- one object storage namespace per tenant
- one brand config record per tenant
- one billing account per reseller or customer

Hard boundaries:

- no tenant reads another tenant's files
- no tenant reads another tenant's process state
- no tenant shares app-level memory
- no tenant shares prompt state unless explicitly designed as shared
- no tenant uses another tenant's domain or sender identity

Shared infra should be limited to deliberate named resources:

- reverse proxy
- cert storage
- monitoring
- queue or broker if needed
- central license or entitlement service

---

## Brand Surface

White-label customers should be able to change:

- product name
- logo
- favicon
- theme colors
- login copy
- dashboard name
- email sender name
- email footer
- help docs title
- support contact
- legal footer
- domain and subdomains

White-label customers should not be able to casually rewrite:

- core kernel names
- audit semantics
- security warnings
- permission boundaries
- system prompts
- internal routing names

That keeps support sane and avoids turning the product into an unmaintainable clone factory.

---

## Pricing Direction

Use pricing that maps to business value, not raw model usage only.

Suggested structure:

### Starter

- single brand
- single tenant
- limited packs
- basic support
- self-host or low-touch managed

### Agency

- multiple client workspaces
- brand overrides per client
- shared admin console
- partner pricing
- reseller controls

### Pro or Enterprise

- SSO
- audit trails
- backups
- advanced permissions
- private model routing
- security review support
- SLA support

### Usage-based Add-ons

- model usage
- storage
- extra workspaces
- premium packs
- premium support

Do not make the business depend on a single flat fee. White-label buyers vary too much in scale.

---

## Operational Model

Every customer deployment should follow the same operating rule set:

- its own Docker stack
- its own internal network
- explicit exposed edge only
- explicit env configuration
- explicit deploy script
- explicit smoke test

This is what keeps one customer from breaking another.

Operational requirements:

- brand config is declarative
- tenant creation is scripted
- redeploys are repeatable
- backups are automatic
- logs are tenant-aware
- service restarts are scoped

---

## What Stays Carina-Owned

These remain core platform IP and should not be handed over as casual editable surface:

- agent routing engine
- memory and session engine
- tool registry
- security policy layer
- deployment orchestration
- audit and observability model
- kernel docs and internal prompts
- hosted operations tooling

Customers should extend these, not replace them.

---

## What Becomes Customer-Owned

These should be customer-controlled:

- logo and colors
- customer-facing name
- subdomain and custom domain
- support contact
- product description
- packs and workflows
- vertical prompts and knowledge
- billing identity
- client workspaces

If the customer can sell the outcome, they should control the face of the product.

---

## Recommended Go-To-Market

Start with the segments that already understand the value of packaging expertise:

1. Agencies
2. Specialist consultancies
3. Property and professional services firms
4. Small SaaS teams needing a private AI layer

These buyers care about speed, control, and recurring revenue.

Do not lead with generic AI chat. Lead with:

- launch your own branded agent product
- sell it to your clients
- keep the platform underneath you

---

## Implementation Phases

### Phase 1: Branding and tenant config

- custom app name
- logo and color overrides
- domain binding
- branded login and onboarding
- tenant metadata model

### Phase 2: Workspace and reseller controls

- multi-tenant admin
- client workspace creation
- workspace switching
- billing records
- role boundaries

### Phase 3: Pack marketplace and vertical templates

- branded packs
- install flows
- template bundles
- partner publishing

### Phase 4: Enterprise trust features

- SSO
- audit exports
- data residency controls
- backup policies
- support tiering

### Phase 5: Partner ecosystem

- reseller program
- agency onboarding
- certification
- partner dashboard
- marketplace revenue share

---

## Risks

### Risk 1: Over-customization

If white-label means "users can change everything", support cost rises fast.

Mitigation:

- use controlled branding fields
- keep core behavior fixed
- expose extension points, not the entire kernel

### Risk 2: Brand fragmentation

If every tenant invents its own naming conventions, the product becomes incoherent.

Mitigation:

- keep a canonical internal language
- map it to customer-facing labels at the edge
- document what is configurable and what is not

### Risk 3: Weak tenant isolation

White-label buyers will assume isolation even when it is not properly enforced.

Mitigation:

- hard tenant boundaries
- explicit Docker networks
- scoped services
- tenant-aware logs and storage

### Risk 4: Selling tools instead of outcomes

Customers do not want a toolkit; they want something they can resell.

Mitigation:

- ship vertical templates
- ship deployable packs
- ship client-ready defaults

---

## Decision

Best direction:

- keep Carina as the trusted agent platform
- let partners brand the front end and sell the solution
- make packs and vertical workflows the commercial unit
- keep the kernel opinionated and isolated

That gives Carina a path into reseller and agency economics without diluting the platform.

