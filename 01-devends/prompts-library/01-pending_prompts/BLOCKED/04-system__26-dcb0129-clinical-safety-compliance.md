# Prompt 26: DCB0129 Clinical Safety Compliance (Phase 04)

**Phase:** 04 - The System
**Priority:** P0 (Regulatory Mandatory)
**Depends on:** Phase 03, Signed Trust Contract
**Target time:** 12 hours
**Platform:** Python 3.11 / FastAPI, Clinical Safety Framework

## What This Builds

Implements formal **DCB0129 Clinical Risk Management** technical controls and clinical safety verifiers required for NHS deployment. Includes back-translation semantic similarity verification, medical scope boundary enforcement, emergency alerts, and immutable safety event auditing.

---

## Technical Safety Controls (`app/lib/safety/`)

### 1. `app/lib/safety/verifier.py` (Meaning Preservation)
Back-translates output and calculates semantic embedding distance. If semantic drift > 15%, flags translation for clinician verification.

### 2. `app/lib/safety/boundary.py` (Scope Boundary Enforcer)
Detects when patients ask the AI for medical diagnoses, prescriptions, or emergency triage advice, intercepting with:  
`"I am an interpreter, not a doctor. Please ask your clinician directly."`

---

## Acceptance Criteria

- [ ] Back-translation verifier flags semantic drift > 15% before sending output.
- [ ] Scope boundary enforcer blocks non-interpreter clinical advice attempts.
- [ ] Emergency keywords trigger immediate clinician UI alerts.
- [ ] Immutable `clinicom_safety_events` table logs all safety incidents.
- [ ] Tests pass in `app/tests/test_dcb0129_safety.py`.
