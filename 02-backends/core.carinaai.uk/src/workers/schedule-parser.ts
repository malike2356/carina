import { llm } from '../brain/llm.js';

export interface ParsedSchedule {
  cronExpression: string;
  scheduleLabel: string;
}

const FALLBACK_CRON = '0 8 * * *';
const FALLBACK_LABEL = 'Every day at 8 am';

export async function parseScheduleText(scheduleText: string): Promise<ParsedSchedule> {
  const prompt = [
    'Convert the following plain-English schedule into a valid 5-field cron expression.',
    'Respond with JSON only: {"cronExpression":"...","scheduleLabel":"..."}',
    'Use standard cron (minute hour day month weekday).',
    `Schedule: ${scheduleText}`,
  ].join('\n');

  try {
    const response = await llm.chatCheap([{ role: 'user', content: prompt, timestamp: new Date() }]);
    const text = response.content.trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
        cronExpression?: string;
        scheduleLabel?: string;
      };
      if (parsed.cronExpression && parsed.scheduleLabel) {
        return {
          cronExpression: parsed.cronExpression.trim(),
          scheduleLabel: parsed.scheduleLabel.trim(),
        };
      }
    }
  } catch {
    // fall through to defaults
  }

  return { cronExpression: FALLBACK_CRON, scheduleLabel: FALLBACK_LABEL };
}
