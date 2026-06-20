export interface SearchOptions {
  sources?: string[];
  limit?: number;
  sort?: 'relevance' | 'rating' | 'downloads' | 'updated';
  onlyIngestible?: boolean;
  noCache?: boolean;
}

export interface SkillSearchResult {
  name: string;
  description: string;
  version: string;
  source: string;
  sourceUrl: string;
  installUrl: string;
  author: string;
  rating?: number;
  downloads?: number;
  tags: string[];
  updatedAt: string;
  ingestible: boolean;
  ingestMethod?: 'mcp' | 'converter' | 'llm-fallback' | 'native';
}

export interface SourceConnector {
  name: string;
  search(query: string, options?: SearchOptions): Promise<SkillSearchResult[]>;
  getSkill(name: string): Promise<SkillSearchResult | null>;
  health(): Promise<{ available: boolean; latency: number }>;
}

export interface SearchCacheEntry<T> {
  value: T;
  expiresAt: number;
}
