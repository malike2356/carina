import { chainOfCustody } from './chain-of-custody.js';
import { evidenceCapture } from './evidence-capture.js';
import { generateForensicReport, writeForensicExport } from './export.js';
import { runPlaybook, openIncidentFromSecurityEvent } from './incident-response.js';
import { FORENSIC_PLAYBOOKS, getPlaybook } from './playbooks.js';
import {
  createIncident,
  getIncident,
  listIncidents,
  listPlaybookExecutions,
  loadSnapshotForIncident,
  loadTimeline,
} from './store.js';
import { timelineReconstructor } from './timeline-reconstructor.js';
import type { ForensicIncident, ForensicSnapshot, TimelineEvent } from './types.js';

export class ForensicsEngine {
  async createIncident(input: {
    title: string;
    severity: ForensicIncident['severity'];
    sessionId?: string;
    agentId?: string;
    classification?: string;
    triggerEventTypes?: string[];
  }): Promise<ForensicIncident> {
    return createIncident(input);
  }

  async listIncidents(limit = 50): Promise<ForensicIncident[]> {
    return listIncidents(limit);
  }

  async getIncident(incidentId: string): Promise<ForensicIncident | null> {
    return getIncident(incidentId);
  }

  async captureSnapshot(
    incidentId: string,
    options: {
      sessionId?: string;
      agentId?: string;
      modelId?: string;
      providerId?: string;
      activeTools?: string[];
    } = {},
  ): Promise<ForensicSnapshot> {
    const incident = await getIncident(incidentId);
    if (!incident) throw new Error(`Incident not found: ${incidentId}`);
    return evidenceCapture.captureSnapshot(incidentId, options);
  }

  async reconstructTimeline(
    incidentId: string,
    startTime?: number,
    endTime?: number,
  ): Promise<TimelineEvent[]> {
    const incident = await getIncident(incidentId);
    if (!incident) throw new Error(`Incident not found: ${incidentId}`);
    const snapshot = await loadSnapshotForIncident(incidentId);
    const anchor = snapshot?.timestamp ?? incident.detectedAt;
    return timelineReconstructor.reconstruct(
      incidentId,
      startTime ?? anchor - 3_600_000,
      endTime ?? anchor + 3_600_000,
      incident.sessionId,
    );
  }

  async generateReport(incidentId: string) {
    return generateForensicReport(incidentId);
  }

  async exportEvidence(incidentId: string, format: 'json' | 'csv' | 'markdown' | 'all' = 'all') {
    return writeForensicExport(incidentId, format);
  }

  async verifyCustody() {
    return chainOfCustody.verify();
  }

  listPlaybooks() {
    return FORENSIC_PLAYBOOKS;
  }

  getPlaybook(playbookId: string) {
    return getPlaybook(playbookId);
  }

  runPlaybook(playbookId: string, options: Parameters<typeof runPlaybook>[1] = {}) {
    return runPlaybook(playbookId, options);
  }

  openFromSecurityEvent(input: Parameters<typeof openIncidentFromSecurityEvent>[0]) {
    return openIncidentFromSecurityEvent(input);
  }

  async getTimeline(incidentId: string) {
    return loadTimeline(incidentId);
  }

  async getSnapshot(incidentId: string) {
    return loadSnapshotForIncident(incidentId);
  }

  async listExecutions(incidentId?: string) {
    return listPlaybookExecutions(incidentId);
  }
}

export const forensicsEngine = new ForensicsEngine();
