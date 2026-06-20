# Gap 08: Enterprise Security; Operational Security Layer

**Build Time:** 8 weeks
**Depends On:** gap-01 (Docker), gap-05 (Security)
**Status:** PROMPTS WRITTEN; Ready for development

---

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
