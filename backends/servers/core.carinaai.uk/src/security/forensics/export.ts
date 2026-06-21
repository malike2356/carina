import fs from 'node:fs/promises';
import path from 'node:path';
import { chainOfCustody } from './chain-of-custody.js';
import { analyzeRootCause } from './root-cause.js';
import { ensureExportDir, getIncident, loadSnapshotForIncident, loadTimeline } from './store.js';
import { timelineReconstructor } from './timeline-reconstructor.js';
import type { ForensicReport, TimelineEvent } from './types.js';

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatTimelineTable(events: TimelineEvent[]): string {
  if (events.length === 0) return 'No timeline events recorded.';
  const lines = [
    '| Time | Severity | Type | Source | Description |',
    '|------|----------|------|--------|-------------|',
  ];
  for (const event of events) {
    lines.push(`| ${new Date(event.timestamp).toISOString()} | ${event.severity} | ${event.type} | ${event.source} | ${event.description.replace(/\|/g, '/')} |`);
  }
  return lines.join('\n');
}

export async function generateForensicReport(incidentId: string): Promise<ForensicReport> {
  const incident = await getIncident(incidentId);
  if (!incident) throw new Error(`Incident not found: ${incidentId}`);

  const snapshot = await loadSnapshotForIncident(incidentId);
  const anchor = snapshot?.timestamp ?? incident.detectedAt;
  let timeline = await loadTimeline(incidentId);
  if (timeline.length === 0) {
    timeline = await timelineReconstructor.reconstruct(
      incidentId,
      anchor - 3_600_000,
      anchor + 3_600_000,
      incident.sessionId,
    );
  }

  const rootCause = analyzeRootCause(incident, timeline);
  const custodyVerification = await chainOfCustody.verify();

  return {
    incident,
    snapshot: snapshot ?? undefined,
    timeline,
    rootCause,
    custodyVerification,
    generatedAt: new Date().toISOString(),
  };
}

export function formatForensicReportMarkdown(report: ForensicReport): string {
  const lines = [
    `# Forensic Incident Report; ${report.incident.id}`,
    '',
    `Generated: ${report.generatedAt}`,
    `Classification: ${report.rootCause.classification}`,
    `Severity: ${report.incident.severity}`,
    `Status: ${report.incident.status}`,
    '',
    '## Executive Summary',
    `- Title: ${report.incident.title}`,
    `- Detected: ${new Date(report.incident.detectedAt).toISOString()}`,
    `- Session: ${report.incident.sessionId ?? 'n/a'}`,
    `- Chain of custody valid: ${report.custodyVerification.valid ? 'yes' : `no (broken at ${report.custodyVerification.brokenAt})`}`,
    '',
    '## Attack Path',
    ...report.rootCause.attackPath.map((step) => `- ${step}`),
    '',
    '## Impact Assessment',
    ...report.rootCause.impact.map((step) => `- ${step}`),
    '',
    '## Timeline',
    formatTimelineTable(report.timeline),
    '',
    '## Evidence',
  ];

  if (report.snapshot) {
    lines.push(`- Snapshot: ${report.snapshot.id} (${report.snapshot.hash.slice(0, 16)}...)`);
    for (const [name, artifact] of Object.entries(report.snapshot.artifacts)) {
      lines.push(`- ${name}: ${artifact.hash.slice(0, 16)}... (${artifact.size} bytes)`);
    }
  } else {
    lines.push('- No snapshot captured yet.');
  }

  lines.push('', '## Recommendations', ...report.rootCause.recommendations.map((step) => `- ${step}`));
  return lines.join('\n');
}

export async function writeForensicExport(
  incidentId: string,
  format: 'json' | 'csv' | 'markdown' | 'all',
): Promise<string[]> {
  const report = await generateForensicReport(incidentId);
  const dir = await ensureExportDir(incidentId);
  const written: string[] = [];

  if (format === 'json' || format === 'all') {
    const file = path.join(dir, 'report.json');
    await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8');
    written.push(file);
  }

  if (format === 'markdown' || format === 'all') {
    const file = path.join(dir, 'report.md');
    await fs.writeFile(file, formatForensicReportMarkdown(report), 'utf8');
    written.push(file);
  }

  if (format === 'csv' || format === 'all') {
    const file = path.join(dir, 'timeline.csv');
    const header = 'timestamp,severity,type,source,description\n';
    const rows = report.timeline.map((event) =>
      [
        new Date(event.timestamp).toISOString(),
        event.severity,
        event.type,
        event.source,
        event.description,
      ].map(escapeCsv).join(',')).join('\n');
    await fs.writeFile(file, header + rows + (rows ? '\n' : ''), 'utf8');
    written.push(file);
  }

  await chainOfCustody.record({
    evidenceId: incidentId,
    action: 'exported',
    actor: 'forensics-engine',
    actorRole: 'system',
    timestamp: Date.now(),
    reason: `Exported forensic report (${format})`,
  });

  return written;
}
