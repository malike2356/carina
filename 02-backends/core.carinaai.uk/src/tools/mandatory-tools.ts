export type MandatoryToolCategory =
  | 'arithmetic'
  | 'encoding'
  | 'time'
  | 'system_state'
  | 'file_contents'
  | 'git'
  | 'live_facts'
  | 'api_data'
  | 'memory_instruction'
  | 'memory_recall'
  | 'image_generation';

export type MandatoryToolRule = {
  id: MandatoryToolCategory;
  label: string;
  tools: string[];
  guidance: string;
  patterns: RegExp[];
};

/** Questions that must not be answered from model memory alone. */
export const MANDATORY_TOOL_RULES: MandatoryToolRule[] = [
  {
    id: 'arithmetic',
    label: 'Arithmetic and calculations',
    tools: ['shell-exec', 'code-exec'],
    guidance: 'Use shell-exec or code-exec; never mental math.',
    patterns: [
      /\bwhat\s+is\s+\d+\s*[\+\-\*\/x]\s*\d+/i,
      /\bcalculate\b/i,
      /\bhow\s+much\s+is\s+\d+/i,
      /\b\d+\s*[\+\-\*\/x%]\s*\d+/,
    ],
  },
  {
    id: 'encoding',
    label: 'Hashes, encodings, checksums',
    tools: ['shell-exec', 'base64-codec', 'text-hash'],
    guidance: 'Use shell-exec (sha256sum, base64) or utility tools; never invent digests.',
    patterns: [
      /\bsha-?256\b/i,
      /\bbase64\b/i,
      /\bhash\b/i,
      /\bchecksum\b/i,
      /\bencode\b/i,
      /\bdecode\b/i,
    ],
  },
  {
    id: 'time',
    label: 'Current time, date, timezone',
    tools: ['shell-exec'],
    guidance: 'Use shell-exec (date); never guess the clock.',
    patterns: [
      /\bwhat\s+time\b/i,
      /\bwhat\s+date\b/i,
      /\bwhat\s+day\s+is\s+it\b/i,
      /\bcurrent\s+time\b/i,
      /\btimezone\b/i,
    ],
  },
  {
    id: 'system_state',
    label: 'System state (OS, CPU, memory, disk, ports, processes)',
    tools: ['shell-exec', 'disk-usage', 'env-presence'],
    guidance: 'Use shell-exec or ops utilities; memory does not describe this host.',
    patterns: [
      /\bhow\s+much\s+(ram|memory|disk)\b/i,
      /\bfree\s+disk\b/i,
      /\bcpu\s+usage\b/i,
      /\bwhich\s+port\b/i,
      /\blist\s+processes\b/i,
      /\buname\b/i,
      /\bos\s+version\b/i,
    ],
  },
  {
    id: 'file_contents',
    label: 'File contents, sizes, line counts',
    tools: ['file-read', 'search-files', 'shell-exec'],
    guidance: 'Use file-read, search-files, or shell-exec; never fabricate file contents.',
    patterns: [
      /\bread\s+(the\s+)?file\b/i,
      /\bshow\s+(me\s+)?(the\s+)?contents\b/i,
      /\bwhat\s+is\s+in\s+.+\.(ts|js|py|md|json|yaml|txt)\b/i,
      /\bhow\s+many\s+lines\b/i,
      /\bline\s+count\b/i,
    ],
  },
  {
    id: 'git',
    label: 'Git history, branches, diffs',
    tools: ['shell-exec', 'git-brief-status'],
    guidance: 'Use shell-exec or git-brief-status; never invent commit history.',
    patterns: [
      /\bgit\s+(log|status|diff|branch)\b/i,
      /\blast\s+commit\b/i,
      /\bwhich\s+branch\b/i,
    ],
  },
  {
    id: 'live_facts',
    label: 'Current facts (weather, news, versions, prices)',
    tools: ['web-search', 'http-request'],
    guidance: 'Use web-search or http-request for live facts.',
    patterns: [
      /\bweather\b/i,
      /\bnews\b/i,
      /\blatest\s+version\b/i,
      /\bcurrent\s+price\b/i,
      /\bstock\s+price\b/i,
    ],
  },
  {
    id: 'api_data',
    label: 'API responses and live data',
    tools: ['http-request', 'web-search'],
    guidance: 'Call the endpoint or search; do not synthesise API JSON.',
    patterns: [
      /\bcall\s+(the\s+)?api\b/i,
      /\bfetch\s+from\b/i,
      /\bget\s+response\s+from\b/i,
    ],
  },
  {
    id: 'memory_instruction',
    label: 'Explicit memory save instruction',
    tools: ['memory'],
    guidance: 'Call memory(action="add"); verbal acknowledgement alone is not enough.',
    patterns: [
      /\bremember\s+that\b/i,
      /\bnote\s+that\b/i,
      /\bkeep\s+in\s+mind\b/i,
      /\bdon'?t\s+forget\b/i,
    ],
  },
  {
    id: 'memory_recall',
    label: 'Memory recall request',
    tools: ['memory'],
    guidance: 'Call memory(action="list") before claiming you remember nothing.',
    patterns: [
      /\bwhat\s+do\s+you\s+remember\b/i,
      /\bshow\s+(your\s+)?memory\b/i,
      /\blist\s+(your\s+)?memory\b/i,
    ],
  },
  {
    id: 'image_generation',
    label: 'Image and visual asset generation',
    tools: ['image-generation'],
    guidance:
      'Call image-generation with a detailed prompt. Do not substitute ASCII art, text boxes, or prose descriptions for a requested image or visual banner.',
    patterns: [
      /\bgenerate\s+(an?\s+)?(image|picture|photo|graphic|illustration|banner|poster|logo|visual)\b/i,
      /\bcreate\s+(an?\s+)?(image|picture|photo|graphic|illustration|banner|poster|logo|visual)\b/i,
      /\bmake\s+(me\s+)?(an?\s+)?(image|picture|banner|graphic|poster|logo)\b/i,
      /\bwelcome\s+banner\b/i,
      /\bmarketing\s+(banner|graphic|image)\b/i,
      /\bimage\s+generation\b/i,
      /\bdall-?e\b/i,
    ],
  },
];

