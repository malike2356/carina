import {
  assertUniqueCalendar,
  generateYearCalendarAsync,
} from '../../../../content/script-generator/generator.js';
import { getCalendar, saveCalendar } from '../../../../content/script-generator/store.js';
import { resolveScriptMode } from '../../../../content/script-generator/llm-scripts.js';
import { config } from '../../../../config/index.js';
import type { PropertyChannelRun } from '../types.js';

export interface ScriptGenerationOutput extends Record<string, unknown> {
  totalGenerated: number;
  firstSevenTitles: string[];
  scriptMode: string;
}

/**
 * Generates the content calendar and persists it. Idempotent: if a calendar
 * already exists for this workspace/channel at the target length, reuse it.
 * Uses PROPERTY_CHANNEL_SCRIPT_MODE=template|llm (template is default/CI-safe).
 */
export async function runScriptGeneration(run: PropertyChannelRun): Promise<ScriptGenerationOutput> {
  const channelId = (run.context['channel-provision'] as { channelId?: string } | undefined)?.channelId
    ?? run.input.channelId
    ?? 'pending';

  const existing = getCalendar(run.workspaceId, channelId);
  const totalDays = config.propertyChannel.maxVideosPerBatch;
  const scriptMode = resolveScriptMode();

  if (existing.length >= totalDays) {
    return {
      totalGenerated: existing.length,
      firstSevenTitles: existing.slice(0, 7).map((item) => item.title),
      scriptMode: existing[0]?.scriptMode ?? scriptMode,
    };
  }

  const items = await generateYearCalendarAsync(
    {
      niche: run.input.niche,
      location: run.input.location,
      startDate: new Date().toISOString().slice(0, 10),
      totalDays,
    },
    30,
  );
  assertUniqueCalendar(items);
  saveCalendar(run.workspaceId, channelId, items);

  return {
    totalGenerated: items.length,
    firstSevenTitles: items.slice(0, 7).map((item) => item.title),
    scriptMode,
  };
}
