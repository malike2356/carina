import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { chainOfCustody, _resetCustodyLogForTests } from './chain-of-custody.js';
import { _clearFrozenIncidentsForTests } from './evidence-capture.js';
import { forensicsEngine } from './engine.js';
import { _resetIncidentResponseStateForTests } from './incident-response.js';
import { formatForensicReportMarkdown } from './export.js';
import { _resetForensicsStoreForTests } from './store.js';

describe('forensics chain of custody', () => {
  beforeEach(async () => {
    process.env.CARINA_HOME = path.join(os.tmpdir(), `carina-forensics-${Date.now()}`);
    await _resetForensicsStoreForTests();
    await _resetCustodyLogForTests();
  });

  afterEach(async () => {
    _resetIncidentResponseStateForTests();
    _clearFrozenIncidentsForTests();
  });

  it('builds a verifiable hash chain', async () => {
    await chainOfCustody.record({
      evidenceId: 'evidence-1',
      action: 'created',
      actor: 'tester',
      actorRole: 'auditor',
      timestamp: Date.now(),
      reason: 'unit test create',
    });
    await chainOfCustody.record({
      evidenceId: 'evidence-1',
      action: 'accessed',
      actor: 'tester',
      actorRole: 'auditor',
      timestamp: Date.now(),
      reason: 'unit test read',
    });
    const verification = await chainOfCustody.verify();
    expect(verification.valid).toBe(true);
  });
});

describe('ForensicsEngine', () => {
  beforeEach(async () => {
    process.env.CARINA_HOME = path.join(os.tmpdir(), `carina-forensics-${Date.now()}`);
    await _resetForensicsStoreForTests();
    await _resetCustodyLogForTests();
  });

  afterEach(async () => {
    _resetIncidentResponseStateForTests();
    _clearFrozenIncidentsForTests();
  });

  it('creates incident, captures snapshot, timeline, and export package', async () => {
    const incident = await forensicsEngine.createIncident({
      title: 'Test injection incident',
      severity: 'critical',
      sessionId: 'sess-forensics-1',
      triggerEventTypes: ['prompt_injection'],
    });

    const snapshot = await forensicsEngine.captureSnapshot(incident.id, {
      sessionId: 'sess-forensics-1',
      activeTools: ['file-read'],
    });
    expect(snapshot.incidentId).toBe(incident.id);
    expect(snapshot.hash).toHaveLength(64);

    const timeline = await forensicsEngine.reconstructTimeline(incident.id);
    expect(Array.isArray(timeline)).toBe(true);

    const report = await forensicsEngine.generateReport(incident.id);
    expect(report.incident.id).toBe(incident.id);
    expect(report.rootCause.attackPath.length).toBeGreaterThan(0);
    expect(formatForensicReportMarkdown(report)).toContain('Forensic Incident Report');

    const files = await forensicsEngine.exportEvidence(incident.id, 'all');
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const file of files) {
      await expect(fs.access(file)).resolves.toBeUndefined();
    }
  });

  it('runs prompt injection playbook with automated steps', async () => {
    const incident = await forensicsEngine.createIncident({
      title: 'Prompt injection',
      severity: 'critical',
      sessionId: 'sess-playbook-1',
    });

    const execution = await forensicsEngine.runPlaybook('prompt-injection', {
      incidentId: incident.id,
      sessionId: 'sess-playbook-1',
    });

    expect(execution.status).toBe('completed');
    expect(execution.stepsCompleted).toBeGreaterThan(0);
    const updated = await forensicsEngine.getIncident(incident.id);
    expect(updated?.status).toBe('investigating');
  });

  it('lists incidents and playbooks', async () => {
    await forensicsEngine.createIncident({
      title: 'Listed incident',
      severity: 'high',
    });
    const incidents = await forensicsEngine.listIncidents();
    expect(incidents.length).toBeGreaterThan(0);
    expect(forensicsEngine.listPlaybooks().length).toBeGreaterThanOrEqual(5);
    expect(forensicsEngine.getPlaybook('data-exfiltration')?.name).toContain('Exfiltration');
  });
});