export type MandatoryToolMatch = {
  rule: MandatoryToolRule;
  tools: string[];
};

export function matchMandatoryToolRules(message: string): MandatoryToolMatch[] {
  const text = message.trim();
  if (!text) return [];
  const matches: MandatoryToolMatch[] = [];
  for (const rule of MANDATORY_TOOL_RULES) {
    if (rule.patterns.some((re) => re.test(text))) {
      matches.push({ rule, tools: [...rule.tools] });
    }
  }
  return matches;
}

export function primaryMandatoryTools(message: string): string[] {
  const names = new Set<string>();
  for (const match of matchMandatoryToolRules(message)) {
    for (const tool of match.tools) names.add(tool);
  }
  return [...names];
}

export function buildMandatoryToolsBlock(): string {
  const lines = [
    'Mandatory tool use (never answer from memory or mental computation):',
  ];
  for (const rule of MANDATORY_TOOL_RULES) {
    if (
      rule.id === 'memory_instruction'
      || rule.id === 'memory_recall'
      || rule.id === 'api_data'
    ) continue;
    lines.push(`- ${rule.label}: ${rule.tools.join(', ')}`);
  }
  lines.push(
    '- API responses and live data: the actual endpoint or tool, not memory',
    'Your memory describes the operator, not the system you are running on. The execution environment may differ from what memory says.',
  );
  return lines.join('\n');
}

export function buildMandatoryToolHint(message: string): string | null {
  const matches = matchMandatoryToolRules(message);
  if (matches.length === 0) return null;
  const parts = matches.map((m) => `${m.rule.label}: ${m.rule.guidance} (tools: ${m.tools.join(', ')})`);
  return `Mandatory tool routing: ${parts.join('; ')}`;
}
