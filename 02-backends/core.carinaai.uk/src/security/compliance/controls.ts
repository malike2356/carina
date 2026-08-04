import type { ComplianceControl, ComplianceFramework, ComplianceFrameworkId } from './types.js';

export const COMPLIANCE_FRAMEWORKS: Record<ComplianceFrameworkId, ComplianceFramework> = {
  soc2: {
    id: 'soc2',
    name: 'SOC 2 Trust Services Criteria',
    description: 'Security, availability, confidentiality, processing integrity, privacy',
  },
  iso27001: {
    id: 'iso27001',
    name: 'ISO 27001 Annex A',
    description: 'Information security management controls',
  },
  gdpr: {
    id: 'gdpr',
    name: 'GDPR',
    description: 'EU data protection regulation controls',
  },
};

export const COMPLIANCE_CONTROLS: ComplianceControl[] = [
  // SOC 2
  {
    id: 'soc2-cc6.1',
    framework: 'soc2',
    name: 'Logical access controls',
    collectorId: 'rbac_config',
    description: 'RBAC and tool access restrictions',
  },
  {
    id: 'soc2-cc6.6',
    framework: 'soc2',
    name: 'Encryption and key management',
    collectorId: 'encryption_config',
  },
  {
    id: 'soc2-cc7.1',
    framework: 'soc2',
    name: 'Change management',
    collectorId: 'security_review_posture',
  },
  {
    id: 'soc2-cc7.2',
    framework: 'soc2',
    name: 'System monitoring',
    collectorId: 'audit_log_sample',
  },
  {
    id: 'soc2-cc8.1',
    framework: 'soc2',
    name: 'Penetration testing',
    collectorId: 'pentest_posture',
  },
  {
    id: 'soc2-cc9.1',
    framework: 'soc2',
    name: 'Risk mitigation (supply chain)',
    collectorId: 'supply_chain_status',
  },
  {
    id: 'soc2-cc6.7',
    framework: 'soc2',
    name: 'Credential lifecycle',
    collectorId: 'secrets_rotation_status',
  },
  // ISO 27001
  {
    id: 'iso-a.5.1',
    framework: 'iso27001',
    name: 'Policies for information security',
    collectorId: 'trust_compliance_snapshot',
  },
  {
    id: 'iso-a.9.2',
    framework: 'iso27001',
    name: 'User access management',
    collectorId: 'rbac_config',
  },
  {
    id: 'iso-a.12.4',
    framework: 'iso27001',
    name: 'Event logging',
    collectorId: 'audit_log_sample',
  },
  {
    id: 'iso-a.12.6.1',
    framework: 'iso27001',
    name: 'Vulnerability management',
    collectorId: 'pentest_posture',
  },
  {
    id: 'iso-a.14.2',
    framework: 'iso27001',
    name: 'Security in development',
    collectorId: 'security_review_posture',
  },
  {
    id: 'iso-a.8.9',
    framework: 'iso27001',
    name: 'Configuration management',
    collectorId: 'supply_chain_status',
  },
  {
    id: 'iso-a.10.1',
    framework: 'iso27001',
    name: 'Cryptographic controls',
    collectorId: 'encryption_config',
  },
  {
    id: 'iso-a.16.1',
    framework: 'iso27001',
    name: 'Incident management',
    collectorId: 'forensics_pipeline',
  },
  // GDPR
  {
    id: 'gdpr-art6',
    framework: 'gdpr',
    name: 'Lawful basis for processing',
    collectorId: 'data_processing_registry',
  },
  {
    id: 'gdpr-art13',
    framework: 'gdpr',
    name: 'Transparency (privacy information)',
    collectorId: 'data_processing_registry',
  },
  {
    id: 'gdpr-art15',
    framework: 'gdpr',
    name: 'Right of access (DSAR)',
    collectorId: 'dsar_capability',
  },
  {
    id: 'gdpr-art17',
    framework: 'gdpr',
    name: 'Right to erasure',
    collectorId: 'dsar_capability',
  },
  {
    id: 'gdpr-art20',
    framework: 'gdpr',
    name: 'Data portability',
    collectorId: 'dsar_capability',
  },
  {
    id: 'gdpr-art25',
    framework: 'gdpr',
    name: 'Data protection by design',
    collectorId: 'trust_compliance_snapshot',
  },
  {
    id: 'gdpr-art30',
    framework: 'gdpr',
    name: 'Records of processing activities',
    collectorId: 'data_processing_registry',
  },
  {
    id: 'gdpr-art32',
    framework: 'gdpr',
    name: 'Security of processing',
    collectorId: 'encryption_config',
  },
  {
    id: 'gdpr-art33',
    framework: 'gdpr',
    name: 'Breach notification to authority',
    collectorId: 'breach_notification_capability',
  },
  {
    id: 'gdpr-art34',
    framework: 'gdpr',
    name: 'Communication to data subjects',
    collectorId: 'breach_notification_capability',
  },
];

export function getFramework(id: ComplianceFrameworkId): ComplianceFramework {
  return COMPLIANCE_FRAMEWORKS[id];
}

export function getControls(framework: ComplianceFrameworkId): ComplianceControl[] {
  return COMPLIANCE_CONTROLS.filter((row) => row.framework === framework);
}

export function parseFrameworkArg(raw?: string): ComplianceFrameworkId | 'all' {
  const value = (raw ?? 'all').trim().toLowerCase();
  if (value === 'all') return 'all';
  if (value === 'soc2' || value === 'soc' || value === 'soc-2') return 'soc2';
  if (value === 'iso' || value === 'iso27001' || value === 'iso-27001') return 'iso27001';
  if (value === 'gdpr') return 'gdpr';
  throw new Error(`Unknown framework: ${raw}. Use soc2, iso, gdpr, or all.`);
}
