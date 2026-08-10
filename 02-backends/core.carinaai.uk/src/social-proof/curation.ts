/**
 * Curation helpers: approve/reject/tag/assign + top selection.
 */
import type { Testimonial, Testimonial as T } from './types.js';
import type { TestimonialStore } from './store.js';

export function approve(store: TestimonialStore, id: string): T | null {
  return store.update(id, { status: 'approved' });
}

export function reject(store: TestimonialStore, id: string): T | null {
  return store.update(id, { status: 'rejected' });
}

export function tag(store: TestimonialStore, id: string, tags: string[]): T | null {
  const row = store.get(id);
  if (!row) return null;
  const merged = Array.from(new Set([...row.tags, ...tags.map((t) => t.trim()).filter(Boolean)]));
  return store.update(id, { tags: merged });
}

export function assignProduct(store: TestimonialStore, id: string, product: string): T | null {
  return store.update(id, { product: product.trim() || 'general' });
}

export function inbox(store: TestimonialStore): T[] {
  return store.list({ status: 'pending' });
}

/** Strongest approved statements for a product (sentiment then length). */
export function curateTop(
  testimonials: Testimonial[],
  product: string,
  limit = 12,
): Testimonial[] {
  return testimonials
    .filter((t) => t.status === 'approved' && (product === 'all' || t.product === product))
    .slice()
    .sort((a, b) => {
      if (b.sentimentScore !== a.sentimentScore) return b.sentimentScore - a.sentimentScore;
      return b.text.length - a.text.length;
    })
    .slice(0, Math.max(1, limit));
}
