export type IncidentCategory = 'financial' | 'security' | 'brand' | 'legal';
export type IncidentStatus = 'draft' | 'approved' | 'published' | 'rejected';
export type IncidentListSort = 'newest' | 'incident_date' | 'updated';

export interface IncidentSource {
  label: string;
  url: string;
}

export interface BlogIncident {
  id: string;
  title: string;
  slug: string;
  company: string;
  damage: string;
  category: IncidentCategory;
  dateOccurred: string;
  bodyHtml: string;
  sources: IncidentSource[];
  scoutFixHtml: string;
  status: IncidentStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  newsletterSent: boolean;
  newsletterSentAt: Date | null;
  rejectionReason: string | null;
}

export interface BlogSubscriber {
  id: string;
  email: string;
  subscribedAt: Date;
  confirmed: boolean;
  confirmToken: string | null;
  unsubscribedAt: Date | null;
  lastSentAt: Date | null;
  source: string;
}

export interface ResearchRun {
  id: string;
  runAt: Date;
  triggeredBy: string;
  foundCount: number;
  draftedCount: number;
  skippedCount: number;
  errorLog: string | null;
}
