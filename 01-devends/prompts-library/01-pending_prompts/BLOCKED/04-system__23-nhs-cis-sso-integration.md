# Prompt 23: NHS CIS SSO Integration (Phase 04)

**Phase:** 04 - The System
**Priority:** P0 (Mandatory for NHS Trust Deployment)
**Depends on:** Phase 02 (Auth System)
**Target time:** 8 hours
**Platform:** Python 3.11 / FastAPI, OpenID Connect (OIDC)

## What This Builds

Integrates **NHS Care Identity Service (CIS / CIS2)** authentication. Clinicians log into Clinicom AI using physical NHS Smartcards or NHSmail OIDC credentials. Maps national NHS RBAC role codes (e.g. `R8000`) directly to Clinicom authorization privileges.

---

## NHS RBAC Role Mapping (`app/lib/role_mapper.py`)

```python
"""Maps NHS National Role Codes to Clinicom Roles."""

NHS_ROLE_MAP = {
    "R8000": "clinician",        # Medical Practitioner
    "R8001": "clinician",        # Nurse Consultant
    "R8003": "clinician",        # Health Professional
    "R0050": "practice_manager", # Practice / Administrative Manager
}

def map_nhs_role(nhs_role_code: str) -> str:
    return NHS_ROLE_MAP.get(nhs_role_code, "clinician")
```

---

## Acceptance Criteria

- [ ] NHS CIS2 OIDC authentication flow succeeds with test smartcard credentials.
- [ ] National NHS RBAC codes map automatically to Clinicom roles.
- [ ] Entra ID (Azure AD) fallback supported for NHS Trust single sign-on.
- [ ] Audit log records every NHS login event for IG compliance.
- [ ] Tests pass in `app/tests/test_nhs_sso.py`.
