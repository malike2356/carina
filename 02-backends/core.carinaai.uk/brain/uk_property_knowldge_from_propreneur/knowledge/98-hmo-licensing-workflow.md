# 98 - HMO Licensing Workflow

## Purpose

Guide for tracking HMO licence applications, council conditions, renewals, Article 4 directions, and overcrowding prevention in Propreneur v2. Distinct from HMO compliance scoring (room sizes, fire doors, communal areas). Written for Carina help context and workspace operators managing UK HMO portfolios.

---

## 1. Mandatory vs Additional Licensing

### Mandatory HMO licensing (England and Wales)

A property requires a **mandatory** HMO licence when all three apply:

1. The property is occupied by **five or more people**
2. Those people form **two or more separate households**
3. They **share basic amenities** (kitchen, bathroom, or toilet)

Storeys no longer determine mandatory licensing nationally (Housing Act 2004 as amended). Councils may still ask about storeys on application forms.

**Typical licence period:** up to five years. Fees vary by council (often £600-£1,200+ for mandatory schemes).

**Penalty for operating without a licence:** unlimited fine, rent repayment order (up to 12 months), and inability to use Section 21 in some circumstances.

### Additional licensing

**Additional licensing** is council-specific. A local authority can designate wider areas or property types (for example all HMOs with three or more occupants, or all shared houses in a ward).

Check the **local authority scheme designation** before assuming mandatory rules alone apply. Record scheme name and designation reference in Propreneur.

### Temporary exemption

If a property **will cease to be an HMO within three months**, the manager can apply for a **temporary exemption notice (TEN)** instead of a full licence. Status in Propreneur: `temporary_exemption`.

### Selective licensing

**Selective licensing** covers ordinary private rentals in designated areas, not only HMOs. Propreneur tracks selective schemes separately (see Prompt 13). Do not conflate with HMO additional licensing.

---

## 2. Article 4 Directions

An **Article 4 direction** removes permitted development rights that would otherwise allow a dwelling (C3) to convert to a small HMO (C4) without full planning permission.

**Why it matters:**

- Buying or converting in an Article 4 area may require **full planning permission** for HMO use
- Operating as an HMO without permission is a planning enforcement risk
- Lenders and insurers may ask whether lawful HMO use exists

**In Propreneur:**

- Record per property whether it sits in an Article 4 zone (`property_article4_flags`)
- Store zone name, local authority, restriction detail, and verified date
- Link from the HMO licence show page; Article 4 status is independent of licence grant but affects acquisition and conversion strategy

**Carina should advise:** verify with the local planning authority and Land Registry / title constraints; Propreneur stores operational records, not legal opinions.

---

## 3. Licence Conditions Lifecycle

Councils attach **individual conditions** to each licence. Conditions are not generic; they must be copied from the licence document and tracked one by one.

### Common condition categories

| Category | Examples |
|---|---|
| fire_safety | Fire doors, alarms, emergency lighting, FRAs |
| room_size | Minimum 6.51 sqm single, 10.22 sqm double (national minimums; councils may require more) |
| occupancy | Max persons and households on licence face |
| management | Named responsible person, tenant references, complaints procedure |
| maintenance | Communal cleaning, waste storage, garden upkeep |

### Status workflow in Propreneur

| Status | Meaning |
|---|---|
| pending | Not yet assessed or evidence not submitted |
| met | Condition satisfied; met_date and evidence recorded |
| partial | Partly compliant; follow-up required |
| failed | Non-compliant; enforcement risk |

**Operator steps:**

1. Add each condition from the licence PDF when granted
2. Set due_date where the council specifies a deadline
3. Upload evidence to Document Vault; link document_id on the condition
4. Mark met with met_date when council accepts or inspection passes
5. Open conditions count drives RAG on licence index and property panel

---

## 4. Renewal Workflow

### Timeline

- Licences typically run **up to five years**
- Apply for renewal **2-3 months before expiry** (many councils require 8-12 weeks processing)
- Default renewal reminder in Propreneur: **90 days** before expiry (configurable per licence)

