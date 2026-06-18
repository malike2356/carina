# Security 06; Supply Chain Security (SBOM + Dependency Scan + Provenance)

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Source:** NEW (OpenClaw has partial; dependency patching/overrides)
**Effort:** 3 weeks

## SPECIFICATION

Complete supply chain security: SBOM generation, dependency vulnerability scanning, provenance verification for every skill and plugin installed. Know exactly what code runs in Carina.

### Implementation

```typescript
// security/supply-chain/sbom.ts
// Generate SPDX-compliant Software Bill of Materials

interface SBOM {
  spdxVersion: 'SPDX-2.3';
  name: 'Carina';
  packages: SBOMPackage[];
  relationships: SBOMRelationship[];
}

// security/supply-chain/dependency-scan.ts
// Scan all dependencies for known vulnerabilities
// Integrate: npm audit, OSS Review Toolkit, GitHub Advisory DB
// Block install if critical vulns found

// security/supply-chain/provenance.ts
// Verify skill/plugin provenance before install
// Check: author signature, integrity hash, CarinaHub verification status
// Block: unsigned, tampered, or unverified packages

interface ProvenanceCheck {
  skillName: string;
  version: string;
  checks: {
    signatureVerified: boolean;
    hashMatch: boolean;
    hubVerified: boolean;
    authorTrusted: boolean;
    scannerPassed: boolean;
  };
  verdict: 'allowed' | 'warning' | 'blocked';
}
```

### CLI Commands

```
carina security sbom generate; generate SBOM
carina security sbom export --format json; export SBOM
carina security deps scan; scan dependencies
carina security deps audit; full dependency audit
carina security provenance check <skill>; verify skill provenance
```

### CI Integration

```yaml
# .github/workflows/supply-chain.yml
name: Supply Chain Security
on: [push, pull_request]
jobs:
  sbom:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: carina security sbom generate
      - run: carina security deps scan --fail-on critical
      - uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.spdx.json
```