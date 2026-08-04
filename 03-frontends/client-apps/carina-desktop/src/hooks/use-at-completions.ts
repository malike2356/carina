import { useEffect, useMemo, useState } from 'react';
import { listActiveAgents, listSessions, listSkills } from '../lib/gateway-client.js';
import type { MentionTarget } from '../lib/composer-types.js';

function fuzzyFilterMentions(targets: MentionTarget[], query: string): MentionTarget[] {
  const q = query.trim().toLowerCase();
  if (!q) return targets.slice(0, 8);
  return targets
    .filter((t) => t.name.toLowerCase().includes(q) || (t.subtitle ?? '').toLowerCase().includes(q))
    .slice(0, 8);
}

export function useAtCompletions(query: string) {
  const [targets, setTargets] = useState<MentionTarget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([listSessions(), listActiveAgents(), listSkills()])
      .then(([sessions, agents, skills]) => {
        if (!active) return;
        const sessionTargets: MentionTarget[] = sessions.map((s) => ({
          id: s.sessionId,
          name: s.title ?? s.sessionId.slice(0, 12),
          type: 'session',
          subtitle: 'Session',
        }));
        const agentTargets: MentionTarget[] = agents.map((a) => ({
          id: a.id,
          name: a.name,
          type: 'agent',
          subtitle: 'Agent',
        }));
        const skillTargets: MentionTarget[] = skills.map((s) => ({
          id: s.name,
          name: s.name,
          type: 'skill',
          subtitle: s.description ?? 'Skill',
        }));
        setTargets([...agentTargets, ...sessionTargets, ...skillTargets]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () => fuzzyFilterMentions(targets, query),
    [targets, query],
  );

  return { targets: filtered, loading };
}
