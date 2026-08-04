export interface AmbientChannelMessage {
  channelId: string;
  channelName: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
  threadTs?: string;
  isPinned: boolean;
  hasFiles: boolean;
  reactions: string[];
  permalink: string;
}

export type ChannelFactType =
  | 'decision'
  | 'deadline'
  | 'person_working_on'
  | 'status_update'
  | 'blocker'
  | 'metric'
  | 'project_reference'
  | 'contact'
  | 'link'
  | 'knowledge_gap';

export type StaleAfter = '24h' | '7d' | '30d' | 'manual';

export interface ExtractedChannelFact {
  type: ChannelFactType;
  summary: string;
  detail: string;
  confidence: number;
  sourceMessages: string[];
  entities: {
    people?: string[];
    projects?: string[];
    dates?: string[];
    metrics?: { name: string; value: string }[];
  };
  staleAfter?: StaleAfter;
}

export interface ChannelContextFactRecord {
  id: string;
  scope: string;
  scopeName: string;
  summary: string;
  content: string;
  factType: ChannelFactType;
  confidence: number;
  metadata: Record<string, unknown>;
  extractedAt: string;
  createdAt: string;
}

export interface ChannelMemoryQuery {
  scope?: string;
  scopePrefix?: string;
  scopeNot?: string;
  factType?: ChannelFactType;
  search?: string;
  orderBy?: 'extracted_at' | 'created_at';
  order?: 'ASC' | 'DESC';
  limit?: number;
}

export interface AmbientCheck {
  type: 'stale_thread' | 'approaching_deadline' | 'blocker_unresolved' | 'knowledge_gap' | 'cross_channel_signal';
  priority: 'high' | 'medium' | 'low';
  channelId: string;
  channelName: string;
  message: string;
  sourceFactIds: string[];
  suggestedAction?: string;
}

export interface AmbientChannel {
  id: string;
  name: string;
}
