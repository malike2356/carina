import type { YouTubeVideoStats } from '../../connectors/youtube/types.js';
import type { LeadClassification } from '../../lead-capture/youtube/types.js';

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

export interface ChannelSnapshot {
  channelId: string;
  date: string;
  subscriberCount: number;
  viewCount: number;
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
