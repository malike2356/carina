import type pg from 'pg';

export async function runComplianceVisibilityMigration(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS compliance_controls (
      id TEXT PRIMARY KEY,
      criteria_group TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS compliance_evidence (
      id TEXT PRIMARY KEY,
      control_id TEXT NOT NULL REFERENCES compliance_controls(id),
      evidence_type TEXT NOT NULL,
      source_agent_id TEXT,
      source_tool TEXT,
      description TEXT NOT NULL,
      raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      content_hash TEXT NOT NULL,
      merkle_leaf_index INTEGER,
      merkle_proof JSONB,
      blockchain_tx TEXT,
      collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_evidence_control
      ON compliance_evidence (control_id, collected_at DESC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_evidence_collected
      ON compliance_evidence (collected_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS compliance_auditor_links (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed_at TIMESTAMPTZ,
      revoked BOOLEAN NOT NULL DEFAULT FALSE,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_auditor_links_token
      ON compliance_auditor_links (token)
      WHERE revoked = FALSE
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS compliance_digest_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    INSERT INTO compliance_controls (id, criteria_group, name, description, sort_order) VALUES
      ('CC1.1', 'CC1', 'Control Environment', 'Entity-level controls and ethical values', 1),
      ('CC1.2', 'CC1', 'Board Oversight', 'Board independence and oversight of controls', 2),
      ('CC1.3', 'CC1', 'Management Authority', 'Structure, authority, and responsibility', 3),
      ('CC1.4', 'CC1', 'Competence Commitment', 'Commitment to attract and develop competent staff', 4),
      ('CC1.5', 'CC1', 'Accountability', 'Individual accountability for control responsibilities', 5),
      ('CC2.1', 'CC2', 'Communication Objectives', 'Internal communication of control objectives', 6),
      ('CC2.2', 'CC2', 'External Communication', 'Communication with external parties', 7),
      ('CC2.3', 'CC2', 'Information Requirements', 'Identification of information requirements', 8),
      ('CC3.1', 'CC3', 'Risk Identification', 'Identification and analysis of risks', 9),
      ('CC3.2', 'CC3', 'Risk Severity', 'Assessment of risk severity and likelihood', 10),
      ('CC3.3', 'CC3', 'Fraud Risk', 'Consideration of fraud risks', 11),
      ('CC3.4', 'CC3', 'Change Impact', 'Identification of significant changes affecting controls', 12),
      ('CC4.1', 'CC4', 'Ongoing Monitoring', 'Ongoing evaluations of controls', 13),
      ('CC4.2', 'CC4', 'Deficiency Communication', 'Communication of control deficiencies', 14),
      ('CC5.1', 'CC5', 'Control Selection', 'Selection and development of control activities', 15),
      ('CC5.2', 'CC5', 'Technology Controls', 'General technology control activities', 16),
      ('CC5.3', 'CC5', 'Policy Deployment', 'Deployment of control activities through policies', 17),
      ('CC6.1', 'CC6', 'Access Control', 'Logical and physical access controls', 18),
      ('CC6.2', 'CC6', 'User Identification', 'Identification and authentication of users', 19),
      ('CC6.3', 'CC6', 'Authorization', 'Authorization of access to system resources', 20),
      ('CC6.4', 'CC6', 'Data Protection', 'Protection of data at rest and in transit', 21),
      ('CC6.5', 'CC6', 'Removal of Access', 'Timely removal of access when no longer required', 22),
      ('CC6.6', 'CC6', 'Network Security', 'Security of network and communication paths', 23),
      ('CC6.7', 'CC6', 'Malicious Software', 'Protection against malicious software', 24),
      ('CC6.8', 'CC6', 'Vulnerability Management', 'Management of system vulnerabilities', 25),
      ('CC7.1', 'CC7', 'System Monitoring', 'Monitoring of system operations', 26),
      ('CC7.2', 'CC7', 'Incident Response', 'Detection and response to security incidents', 27),
      ('CC7.3', 'CC7', 'Capacity Management', 'Management of system capacity and availability', 28),
      ('CC7.4', 'CC7', 'Backup and Recovery', 'Backup and recovery procedures', 29),
      ('CC7.5', 'CC7', 'Change Management', 'Management of system changes', 30),
      ('CC8.1', 'CC8', 'Change Authorization', 'Authorization of system changes', 31)
    ON CONFLICT (id) DO NOTHING
  `);
}
