export type SBOMPackage = {
  spdxId: string;
  name: string;
  version: string;
  downloadLocation: string;
  licenseConcluded: string;
  checksums: Array<{ algorithm: string; checksumValue: string }>;
  externalRefs: Array<{ referenceCategory: string; referenceType: string; referenceLocator: string }>;
};

export type SBOMRelationship = {
  spdxElementId: string;
  relatedSpdxElement: string;
  relationshipType: string;
};

export type SBOM = {
  spdxVersion: 'SPDX-2.3';
  dataLicense: 'CC0-1.0';
  SPDXID: string;
  name: string;
  documentNamespace: string;
  creationInfo: {
    created: string;
    creators: string[];
  };
  packages: SBOMPackage[];
  relationships: SBOMRelationship[];
};

export type DependencyFinding = {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  module: string;
  title: string;
  url?: string;
  recommendation: string;
};

export type DependencyScanReport = {
  scannedAt: string;
  projectRoot: string;
  findings: DependencyFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  verdict: 'clean' | 'warning' | 'blocked';
};

export type ProvenanceVerdict = 'allowed' | 'warning' | 'blocked';

export type ProvenanceCheck = {
  skillName: string;
  version: string;
  sourcePath?: string;
  checks: {
    signatureVerified: boolean;
    hashMatch: boolean;
    hubVerified: boolean;
    authorTrusted: boolean;
    scannerPassed: boolean;
  };
  flags: string[];
  verdict: ProvenanceVerdict;
  recommendation: string;
};

export type SupplyChainReport = {
  generatedAt: string;
  sbom?: SBOM;
  dependencyScan?: DependencyScanReport;
};