### Responsible person

The **licence holder** named on the licence is legally responsible for compliance with licence conditions. The **manager** (if different) must be fit and proper and contactable. Record both on the licence record and HMO management contact fields on the property.

### Renewal process in Propreneur

1. Dashboard or HMO licences index shows **renewal_due** RAG (amber) when inside reminder window
2. On licence show, use **Start renewal application** to:
   - Mark the current licence `expired`
   - Create a new licence row with status `pending_application`
3. Record application_date, fee_paid, and council reference on the new row
4. Re-enter or copy forward conditions as the council specifies on renewal
5. Previous licences remain in **renewal history** on the show page

### Status values

| Status | Use |
|---|---|
| pending_application | Not yet submitted |
| applied | Submitted, awaiting decision |
| granted | Current valid licence |
| renewal_due | Granted but inside reminder window (can also be inferred) |
| expired | Superseded or past expiry |
| revoked | Council revoked |
| exempt | TEN or legitimate exemption recorded |

---

## 5. Overcrowding Prevention

Licence face shows **max_occupants** and often **max_households**. Operating above these limits is a criminal offence under the Housing Act 2004 and breaches licence conditions.

### Overcrowding formula

```
current_occupancy = count(active property_tenancies)
licensed_max = max_occupants on current granted licence
overcrowded = current_occupancy > licensed_max
within_limit = current_occupancy <= licensed_max
```

Propreneur:

- Counts **active** `property_tenancies` (no `end_date`, or `end_date` in the future) via `HmoLicenceService::getCurrentOccupancy()`
- Compares to `max_occupants` on the current licence via `isOccupancyWithinLimit()`

Also respect `max_households` on the licence face where the council imposes a household cap.

### Operator actions when over limit

1. Do not let new rooms until compliant
2. Review licence conditions category `occupancy`
3. Consider lawful tenant turnover or licence variation application to council
4. Document decisions in licence notes and compliance audit trail

**Carina must not** advise evading occupancy limits. Recommend lawful compliance, council contact, and professional housing advice where needed.

---

## 6. Propreneur UI Map

| Screen | Route name | Purpose |
|---|---|---|
| HMO licences index | `tenant.hmo-licences.index` | All properties, one row each, filter by status |
| Create / edit licence | `tenant.hmo-licences.create`, `.edit` | Application and grant details |
| Licence detail | `tenant.hmo-licences.show` | Conditions, renewal history, Article 4 panel |
| Article 4 editor | `tenant.hmo-licences.article4` | Per-property planning restriction flag |
| Property show panel | Property page (HMO only) | Current licence summary and quick links |

HMO **compliance scoring** (room sizes, certs, fire logs) lives under `tenant.properties.nexio.compliance.show`; licensing is separate under `tenant.hmo-licences.*`.

---

## 7. Carina Help Context

When users ask about HMO licensing in Carina:

- Distinguish **licence workflow** (this doc) from **physical compliance scoring** (fire, room sizes, EPC)
- Ask which **local authority** applies; rules differ by council
- For "Do I need a licence?", apply mandatory five-person two-household test, then check additional/selective schemes
- For renewals, reference expiry_date and renewal_reminder_days on the property licence record
- For overcrowding, cite current occupancy vs max_occupants from the licence show page
- For conversions, check Article 4 flag before suggesting HMO strategy
- Remind users: **this is operational guidance, not legal advice**; council licensing team and qualified housing solicitor for disputes

### Key service methods

- `HmoLicenceService::createLicence()` - new application or grant record
- `HmoLicenceService::renewLicence()` - expire old, start renewal row
- `HmoLicenceService::getLicencesDueRenewal()` - portfolio renewal queue
- `HmoLicenceService::getCurrentOccupancy()` / `isOccupancyWithinLimit()` - overcrowding check

---

## 8. Related Knowledge

- `91-uk-property-compliance-and-hmrc.md` - wider landlord compliance
- HMO compliance scoring module - physical standards and RAG score
- Prompt 13 (future) - selective licensing schemes
