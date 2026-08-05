# Prompt 22: FHIR R4 Integration (Phase 04)

**Phase:** 04 - The System
**Priority:** P0 (Enterprise EHR Integration)
**Depends on:** Phase 03, Signed NHS Trust Contract
**Target time:** 12 hours
**Platform:** Python 3.11 / FastAPI, FHIR R4 REST API

## What This Builds

Integrates Clinicom AI with NHS Trust EHR systems (Epic, Cerner, EMIS, TPP SystmOne) via **HL7 FHIR R4**. Reads patient demographics, appointments, and encounters. Writes interpreter session summaries back to the patient record as `FHIR Communication` resources.

---

## Architecture & Adapters

```
Clinicom FHIR Orchestrator (`app/integrations/fhir/`)
  ├── BaseFHIRAdapter (Abstract Interface)
  ├── EpicFHIRAdapter
  ├── CernerFHIRAdapter
  └── NHS Spine Adapter (PDS / Spine Directory Services)
```

---

## Database Migration

Create `clinicom-ai/app/db/migrations/008-fhir-config.sql`:

```sql
CREATE TABLE IF NOT EXISTS clinicom_organization_fhir_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES clinicom_organizations(id) ON DELETE CASCADE,
    fhir_server_url TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    auth_url TEXT NOT NULL,
    token_url TEXT NOT NULL,
    ehr_vendor TEXT NOT NULL CHECK (ehr_vendor IN ('epic', 'cerner', 'emis', 'tpp', 'generic_fhir')),
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## FHIR Communication Write-Back (`app/integrations/fhir/communication.py`)

```python
"""Writes Clinicom interpreter logs to EHR as FHIR Communication resources."""

def build_fhir_communication_resource(
    patient_fhir_id: str,
    encounter_fhir_id: str,
    practitioner_fhir_id: str,
    session_summary: str,
    source_language: str
) -> dict:
    return {
        "resourceType": "Communication",
        "status": "completed",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/communication-category",
                        "code": "instruction",
                        "display": "Interpreter Session Log"
                    }
                ]
            }
        ],
        "subject": {"reference": f"Patient/{patient_fhir_id}"},
        "encounter": {"reference": f"Encounter/{encounter_fhir_id}"},
        "sender": {"reference": f"Practitioner/{practitioner_fhir_id}"},
        "payload": [
            {"contentString": session_summary}
        ],
        "medium": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationMode",
                        "code": "WRITTEN",
                        "display": "Clinicom AI Translation"
                    }
                ]
            }
        ]
    }
```

---

## Acceptance Criteria

- [ ] Connects securely to FHIR R4 endpoints using OAuth 2.0 Client Credentials flow.
- [ ] Fetches Patient demographics and pre-populates preferred language.
- [ ] Writes `FHIR Communication` resources back to EHR upon session completion.
- [ ] EHR vendor abstraction supports Epic and Cerner adapters cleanly.
- [ ] Tests pass in `app/tests/test_fhir.py`.
