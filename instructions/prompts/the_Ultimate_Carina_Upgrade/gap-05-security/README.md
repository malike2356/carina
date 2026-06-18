# Carina Security Gold Standard; Master Plan

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Date:** 2026-06-17 (revised 2026-06-18)
**Purpose:** Make Carina the undisputed gold standard for AI agent security, cyber defense, forensics, compliance, governance, and trust. Enterprise-ready. Nothing left out.
**Reference agents:** Hermes (defense-in-depth), OpenClaw (process/CI security), Odysseus (practical paranoia)
**Existing code:** 61 security files (was 39); plus src/sandbox/ (6 files, full execution isolation); plus src/certification/ (built-on-carina.ts)
**Target:** Carina must be the platform enterprises trust with their most sensitive data and operations

---

## SECURITY POSTURE; CURRENT VS TARGET

```
CURRENT (2026-06-18):
  61 security files. ~200KB+. Prevention, detection, and response layers.
  Prevention: prompt-guard, tool-policy, exec-approval-levels, egress-filter,
    sandbox-policy, runtime-isolation, gateway-exposure, channel-security-defaults,
    admin-tool-policy, agent-guard-adapter, tool-execution-context, tool-runner-security,
    security-guardrails
  Detection: tool-sequence-guard, honeypot-client, deception-client, trust-state,
    kill-switch-listener
  Response: shield-report, trust-compliance-report, jit-credentials, security-doctor,
    security-audit
  NEW: src/sandbox/ (docker-runner, worker-sandbox, openshell-sandbox, sandbox-factory);
    sandbox execution is built. Use it for RASP and penetration tests.
  NEW: src/certification/built-on-carina.ts; certification system.
    Use it for enterprise governance prompt 11.

TARGET:   100+ files, 500KB+. Unified RASP engine. Full forensics pipeline.
          SOC2/ISO27001/GDPR compliance automation. Supply chain security.
          Automated red team. Real-time trust scoring. Enterprise governance
          framework. The platform banks and governments deploy.
```

> Note: Because `src/sandbox/` is now built, Prompt 09 (RASP engine) effort is reduced from 4 to 2-3 weeks. The sandbox execution layer already exists - only the signal correlation and response dispatcher need to be built. Similarly, Prompt 11 (enterprise governance) effort is reduced by ~1 week since `certification/built-on-carina.ts` exists as a hook point.

---

## PROMPT FILES

| # | File | Scope | Source | Effort |
|---|------|-------|--------|--------|
| 01 | `01-plan-mode-allowlist.md` | Fail-safe plan mode | Odysseus | 1 week |
| 02 | `02-behavior-proof-policy.md` | Real behavior verification | OpenClaw | 2 weeks |
| 03 | `03-automated-security-review.md` | CI/CD security review bot | OpenClaw ClawSweeper | 3 weeks |
| 04 | `04-penetration-test-suite.md` | Security QA/penetration tests | OpenClaw | 2 weeks |
| 05 | `05-forensics-pipeline.md` | Chain of custody, evidence, timeline, IR | NEW | 4 weeks |
| 06 | `06-supply-chain-security.md` | SBOM, dependency scan, provenance | NEW | 3 weeks |
| 07 | `07-secrets-rotation.md` | Automated credential rotation | NEW | 2 weeks |
| 08 | `08-compliance-automation.md` | SOC2, ISO27001, GDPR automation | NEW | 4 weeks |
| 09 | `09-unified-rasp-engine.md` | Runtime Application Self-Protection | NEW | 4 weeks |
| 10 | `10-red-team-automation.md` | Automated adversarial testing | NEW | 3 weeks |
| 11 | `11-enterprise-governance.md` | Enterprise trust & governance framework | NEW | 3 weeks |
| 12 | `12-security-dashboard.md` | Unified security operations dashboard | NEW | 2 weeks |

**Total: 12 prompts. 33 weeks. Enterprise-ready security platform.**

---

## BUILD ORDER

```
Phase 1; Foundation (Weeks 1-5)
  01-plan-mode-allowlist.md; fail-safe exploration
  02-behavior-proof-policy.md; verify agent claims
  03-automated-security-review.md; CI/CD security bot

Phase 2; Testing & Supply Chain (Weeks 6-10)
  04-penetration-test-suite.md; attack simulation
  06-supply-chain-security.md; SBOM, dependencies, provenance
  07-secrets-rotation.md; credential lifecycle

Phase 3; Forensics & RASP (Weeks 11-18)
  05-forensics-pipeline.md; incident response
  09-unified-rasp-engine.md; runtime protection

Phase 4; Compliance & Governance (Weeks 19-26)
  08-compliance-automation.md; SOC2/ISO/GDPR
  11-enterprise-governance.md; trust framework

Phase 5; Red Team & Dashboard (Weeks 27-33)
  10-red-team-automation.md; continuous testing
  12-security-dashboard.md; unified operations
```

