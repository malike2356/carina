import { Badge } from '@/components/ui/Badge';
import type {
  LeadClassification,
  PropertyChannelRunStatus,
  PropertyChannelStepStatus,
  RenderJobStatus,
} from './types';

export function RunStatusBadge({ status }: { status: PropertyChannelRunStatus }) {
  const variant =
    status === 'succeeded' || status === 'running'
      ? 'active'
      : status === 'failed'
        ? 'error'
        : status === 'paused' || status === 'cancelled'
          ? 'paused'
          : 'draft';
  return <Badge variant={variant}>{status}</Badge>;
}

export function StepStatusBadge({ status }: { status: PropertyChannelStepStatus }) {
  const variant =
    status === 'succeeded' ? 'active' : status === 'failed' ? 'error' : status === 'running' ? 'running' : 'draft';
  return <Badge variant={variant}>{status}</Badge>;
}

export function RenderJobStatusBadge({ status }: { status: RenderJobStatus }) {
  const variant =
    status === 'ready' || status === 'uploaded'
      ? 'active'
      : status === 'failed'
        ? 'error'
        : status === 'rendering'
          ? 'running'
          : 'draft';
  return <Badge variant={variant}>{status}</Badge>;
}

const LEAD_LABELS: Record<LeadClassification, string> = {
  hot_lead: 'Hot lead',
  warm_lead: 'Warm lead',
  cold_lead: 'Cold lead',
  spam: 'Spam',
};

export function LeadClassificationBadge({ classification }: { classification: LeadClassification }) {
  const variant =
    classification === 'hot_lead' ? 'error' : classification === 'warm_lead' ? 'running' : classification === 'spam' ? 'paused' : 'draft';
  return <Badge variant={variant}>{LEAD_LABELS[classification]}</Badge>;
}
