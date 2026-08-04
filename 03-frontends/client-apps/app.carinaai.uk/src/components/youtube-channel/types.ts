export const PROPERTY_CHANNEL_STEP_IDS = [
  'channel-provision',
  'niche-research',
  'script-generation',
  'media-pipeline',
  'youtube-upload',
  'comment-monitor',
  'analytics-report',
] as const;

export type PropertyChannelStepId = (typeof PROPERTY_CHANNEL_STEP_IDS)[number];

export const PROPERTY_CHANNEL_STEP_LABELS: Record<PropertyChannelStepId, string> = {
  'channel-provision': 'Connect channel',
  'niche-research': 'Niche research',
  'script-generation': 'Script generation',
  'media-pipeline': 'Media rendering',
  'youtube-upload': 'YouTube upload',
  'comment-monitor': 'Comment monitoring',
  'analytics-report': 'Analytics report',
};

export type PropertyChannelRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type PropertyChannelStepStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface PropertyChannelStepState {
  id: PropertyChannelStepId;
  status: PropertyChannelStepStatus;
  attempts: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
}

export interface PropertyChannelInput {
  workspaceId: string;
  domain?: ChannelDomainId;
  niche: ChannelNicheId;
  location: string;
  publishTime: string;
  channelId?: string;
}

export interface PropertyChannelRun {
  id: string;
  workspaceId: string;
  input: PropertyChannelInput;
  status: PropertyChannelRunStatus;
  currentStepIndex: number;
  steps: Record<PropertyChannelStepId, PropertyChannelStepState>;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ChannelDomainId = string;

export interface ChannelDomainDefinition {
  id: ChannelDomainId;
  label: string;
  description: string;
  focusLabel: string;
  focusPlaceholder: string;
}

export type ChannelNicheId = string;

export interface ChannelNicheDefinition {
  id: ChannelNicheId;
  domainId: ChannelDomainId;
  label: string;
  description: string;
  keywords: string[];
  weeklyThemes: string[];
  hookTemplates: string[];
  ctaTemplates: string[];
}

/** @deprecated Prefer ChannelNicheDefinition */
export type PropertyNicheDefinition = ChannelNicheDefinition;
export type PropertyNicheId = string;

export interface StructuredScript {
  hook: string;
  body: string[];
  cta: string;
  estimatedDurationSeconds: number;
}

export interface GeneratedVideoItem {
  dayIndex: number;
  date: string;
  niche: ChannelNicheId;
  theme: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailPrompt: string;
  script: StructuredScript;
}

export type RenderJobStatus = 'queued' | 'rendering' | 'ready' | 'failed' | 'uploaded';

export interface RenderJobAssets {
  voiceoverPath?: string;
  visualsManifestPath?: string;
  thumbnailPath?: string;
  videoManifestPath?: string;
  videoPath?: string;
}

export interface RenderJob {
  id: string;
  workspaceId: string;
  channelId: string;
  dayIndex: number;
  title: string;
  scriptText: string;
  thumbnailPrompt: string;
  status: RenderJobStatus;
  progress: number;
  assets: RenderJobAssets;
  youtubeVideoId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type LeadClassification = 'hot_lead' | 'warm_lead' | 'cold_lead' | 'spam';

export type LeadRoutingDestination =
  | 'sourcing_funnel'
  | 'joint_venture_calls'
  | 'training_pipeline'
  | 'none';

export interface DetectedContactInfo {
  email?: string;
  phone?: string;
  website?: string;
}

export interface YouTubeLead {
  id: string;
  workspaceId: string;
  channelId: string;
  commentId: string;
  videoId: string;
  authorDisplayName: string;
  text: string;
  classification: LeadClassification;
  signals: string[];
  contactInfo: DetectedContactInfo;
  destination: LeadRoutingDestination;
  status: 'new' | 'routed' | 'responded' | 'handled';
  createdAt: string;
  updatedAt: string;
}

export interface YouTubeVideoStats {
  videoId: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  averageViewDurationSeconds: number;
  publishedAt: string;
}

export interface ChannelDashboard {
  channelId: string;
  subscriberCount: number;
  subscriberGrowthRate: number;
  totalViews: number;
  viewTrend7d: number;
  viewTrend30d: number;
  averageViewDuration: number;
  retentionRate: number;
  clickThroughRate: number;
  topVideos: YouTubeVideoStats[];
  leadCounts: Record<LeadClassification, number>;
  leadToSubscriberConversionRate: number;
  estimatedRevenueFromLeads: number;
  quota: { used: number; limit: number; remaining: number };
  generatedAt: string;
}

export interface WeeklyReport {
  channelId: string;
  weekStart: string;
  weekEnd: string;
  viewsThisWeek: number;
  viewsPreviousWeek: number;
  viewChangePercent: number;
  subscribersGained: number;
  topVideo: YouTubeVideoStats | null;
  leadSummary: Record<LeadClassification, number>;
  recommendations: string[];
  generatedAt: string;
}

export interface QuotaUsage {
  channelId: string;
  date: string;
  used: number;
  limit: number;
  remaining: number;
}
