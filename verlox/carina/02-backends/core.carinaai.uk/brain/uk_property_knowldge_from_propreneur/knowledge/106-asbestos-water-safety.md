# Asbestos register and water safety (Legionella)

Tags: `asbestos`, `legionella`, `water_safety`, `compliance`, `coshh`, `carina`

Builds on certificate-level Legionella tracking in `ComplianceItem` and regulation `LEGIONELLA_2002` in `97-regulation-registry.md`. This module stores full assessment and control records required by COSHH Regulations 2002 and HSE ACoP L8.

## Regulatory basis

### Asbestos (Control of Asbestos Regulations 2012, CAR 2012)

Dutyholders must:

- Identify asbestos in non-domestic premises and the common parts of domestic premises (including HMOs)
- Assess the risk from asbestos in situ
- Prepare and implement a written plan to manage identified ACM (asbestos containing material)
- Review the plan regularly

**Approved Code of Practice:** L143 (Managing and working with asbestos). CAR 2012 sets legal duties; L143 gives practical guidance on surveys, management plans, and work with ACM.

**Survey types (record on `asbestos_registers.survey_type`):**

| Type | When used |
|------|-----------|
| Management | Normal occupation; locate ACM that could be disturbed during routine use |
| Refurbishment / demolition | Before intrusive works; full inspection including hidden areas |
| Presumptive | Materials assumed ACM until sampled; used when access is limited |

If ACM is found, default action is **leave in place and manage** unless condition or planned works require removal or encapsulation.

### Legionella and water hygiene (COSHH 2002, ACoP L8)

All landlords and property managers who control water systems must:

- Carry out a suitable and sufficient legionella risk assessment
- Implement control measures where risk is identified
- Keep records of monitoring and maintenance

**High-risk features:** storage tanks, dead legs, infrequently used outlets, showers, seasonal or void occupation.

**Temperature targets (HSE guidance):**

| Check | Target |
|-------|--------|
| Hot water at outlet | 50C minimum immediately; **55C within 1 minute** at sentinel outlets |
| Cold water at outlet | **20C or below within 2 minutes** (avoid 20-45C stagnation band) |

Legionella grows fastest between 20C and 45C.

## Monitoring frequencies

| Task | Typical frequency |
|------|-------------------|
| Temperature checks (sentinel outlets) | Quarterly minimum; monthly for higher-risk systems |
| Dead leg / rarely-used outlet flush | Annual minimum |
| Showerhead descale and clean | Every 3 months where showers present |
| Tank inspection / clean | Per risk assessment; often 6-12 monthly for stored water |

Record each task on `water_hygiene_logs` with `log_type`.

## Nexio data model

| Table | Purpose |
|-------|---------|
| `asbestos_registers` | Survey record, management plan flags, review dates |
| `asbestos_materials` | ACM items within a register (location, condition, action) |
| `legionella_assessments` | Risk assessment, system features, control programme |
| `water_hygiene_logs` | Temperature checks, flushes, descaling, tank work |

**Service:** `App\Services\Compliance\AsbestosWaterSafetyService`

**Controller:** `App\Http\Controllers\Tenant\Compliance\AsbestosWaterSafetyController`

**Routes:** `tenant.compliance.asbestos.*` under `/compliance/asbestos-water`

## Portfolio RAG

**Asbestos register:**

- **Red:** no register, or `next_review_date` in the past
- **Amber:** review due within 30 days, or any high-risk material
- **Green:** current register and no high-risk materials due

**Water safety:**

- Failing temperature logs highlighted in red on assessment show page
- Properties with legionella assessment but no temperature check in 90 days appear on hygiene schedule

## Properties missing asbestos survey

`getPropertiesMissingAsbestosRegister()` returns properties with no register where:

- `year_built` is before 2000 when that column exists on `properties`, or
- property is HMO or commercial (interim filter until construction year is captured on the property record)

Pre-2000 buildings are most likely to contain ACM; a management survey is mandatory before refurbishment of any building built before 2000.

## Carina context

When answering asbestos or water safety questions:

- Distinguish **certificate expiry** (`ComplianceItem` type legionella) from **ongoing control records** in this module
- Reference CAR 2012 duties for HMO common parts and commercial premises
- Quote temperature targets: hot 55C within 1 minute, cold 20C within 2 minutes
- Flag storage tanks and dead legs as high-risk features requiring a written control scheme
- Point users to `/compliance/asbestos-water` for portfolio view and logging temperature checks

Related knowledge: `97-regulation-registry.md` (LEGIONELLA_2002), `07-compliance.md`, masterbrain legionella awareness question pool.
