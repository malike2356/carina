# Gap 08: Enterprise Security; Operational Security Layer

**Build Time:** 8 weeks
**Depends On:** gap-01 (Docker), gap-05 (Security)
**Status:** PROMPTS WRITTEN; Ready for development

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## What This Gap Covers

Gap-05 handles tool-level security (72 tools, forensics, compliance mapping, governance). This gap handles the operational security layer that enterprises demand before they'll run Carina in production with real customer data. SSO, immutable audit, data residency, disaster recovery, HSM integration, zero-trust networking. These are the features that turn Carina from a powerful agent platform into an enterprise-grade security platform.

## Prompts

| # | Prompt | What It Delivers | Build Time |
|---|--------|-----------------|------------|
| 01 | SSO & Identity Federation | SAML, OIDC, LDAP; enterprise identity integration | 2 weeks |
| 02 | Immutable Audit & Cryptographic Proof | WORM audit trails, Merkle tree verification, tamper detection | 1 week |
| 03 | Data Residency & Geo-Fencing | Region-locked data storage, compliance with GDPR/CCPA/local laws | 1 week |
| 04 | Disaster Recovery & Business Continuity | Automated backup, cross-region failover, RPO/RTO targets | 2 weeks |
| 05 | Zero-Trust Network Architecture | mTLS between services, SPIFFE identities, network policy enforcement | 1 week |
| 06 | SOC2 Type II Evidence Automation | Continuous control monitoring, evidence collection, auditor package generation | 1 week |
