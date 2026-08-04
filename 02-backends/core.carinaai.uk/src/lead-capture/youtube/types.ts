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

export interface LeadDetectionResult {
  classification: LeadClassification;
  signals: string[];
  contactInfo: DetectedContactInfo;
  confidence: number;
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

export interface PolledComment {
  id: string;
  videoId: string;
  authorDisplayName: string;
  text: string;
  publishedAt: string;
}
