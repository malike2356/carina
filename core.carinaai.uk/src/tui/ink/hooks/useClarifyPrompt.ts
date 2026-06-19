import { useState, useEffect } from 'react';
import { getPendingClarification } from '../../../tools/clarify.js';
import type { ClarifyState } from '../types/approval.js';

export function useClarifyPrompt(sessionId: string | undefined, enabled: boolean): ClarifyState | null {
  const [clarify, setClarify] = useState<ClarifyState | null>(null);

  useEffect(() => {
    if (!sessionId || !enabled) {
      setClarify(null);
      return undefined;
    }

    const poll = () => {
      const pending = getPendingClarification(sessionId);
      if (pending) {
        setClarify({
          question: pending.question,
          options: pending.choices,
        });
      } else {
        setClarify(null);
      }
    };

    poll();
    const interval = setInterval(poll, 500);
    return () => clearInterval(interval);
  }, [sessionId, enabled]);

  return clarify;
}
