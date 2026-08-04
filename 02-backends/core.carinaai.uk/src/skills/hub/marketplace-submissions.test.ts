import { describe, expect, it, vi, beforeEach } from 'vitest';

const hubPoolQuery = vi.fn();

vi.mock('./migrations.js', () => ({ hubPool: { query: hubPoolQuery } }));
vi.mock('../../config/index.js', () => ({
  config: { resend: { apiKey: '', from: 'hello@carinaai.uk' } },
}));

describe('marketplace-submissions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('validateSubmissionInput', () => {
    it('passes a valid submission', async () => {
      const { validateSubmissionInput } = await import('./marketplace-submissions.js');
      const errors = validateSubmissionInput({
        packName: 'my-legal-review',
        version: '1.0.0',
        authorHandle: 'acme-ai',
        authorEmail: 'dev@acmecorp.example',
        description: 'Skill pack for legal document review.',
        pricingTier: 'free',
        packArchiveUrl: 'https://github.com/acmecorp/releases/v1.zip',
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects invalid packName', async () => {
      const { validateSubmissionInput } = await import('./marketplace-submissions.js');
      const errors = validateSubmissionInput({
        packName: 'Bad Name!',
        version: '1.0.0',
        authorHandle: 'acme',
        authorEmail: 'dev@acme.com',
        description: 'desc',
        pricingTier: 'free',
        packArchiveUrl: 'https://example.com/pack.zip',
      });
      expect(errors.some((e) => e.field === 'packName')).toBe(true);
    });

    it('requires priceGbpCents for premium tier', async () => {
      const { validateSubmissionInput } = await import('./marketplace-submissions.js');
      const errors = validateSubmissionInput({
        packName: 'premium-pack',
        version: '2.0.0',
        authorHandle: 'author',
        authorEmail: 'a@b.com',
        description: 'Premium skills',
        pricingTier: 'premium',
        priceGbpCents: 0,
        packArchiveUrl: 'https://example.com/pack.zip',
      });
      expect(errors.some((e) => e.field === 'priceGbpCents')).toBe(true);
    });

    it('rejects non-https archive URL', async () => {
      const { validateSubmissionInput } = await import('./marketplace-submissions.js');
      const errors = validateSubmissionInput({
        packName: 'my-pack',
        version: '1.0.0',
        authorHandle: 'author',
        authorEmail: 'a@b.com',
        description: 'desc',
        pricingTier: 'free',
        packArchiveUrl: 'http://insecure.example.com/pack.zip',
      });
      expect(errors.some((e) => e.field === 'packArchiveUrl')).toBe(true);
    });
  });

  describe('createSubmission', () => {
    it('inserts into pack_submissions and returns the row', async () => {
      const fakeRow = {
        id: 'sub-1', pack_name: 'my-pack', version: '1.0.0',
        author_handle: 'author', author_email: 'a@b.com',
        description: 'desc', category: null, pricing_tier: 'free',
        price_gbp_cents: null, author_share_bps: 7000,
        pack_archive_url: 'https://example.com/pack.zip',
        status: 'pending', reviewer_notes: null,
        submitted_at: '2026-06-26', reviewed_at: null, published_at: null,
      };
      hubPoolQuery.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1 });

      const { createSubmission } = await import('./marketplace-submissions.js');
      const result = await createSubmission({
        packName: 'my-pack', version: '1.0.0', authorHandle: 'author',
        authorEmail: 'a@b.com', description: 'desc', pricingTier: 'free',
        packArchiveUrl: 'https://example.com/pack.zip',
      });

      expect(result.id).toBe('sub-1');
      expect(result.status).toBe('pending');
      const [sql] = hubPoolQuery.mock.calls[0] as [string];
      expect(sql).toContain('INSERT INTO pack_submissions');
    });
  });

  describe('reviewSubmission', () => {
    it('sets status=approved and reviewed_at', async () => {
      const fakeRow = { id: 'sub-2', pack_name: 'p', version: '1.0.0', author_handle: 'a', author_email: 'a@b.com', description: 'd', category: null, pricing_tier: 'free', price_gbp_cents: null, author_share_bps: 7000, pack_archive_url: 'https://x.com/p.zip', status: 'approved', reviewer_notes: null, submitted_at: '2026-06-26', reviewed_at: '2026-06-27', published_at: null };
      hubPoolQuery.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1 });

      const { reviewSubmission } = await import('./marketplace-submissions.js');
      const result = await reviewSubmission('sub-2', 'approve');

      const [sql, params] = hubPoolQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('SET status = $1');
      expect(params[0]).toBe('approved');
      expect(result?.status).toBe('approved');
    });

    it('returns null when submission not found or not pending', async () => {
      hubPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const { reviewSubmission } = await import('./marketplace-submissions.js');
      const result = await reviewSubmission('missing', 'reject');
      expect(result).toBeNull();
    });
  });

  describe('publishSubmission', () => {
    it('returns null when submission is not approved', async () => {
      const pendingSub = { id: 'sub-3', pack_name: 'p', version: '1.0.0', author_handle: 'a', author_email: 'a@b.com', description: 'd', category: null, pricing_tier: 'free', price_gbp_cents: null, author_share_bps: 7000, pack_archive_url: 'https://x.com/p.zip', status: 'pending', reviewer_notes: null, submitted_at: '2026-06-26', reviewed_at: null, published_at: null };
      hubPoolQuery.mockResolvedValueOnce({ rows: [pendingSub], rowCount: 1 });

      const { publishSubmission } = await import('./marketplace-submissions.js');
      const result = await publishSubmission('sub-3');
      expect(result).toBeNull();
    });

    it('upserts into skill_packs and sets published_at', async () => {
      const approvedSub = { id: 'sub-4', pack_name: 'approved-pack', version: '2.0.0', author_handle: 'dev', author_email: 'dev@x.com', description: 'Great pack', category: 'legal', pricing_tier: 'premium', price_gbp_cents: 499, author_share_bps: 7000, pack_archive_url: 'https://x.com/p.zip', status: 'approved', reviewer_notes: null, submitted_at: '2026-06-26', reviewed_at: '2026-06-27', published_at: null };
      hubPoolQuery
        .mockResolvedValueOnce({ rows: [approvedSub], rowCount: 1 }) // getSubmission
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })             // INSERT INTO skill_packs
        .mockResolvedValueOnce({ rows: [{ ...approvedSub, status: 'published', published_at: '2026-06-28' }], rowCount: 1 }); // UPDATE status

      const { publishSubmission } = await import('./marketplace-submissions.js');
      const result = await publishSubmission('sub-4');

      expect(result?.status).toBe('published');
      const insertCall = hubPoolQuery.mock.calls[1] as [string, unknown[]];
      expect(insertCall[0]).toContain('INSERT INTO skill_packs');
    });
  });
});
