# Sprint 2 - Category 07: Enterprise Security


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

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
