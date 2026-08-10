/**
 * Testimonial store (memory + optional JSON file).
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fingerprintTestimonial, scoreSentiment } from './sentiment.js';
import type { CurationStatus, ManualEntryInput, Testimonial } from './types.js';

export class TestimonialStore {
  private rows: Testimonial[] = [];
  private filePath: string | null;

  constructor(filePath?: string | null) {
    this.filePath = filePath ?? null;
    if (this.filePath && existsSync(this.filePath)) {
      try {
        const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as { testimonials?: Testimonial[] };
        this.rows = Array.isArray(raw.testimonials) ? raw.testimonials : [];
      } catch {
        this.rows = [];
      }
    }
  }

  private persist(): void {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(
      this.filePath,
      `${JSON.stringify({ updatedAt: new Date().toISOString(), testimonials: this.rows }, null, 2)}\n`,
      'utf8',
    );
  }

  list(filters: {
    status?: CurationStatus;
    product?: string;
    tag?: string;
    platform?: string;
  } = {}): Testimonial[] {
    return this.rows
      .filter((t) => (filters.status ? t.status === filters.status : true))
      .filter((t) => (filters.product ? t.product === filters.product : true))
      .filter((t) => (filters.tag ? t.tags.includes(filters.tag) : true))
      .filter((t) => (filters.platform ? t.platform === filters.platform : true))
      .slice()
      .sort((a, b) => Date.parse(b.collectedAt) - Date.parse(a.collectedAt));
  }

  get(id: string): Testimonial | null {
    return this.rows.find((t) => t.id === id) ?? null;
  }

  upsertIncoming(
    partial: Omit<Testimonial, 'id' | 'fingerprint' | 'sentiment' | 'sentimentScore' | 'collectedAt' | 'reviewedAt' | 'status'> & {
      status?: CurationStatus;
      collectedAt?: string;
    },
  ): { item: Testimonial; duplicate: boolean } {
    const fingerprint = fingerprintTestimonial({
      text: partial.text,
      author: partial.author,
      url: partial.url,
    });
    const existing = this.rows.find((t) => t.fingerprint === fingerprint);
    if (existing) {
      return { item: existing, duplicate: true };
    }
    const sentiment = scoreSentiment(partial.text);
    const item: Testimonial = {
      id: randomUUID(),
      text: partial.text.trim(),
      author: partial.author.trim(),
      authorTitle: partial.authorTitle ?? null,
      platform: partial.platform,
      url: partial.url.trim(),
      date: partial.date || new Date().toISOString().slice(0, 10),
      tags: partial.tags ?? [],
      product: partial.product || 'general',
      status: partial.status ?? 'pending',
      sentiment: sentiment.label,
      sentimentScore: sentiment.score,
      collectedAt: partial.collectedAt ?? new Date().toISOString(),
      reviewedAt: partial.status === 'approved' || partial.status === 'rejected' ? new Date().toISOString() : null,
      fingerprint,
      meta: partial.meta,
    };
    if (!item.url) {
      throw new Error('Every testimonial must include a source URL');
    }
    if (!item.text || !item.author) {
      throw new Error('text and author are required');
    }
    this.rows.push(item);
    this.persist();
    return { item, duplicate: false };
  }

  manualEntry(input: ManualEntryInput): Testimonial {
    const result = this.upsertIncoming({
      text: input.text,
      author: input.author,
      authorTitle: input.authorTitle ?? null,
      platform: input.platform ?? 'manual',
      url: input.url,
      date: input.date || new Date().toISOString().slice(0, 10),
      tags: input.tags ?? [],
      product: input.product ?? 'general',
      status: 'pending',
    });
    return result.item;
  }

  update(
    id: string,
    patch: Partial<Pick<Testimonial, 'status' | 'tags' | 'product' | 'authorTitle'>>,
  ): Testimonial | null {
    const idx = this.rows.findIndex((t) => t.id === id);
    if (idx < 0) return null;
    const current = this.rows[idx]!;
    const next: Testimonial = {
      ...current,
      ...patch,
      tags: patch.tags ?? current.tags,
      reviewedAt:
        patch.status && patch.status !== 'pending'
          ? new Date().toISOString()
          : current.reviewedAt,
    };
    this.rows[idx] = next;
    this.persist();
    return next;
  }

  clear(): void {
    this.rows = [];
    this.persist();
  }
}
