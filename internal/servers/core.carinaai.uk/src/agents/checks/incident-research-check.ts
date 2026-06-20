import type { CheckResult } from './email-check.js';
import { getPublishedIncidents } from '../../blog/store.js';
import { buildResearchPrompt } from '../../blog/research-runner.js';

export async function checkIncidentResearch(): Promise<CheckResult> {
  const now = new Date();
  if (now.getUTCDay() !== 0) {
    return { name: 'incident-research', urgent: false, summary: null };
  }

  const published = await getPublishedIncidents();
  const existingSummary = published
    .map((incident) => `- ${incident.title} (${incident.company}, ${incident.dateOccurred}). Sources: ${incident.sources.map((source) => source.url).join(', ')}`)
    .join('\n');

  return {
    name: 'incident-research',
    urgent: false,
    summary: `INCIDENT RESEARCH SLOT -- Sunday check.\n\n${buildResearchPrompt()}\n\nEXISTING INCIDENTS:\n${existingSummary || 'None yet.'}`,
  };
}