---

## INTEGRATION WITH EXISTING CARINA SECURITY

All new systems integrate with these existing Carina security files:

```
Existing (DO NOT REPLACE; EXTEND):
  security/prompt-guard.ts               → feeds into RASP
  security/tool-sequence-guard.ts        → feeds into RASP
  security/egress-filter.ts              → feeds into RASP
  security/trust-state.ts                → feeds into governance
  security/honeypot-client.ts            → feeds into red team
  security/deception-client.ts           → feeds into red team
  security/kill-switch-listener.ts       → feeds into IR playbooks
  security/shield-report.ts              → feeds into dashboard
  security/trust-compliance-report.ts    → feeds into compliance
  security/scout-client.ts               → feeds into forensics
  security/security-audit.ts             → feeds into automated review
  security/security-doctor.ts            → feeds into automated review
  telemetry/session-telemetry.ts         → feeds into forensics
  telemetry/agent-behavior-log.ts        → feeds into forensics
  ops/security-audit.ts                  → feeds into penetration tests
  ops/secrets-audit.ts                   → feeds into secrets rotation
```

---

## TARGET ARCHITECTURE (POST-IMPLEMENTATION)

```
Carina Security Platform
│
├── PREVENTION LAYER
│   ├── Prompt Guard (injection detection)
│   ├── Tool Policy + RBAC (access control)
│   ├── Exec Approval Levels (tiered authorization)
│   ├── Egress Filter (outbound control)
│   ├── Plan Mode Allowlist (fail-safe exploration)
│   ├── Sandbox Policy (isolation)
│   └── Channel Security Defaults
│
├── DETECTION LAYER
│   ├── Tool Sequence Guard (attack patterns)
│   ├── Honeypot Network (deception)
│   ├── Trust State Scoring (behavioral)
│   ├── Anomaly Detection (statistical)
│   └── Threat Intelligence Feed
│
├── RESPONSE LAYER
│   ├── Kill Switch (emergency shutdown)
│   ├── Automated IR Playbooks
│   ├── Shield (adaptive protection)
│   ├── JIT Credential Rotation
│   └── Incident Alerting (channels + email)
│
├── RASP ENGINE (unified)
│   ├── Signal Correlator
│   ├── Attack Graph Builder
│   ├── Confidence Scorer
│   └── Automated Response Dispatcher
│
├── FORENSICS PIPELINE
│   ├── Chain of Custody Tracker
│   ├── Evidence Preserver (immutable log)
│   ├── Timeline Reconstructor
│   ├── Forensic Exporter (CSV/JSON/PDF)
│   └── Case Management
│
├── COMPLIANCE LAYER
│   ├── SOC 2 Evidence Collector
│   ├── ISO 27001 Control Mapper
│   ├── GDPR Data Registry
│   ├── Compliance Dashboard
│   └── Audit Report Generator
│
├── SUPPLY CHAIN SECURITY
│   ├── SBOM Generator
│   ├── Dependency Scanner
│   ├── Provenance Verifier
│   ├── Secrets Rotation Scheduler
│   └── Credential Expiry Enforcer
│
├── TESTING LAYER
│   ├── Security QA Scenario Runner
│   ├── Red Team Automation
│   ├── Behavior Proof Verifier
│   ├── Automated Code Review Bot
│   └── Continuous Posture Assessment
│
├── GOVERNANCE LAYER
│   ├── Trust Framework
│   ├── Role-Based Access Control
│   ├── Audit Log (immutable)
│   ├── Policy Engine
│   └── Compliance Reporting
│
└── SECURITY OPERATIONS DASHBOARD
    ├── Real-time Threat Map
    ├── Trust Score Overview
    ├── Active Incidents
    ├── Compliance Status
    ├── Supply Chain Health
    └── Red Team Results
```

---

## METRICS; WHAT SUCCESS LOOKS LIKE

```
Detection:
  - Prompt injection: detected within 50ms, 99.9% recall
  - Tool sequence attacks: detected by 3rd malicious call
  - Zero-day threats: honeypot detection within 60 seconds

Response:
  - Kill switch activation: < 1 second
  - Automated IR playbook execution: < 30 seconds
  - Credential rotation: < 5 seconds per credential

Forensics:
  - Incident timeline reconstruction: < 10 seconds
  - Evidence export: < 30 seconds for 1GB
  - Chain of custody: 100% immutable, SHA-256 verified

Compliance:
  - SOC 2 evidence collection: 100% automated
  - ISO 27001 control coverage: 85%+ automated
  - Audit report generation: < 60 seconds

Supply Chain:
  - SBOM generation: < 5 seconds
  - Dependency scan: < 30 seconds
  - Provenance verification: on every skill install

Enterprise:
  - RBAC: attribute-based, tenant-scoped
  - SSO: SAML, OIDC, LDAP
  - Audit log: immutable, queryable, exportable
  - SLA: 99.9% uptime for security services
```