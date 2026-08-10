/**
 * Social proof types and storage shape.
 */

export type Platform =
  | 'twitter'
  | 'linkedin'
  | 'github'
  | 'discord'
  | 'youtube'
  | 'manual'
  | 'press'
  | 'other';

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export type CurationStatus = 'pending' | 'approved' | 'rejected';

export type Testimonial = {
  id: string;
  text: string;
  author: string;
  authorTitle: string | null;
  platform: Platform;
  url: string;
  date: string;
  tags: string[];
  product: string;
  status: CurationStatus;
  sentiment: SentimentLabel;
  sentimentScore: number;
  collectedAt: string;
  reviewedAt: string | null;
  fingerprint: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type CollectResult = {
  platform: Platform;
  added: number;
  duplicates: number;
  items: Testimonial[];
};

export type ProofPageModel = {
  product?: string;
  tag?: string;
  testimonials: Testimonial[];
  logos: Array<{ name: string; href?: string }>;
  metrics: Array<{ label: string; value: string }>;
  press: Array<{ title: string; outlet: string; url: string; date?: string }>;
  videos: Array<{ title: string; url: string }>;
};

export type ManualEntryInput = {
  text: string;
  author: string;
  authorTitle?: string | null;
  platform?: Platform;
  url: string;
  date?: string;
  tags?: string[];
  product?: string;
};
