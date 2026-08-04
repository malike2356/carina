'use client';

import { useCallback, useEffect, useState } from 'react';

const POLL_MS = 15_000;

export function useApprovalsPendingCount(enabled = true): {
  count: number;
  refresh: () => void;
} {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }
    try {
      const [socialRes, emailRes] = await Promise.all([
        fetch('/api/aiva/social/approvals/pending-count'),
        fetch('/api/aiva/email/approvals/pending-count'),
      ]);
      let next = 0;
      if (socialRes.ok) {
        const body = (await socialRes.json().catch(() => ({}))) as { count?: number };
        next += Number(body.count ?? 0) || 0;
      }
      if (emailRes.ok) {
        const body = (await emailRes.json().catch(() => ({}))) as { count?: number };
        next += Number(body.count ?? 0) || 0;
      }
      setCount(next);
    } catch {
      // Keep last known count on transient failures.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  return { count, refresh };
}
