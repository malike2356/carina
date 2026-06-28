# Selective licensing (England)

## What selective licensing is

Selective licensing is a power under the Housing Act 2004 (Part 3, Chapter 5). A local housing authority can designate an area where **all private rented properties** must be licensed, not only HMOs. The aim is to tackle poor property conditions, anti-social behaviour linked to rentals, and low management standards in concentrated PRS areas.

As of 2025, **more than 60 councils in England** operate selective licensing schemes. Schemes are time-limited designations (typically five years) and must be consulted on and approved by the Secretary of State when they cover more than 20% of the authority area or more than 20% of PRS stock in the area.

## How it differs from HMO licensing

| Topic | Selective licensing | HMO licensing |
| --- | --- | --- |
| Property scope | All private rented dwellings in the designated area | HMOs meeting mandatory, additional, or temporary exemption thresholds |
| Trigger | Geographic designation by council | Property configuration (5+ occupants, 2+ households, etc.) |
| Licence holder | Landlord or managing agent named on licence | Responsible person / licence holder per HMO rules |
| Conditions | Management and property condition standards set by scheme | HMO-specific conditions (fire, amenities, max occupancy) |
| Both required? | Yes; a property can be in a selective area **and** be an HMO | Track separately in Propreneur |

Propreneur modules: **Selective licences** (`/selective-licences`) and **HMO licences** (`/hmo-licences`).

## Council schemes and tenant-maintained zones

The national list of councils operating schemes **changes** when designations start and end. Propreneur does not ship a live government feed. Each workspace maintains **Selective licensing zones** (`/selective-licences/zones`):

- Local authority name and scheme name
- Scheme start and end dates
- Postcode districts (e.g. `NG1`, `NG2`) or "all properties in area"
- Source URL to the council scheme page
- Active flag

Properties are matched by **postcode district** (outward code segment before the space, e.g. `NG1` from `NG1 2AB`). The portfolio view flags properties in a matching zone with no **granted** selective licence as **Check required**.

Examples of authorities that have run schemes (verify current status with the council): Nottingham, Liverpool, Newham, parts of Manchester, Salford, Leeds, Sheffield, and many London boroughs.

## Application process (typical)

1. **Check designation**: Confirm the property address falls inside an active selective licensing area on the council website.
2. **Apply before letting** (or within the council deadline after designation): Online application, fee, and property details.
3. **Fit and proper test**: Council assesses landlord/agent suitability.
4. **Property standards**: Council may inspect against HHSRS-related standards and scheme conditions.
5. **Licence issued**: Licence number, conditions, expiry (often aligned to scheme end).
6. **Renewal**: New designation or renewal round; track expiry and `renewal_reminder_days` in Propreneur (default 90 days).

Fees vary by authority and property size; record `annual_fee` and `total_fee` on the licence record.

## Licence conditions (common themes)

Conditions are set per scheme but often include:

- Adequate management arrangements and tenant referencing
- Gas safety, electrical safety, and EPC compliance
- Maintenance of structure, damp, and hazards
- Tenancy agreements and deposit protection
- Handling of anti-social behaviour reports
- Access for council inspections

Store a plain-language **conditions summary** on the licence and link supporting documents via the document vault.

## Propreneur data model

- `selective_licences`: per-property licence lifecycle (`pending_application`, `applied`, `granted`, `renewal_due`, `expired`, `revoked`, `not_required`)
- `selective_licensing_zones`: tenant lookup for geographic schemes
- Service: `SelectiveLicenceService` (create, renew, renewal due list, expired list, zone check, properties requiring licence check)
- RAG on licence: red (expired/revoked), amber (renewal due or in-flight status), green (granted or not_required)

## Carina context

When users ask about selective licensing, Carina should:

1. Clarify selective vs HMO licensing and that both may apply.
2. Direct users to maintain **zones** for their portfolio geography and to record **licences** per property.
3. Explain **Check required** on the portfolio when a zone matches but no active granted licence exists.
4. Remind that scheme boundaries and fees are **council-specific**; cite the workspace zone `source_url` when present.
5. Never state that a property is exempt without a recorded `not_required` status or authoritative council confirmation.

Related knowledge: HMO licensing (Prompt 6 / HMO licence module), compliance overview (`07-compliance.md`), HHSRS and property standards.
