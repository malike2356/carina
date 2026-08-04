import {
  cancelPropertyChannelRun,
  createPropertyChannelRun,
  getPropertyChannelRun,
  pausePropertyChannelRun,
  resumePropertyChannelRun,
  runRecurringStep,
  runStepOnce,
  saveRun,
} from './store.js';
import { checkOrProvisionChannel } from './steps/channel-provision.js';
import { runNicheResearch } from './steps/niche-research.js';
import { runScriptGeneration } from './steps/script-generation.js';
import { runMediaPipeline } from './steps/media-pipeline.js';
import { runYouTubeUpload } from './steps/youtube-upload.js';
import { runCommentMonitor } from './steps/comment-monitor.js';
import { runAnalyticsReport } from './steps/analytics-report.js';
import type { PropertyChannelInput, PropertyChannelRun, PropertyChannelStepId } from './types.js';

interface StepGraphNode {
  id: PropertyChannelStepId;
  label: string;
  kind: 'once' | 'recurring';
  needs: PropertyChannelStepId[];
}

const PROPERTY_CHANNEL_STEP_GRAPH: StepGraphNode[] = [
  { id: 'channel-provision', label: 'Connect or verify the YouTube channel', kind: 'once', needs: [] },
  { id: 'niche-research', label: 'Research the niche and build a content calendar', kind: 'once', needs: ['channel-provision'] },
  { id: 'script-generation', label: 'Generate a year of scripts and metadata', kind: 'once', needs: ['niche-research'] },
  { id: 'media-pipeline', label: 'Render voiceover, visuals, and thumbnails', kind: 'recurring', needs: ['script-generation'] },
  { id: 'youtube-upload', label: 'Upload and schedule videos within quota', kind: 'recurring', needs: ['media-pipeline'] },
  { id: 'comment-monitor', label: 'Poll comments and route leads', kind: 'recurring', needs: ['channel-provision'] },
  { id: 'analytics-report', label: 'Generate the weekly analytics report', kind: 'recurring', needs: ['channel-provision'] },
];

/** Step graph: one-time setup steps run once and are skipped forever after;
 * recurring steps re-run every advance call (each internally idempotent). */
export const PROPERTY_CHANNEL_WORKFLOW_TEMPLATE = {
  id: 'property-channel',
  name: 'YouTube Channel',
  description:
    'Provisions and runs a faceless YouTube channel across selectable domains: research, script generation, ' +
    'media rendering, upload and scheduling, comment lead capture, and weekly analytics.',
  steps: PROPERTY_CHANNEL_STEP_GRAPH,
};

export function startPropertyChannelWorkflow(input: PropertyChannelInput): PropertyChannelRun {
  return createPropertyChannelRun(input);
}

export function getWorkflowRun(runId: string): PropertyChannelRun | undefined {
  return getPropertyChannelRun(runId);
}

export function pauseWorkflow(runId: string): PropertyChannelRun | null {
  return pausePropertyChannelRun(runId);
}

export function resumeWorkflow(runId: string): PropertyChannelRun | null {
  return resumePropertyChannelRun(runId);
}

export function cancelWorkflow(runId: string): PropertyChannelRun | null {
  return cancelPropertyChannelRun(runId);
}

export interface AdvanceOptions {
  mediaPipelineBatchSize?: number;
  now?: Date;
}

/**
 * Advances a run by one tick: performs the one-time setup steps in order
 * (each skipped once already succeeded) and then runs one pass of each
 * recurring step. Returns immediately without side effects if the run is
 * paused or cancelled, and pauses automatically if channel-provision is
 * still waiting on an interactive OAuth grant.
 */
export async function advancePropertyChannelWorkflow(
  runId: string,
  options: AdvanceOptions = {},
): Promise<PropertyChannelRun> {
  let run = getPropertyChannelRun(runId);
  if (!run) throw new Error(`YouTube Channel run ${runId} not found`);
  if (run.status === 'paused' || run.status === 'cancelled' || run.status === 'failed') return run;

  const provisionResult = await checkOrProvisionChannel(run);
  if (provisionResult.status === 'awaiting_oauth') {
    return saveRun({ ...run, status: 'paused' });
  }
  ({ run } = await runStepOnce(run, 'channel-provision', async () => provisionResult.output));

  ({ run } = await runStepOnce(run, 'niche-research', () => runNicheResearch(run!)));
  ({ run } = await runStepOnce(run, 'script-generation', () => runScriptGeneration(run!)));

  ({ run } = await runRecurringStep(run, 'media-pipeline', () =>
    runMediaPipeline(run!, options.mediaPipelineBatchSize)));
  ({ run } = await runRecurringStep(run, 'youtube-upload', () => runYouTubeUpload(run!)));
  ({ run } = await runRecurringStep(run, 'comment-monitor', () => runCommentMonitor(run!)));
  ({ run } = await runRecurringStep(run, 'analytics-report', () =>
    runAnalyticsReport(run!, { now: options.now })));

  if (run.status !== 'paused' && run.status !== 'cancelled') {
    run = saveRun({ ...run, status: 'running' });
  }
  return run;
}
