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
    guidance:
      'Prefer evidence from THIS conversation first (recent assistant replies and tool reads such as Drive/CV files). '
      + 'Then use memory(action="search") or memory(action="list") for durable notes. '
      + 'Do not replace just-read documents with older profile notes.',
    patterns: [
      /\bwhat do you (know|remember) about me\b/i,
      /\bfrom my (cvs?|resumes?|documents?)\b/i,
      /\bshow (your|my) (notes|memory|profile)\b/i,
      /\blist (your|my) memory\b/i,
    ],
  },
  {
    label: 'This-conversation follow-up',
    guidance:
      'Continue the current thread. Reuse files/results already listed or read in this chat. '
      + 'Do not switch to unrelated durable memory topics unless the user asks.',
    patterns: [
      /\bread (them )?all\b/i,
      /\bthose (ones|files|cvs?|documents?)\b/i,
      /\bthe (remaining|rest|other) (ones|files|cvs?)\b/i,
      /\bcontinue (reading|with|from)\b/i,
      /\bread (the )?(remaining|rest|other)\b/i,
      /^(yes|yeah|yep|ok|okay|do it|go ahead|confirm)\b/i,
    ],
  },
  {
    label: 'Email draft / workspace approval',
    guidance:
      'Call workspace-email-draft-for-approval with the known recipient, subject, and body. '
      + 'Do not save preferences. Do not claim channels are missing if this chat already found emails or @usernames.',
    patterns: [
      /\bdraft\b.+\b(e-?mail|mail|approv|workspace)\b/i,
      /\b(e-?mail|mail)\b.+\bdraft\b/i,
      /\bkeep\b.+\bworkspace\b/i,
      /\bno[, ]+\s*draft\b/i,
      /\bdon'?t\s+send\b/i,
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
    'When the user asks about something just read or listed in this chat (CVs, Drive files, emails), answer from that recent turn evidence first.',
    'Durable USER/MEMORY notes must not override fresher tool results from this conversation.',
    'Search escalation: start with known internal workspace sources (contacts, email, Drive, docs, memory, chat), then expand; only then use the open web. Do not stop after one empty source.',
    'For product support, prefer the live workspace nav, Aiva nav, and GitHub agent-sync bridge over older static notes when they differ.',
    'Draft/approve/email requests are task actions: use workspace-email-draft-for-approval; never treat them as preference-save requests.',
  ].join('\n');
}
