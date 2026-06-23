# Contact network graph and dossier intelligence

## Overview

Workspace-wide typed relationships between CRM contacts, optional deal sourcer links, and dossier overlap signals across property tenancies. Nothing is auto-linked; staff record relationships explicitly and dossier matches are awareness-only.

## `contact_relationships` table

| Column | Purpose |
|--------|---------|
| `from_contact_id` | Source contact in a directional edge |
| `to_contact_id` | Target contact |
| `relationship_type` | One of `ContactRelationshipTypes::ALL` |
| `context_type` | Optional: `property`, `deal_analysis`, `pipeline_deal` |
| `context_id` | ID of the context record |
| `started_at` / `ended_at` | Role history; null `ended_at` means active |
| `notes` | Free text |
| `created_by` | User who added the edge |

Foreign keys cascade on contact delete; `created_by` nulls on user delete.

## Relationship types

Read as: **from_contact** [type] **to_contact**.

| Type | Label | Inverse (inbound view) |
|------|-------|------------------------|
| `investor_for` | Investor for | Investor |
| `landlord_of` | Landlord of | Tenant |
| `sourcer_for` | Sourcer / deal packager for | Investor (deal sourced for) |
| `agent_for` | Agent / PM for | Landlord / principal |
| `manages` | Manages | Managed by |
| `tenant_of` | Tenant of | Landlord |
| `co_tenant_with` | Co-tenant with | Co-tenant |
| `introduced_by` | Introduced by | Introduced |
| `solicitor_for` | Solicitor for | Client |
| `associate` | Associate | Associate |
| `replaced_by` | Replaced by | Predecessor |

## Walking the network

`App\Services\Crm\ContactNetworkService::neighbourhood(Contact $root, int $depth = 2)` returns active neighbours (no `ended_at`) up to two hops. Each entry includes `contact`, `hops`, `via_type`, and `direction` (`outbound` or `inbound`).

UI: collapsible **Network** panel on `tenant.contacts.show` with outbound/inbound tables, add form, and sourced deals list.

## Deal sourcer

`deal_analyses.sourcer_contact_id` nullable FK to `contacts`. Set on deal edit (sourcing intelligence fieldset). `Contact::sourcedDeals()` lists deals where this contact is the sourcer.

## Dossier intelligence

`App\Services\Property\DossierIntelligenceService` compares active tenancies (`end_date` null) on:

- `university`
- `course`
- `employer`
- `occupation`

Matching uses PostgreSQL `ilike` for exact case-insensitive values; values shorter than three characters are ignored. `signalsForTenancy()` returns other tenancies sharing any non-empty field. `workspaceOverlapGroups()` groups all active tenancies with two or more sharing the same normalised value.

UI: **Shared attributes across portfolio** block on the tenant dossier show page (`tenant.properties.tenancies.show`).

Privacy: workspace-internal only; not exposed on investor portal or outbound comms.

## Carina tools

| Tool | Purpose |
|------|---------|
| `get_contact_network` | `contact_id`, optional `depth` (1-2); returns network nodes |
| `find_dossier_overlaps` | `tenancy_id`; returns shared dossier signal groups |

Both require tenant user auth (`canAccessLeadData` / `canAccessDealContextPropertyDetails`).

## Example

Record: Investor A is investor_for Landlord B via property 14.

1. Open Landlord B in CRM.
2. Network → Add relationship: connect to Investor A, type **Investor for**, notes optional.
3. Or from Investor A outbound: type **Investor for**, target Landlord B; set context if needed via API later.

Retrieve: Carina `get_contact_network` with `contact_id` of Landlord B, or `ContactNetworkService::neighbourhood($landlord, 2)`.

Deal sourcing: set **Deal sourcer** on the deal edit form to the packager contact; appears under Network → Sourced deals on that contact.
