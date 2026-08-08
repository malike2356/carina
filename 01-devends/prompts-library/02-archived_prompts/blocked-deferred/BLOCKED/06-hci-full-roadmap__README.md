# Clinicom HCI Full Roadmap -- remaining pending

**Archived (done):** `../../archived-prompts/2026-08-02-completed/06-hci-full-roadmap/`
**Status snapshot at archive:** that folder's `README-STATUS-AT-ARCHIVE.md`

Only incomplete HCI prompts remain here. Nice, Future, and Premium tiers are fully archived.

## Remaining

### Must (partial)

| ID | File | Status | Why not archived |
|---|---|---|---|
| M06 | `01-must/m06-clinicom-stripe-catalog-webhooks.md` | partial | Needs Clinicom-native Stripe prices in SoT (owner) |
| M19 | `01-must/m19-google-oauth-redirects-sot.md` | partial | Needs Clinicom Stripe SoT entry + prod OAuth redirects |

### Advanced (partial / blocked-owner)

| ID | File | Status | Why not archived |
|---|---|---|---|
| A04 | `05-advanced/a04-fhir-r4-full.md` | partial | Sandbox only; live Trust FHIR needs contract |
| A05 | `05-advanced/a05-nhs-cis-sso.md` | partial | Sandbox CIS login only |
| A06 | `05-advanced/a06-ehr-adapters.md` | partial | Adapter stubs, not live EHR |
| A07 | `05-advanced/a07-dcb0129-0160-external-audit-dtac.md` | blocked-owner | External DTAC/DCB audit |
| A11 | `05-advanced/a11-custom-ml-models.md` | partial | Eval harness; no trained models |
| A14 | `05-advanced/a14-enterprise-sso-federation.md` | partial | Federation API scaffold |
| A16 | `05-advanced/a16-carina-skill-aiva-employee.md` | partial | Bridge stubs; not live Aiva employee |

## Constraint reminders

- Stripe: only prices from `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md`. Do not invent Clinicom prices unless the owner asks.
- Google OAuth: credentials from `.access/.signing-with-google-credentials.md` (and related files).
- No nested `carina/verlox/`. Canonical Carina under `carina/02-backends/`, `carina/03-frontends/`, `carina/scripts/`.
