export type SessionRecallMatch = {
  label: string;
  guidance: string;
};

const RECALL_TRIGGER_PATTERNS: Array<{ label: string; guidance: string; patterns: RegExp[] }> = [
  {
    label: 'Prior session reference',
    guidance: 'Use session-search (discovery mode) before claiming you do not remember.',
    patterns: [
      /\blast time\b/i,
      /\bpreviously\b/i,
      /\bearlier\b/i,
      /\byesterday\b/i,
      /\bdo you remember\b/i,
      /\bwhat did we\b/i,
      /\bcontinue where\b/i,
      /\bpick up where\b/i,
      /\bfrom our last\b/i,
    ],
  },
  {
    label: 'Past work lookup',
    guidance: 'Search transcripts with session-search; durable memory is curated facts only.',
    patterns: [
      /\bwhat did i (say|ask|tell)\b/i,
      /\bfind (our|the) (conversation|chat|session)\b/i,
      /\bsearch (past|previous) (sessions?|chats?)\b/i,
      /\bscroll (back|older)\b/i,
    ],
  },
  {
    label: 'Memory fact lookup',
    guidance: 'Use memory(action="search") or memory(action="list") before saying you have no notes.',
    patterns: [
      /\bwhat do you (know|remember) about me\b/i,
      /\bshow (your|my) (notes|memory|profile)\b/i,
      /\blist (your|my) memory\b/i,
    ],
  },
];

export function matchSessionRecallTriggers(message: string): SessionRecallMatch[] {
  const text = message.trim();
  if (!text) return [];
  const matches: SessionRecallMatch[] = [];
  for (const rule of RECALL_TRIGGER_PATTERNS) {
    if (rule.patterns.some((re) => re.test(text))) {
      matches.push({ label: rule.label, guidance: rule.guidance });
    }
  }
  return matches;
}

export function shouldInjectCrossSessionRecall(message: string): boolean {
  return matchSessionRecallTriggers(message).length > 0;
}

export function buildSessionRecallHint(message: string): string | null {
  const matches = matchSessionRecallTriggers(message);
  if (matches.length === 0) return null;
  const parts = matches.map((m) => `${m.label}: ${m.guidance}`);
  return `Retrieval hint: ${parts.join('; ')}`;
}

export function buildRetrievalDisciplineBlock(): string {
  return [
    'Retrieval discipline:',
    'Injected context is a curated summary (user profile + agent notes), not a transcript archive.',
    'Do NOT assume every past detail is already in context. Search when the operator references prior work.',
    'session-search modes: query (discovery), session_id + cursor (scroll older/newer), no args (browse recent).',
    'Use include_lineage when scrolling to the start of a continued session chain.',
    'memory(action="search") finds durable facts on demand; memory(action="list") shows the full curated set.',
    'Prefer session-search for work history; save only stable facts with memory(action="add").',
  ].join('\n');
}
