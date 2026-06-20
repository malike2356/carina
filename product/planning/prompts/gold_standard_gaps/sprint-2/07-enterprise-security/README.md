# Sprint 2 - Category 07: Enterprise Security

## What Exists

- Basic tenant isolation in DB schema
- Session auth for ops panel (password-based)
- Scout audit trail (event logging to PostgreSQL)
- `src/api/` - Hosted mode auth stubs

## What Is Missing

- SSO + identity federation (SAML, OIDC, Google Workspace, Microsoft Entra ID)
- Immutable audit log with cryptographic anchors
- Data residency and geofencing controls
- Disaster recovery runbook and automated DR drills
- Zero-trust network policy enforcement
- SOC2 evidence automation (continuous control monitoring)

## Prompts in This Category

- `01-sso-identity-federation.md` - SAML/OIDC SSO with Google Workspace and Entra ID
- `02-immutable-audit.md` - Append-only audit log with Ethereum/Merkle anchoring
- `03-data-residency-geofencing.md` - Region-locked storage, geofenced access rules
- `04-disaster-recovery.md` - DR runbook, automated backup drills, RTO/RPO targets
- `05-zero-trust-network.md` - mTLS between services, network policy enforcement
- `06-soc2-evidence-automation.md` - Continuous control monitoring, evidence packaging

## Original Reference

`sprint-2/gap-08-enterprise-security/`
