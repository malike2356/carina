-- Reference schema for hosted forensic storage.
-- Local Carina installs use append-only JSONL under $CARINA_HOME/data/forensics/.

CREATE TABLE IF NOT EXISTS forensic_incidents (
  id UUID PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  detected_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP,
  session_id UUID,
  agent_id VARCHAR(255),
  classification VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forensic_snapshots (
  id UUID PRIMARY KEY,
  incident_id UUID REFERENCES forensic_incidents(id),
  captured_at TIMESTAMP NOT NULL,
  captured_by VARCHAR(255) NOT NULL,
  agent_state JSONB NOT NULL,
  system_state JSONB NOT NULL,
  security_state JSONB NOT NULL,
  artifact_hashes JSONB NOT NULL,
  hash VARCHAR(128) NOT NULL
);

CREATE TABLE IF NOT EXISTS forensic_custody_log (
  id UUID PRIMARY KEY,
  evidence_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  reason TEXT,
  previous_hash VARCHAR(128) NOT NULL,
  hash VARCHAR(128) NOT NULL,
  written_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forensic_timeline_events (
  id UUID PRIMARY KEY,
  incident_id UUID REFERENCES forensic_incidents(id),
  timestamp TIMESTAMP NOT NULL,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  source VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  details JSONB,
  related_events UUID[],
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forensic_playbook_executions (
  id UUID PRIMARY KEY,
  incident_id UUID REFERENCES forensic_incidents(id),
  playbook_id VARCHAR(100) NOT NULL,
  playbook_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  steps_completed INTEGER DEFAULT 0,
  steps_total INTEGER NOT NULL,
  automated_only BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_incidents_severity ON forensic_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON forensic_incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_detected ON forensic_incidents(detected_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_incident ON forensic_snapshots(incident_id);
CREATE INDEX IF NOT EXISTS idx_custody_evidence ON forensic_custody_log(evidence_id);
CREATE INDEX IF NOT EXISTS idx_timeline_incident ON forensic_timeline_events(incident_id);
CREATE INDEX IF NOT EXISTS idx_timeline_timestamp ON forensic_timeline_events(timestamp);
