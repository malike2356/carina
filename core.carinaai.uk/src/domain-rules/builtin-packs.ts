import type { DomainRulePack } from './types.js';

export const BUILTIN_DOMAIN_RULE_PACKS: DomainRulePack[] = [
  {
    id: 'web',
    label: 'Web retrieval',
    toolsets: ['web', 'search'],
    tools: ['web-search', 'http-request'],
    source: 'builtin',
    rules: [
      'Use web-search or http-request for live web facts; do not use shell curl/wget unless the operator explicitly asks for CLI.',
      'Cite URLs from tool output when the answer depends on fetched content.',
    ],
  },
  {
    id: 'browser',
    label: 'Browser automation',
    toolsets: ['browser'],
    source: 'builtin',
    rules: [
      'Prefer browser-* tools for interactive pages; snapshot before claiming page state.',
      'Do not drive the browser via shell scripts when browser tools are available.',
    ],
  },
  {
    id: 'email',
    label: 'Email',
    toolsets: ['messaging'],
    tools: ['email-send', 'email-list', 'email-smtp-send'],
    source: 'builtin',
    rules: [
      'Use email tools for mailbox work; do not fabricate message UIDs or thread ids.',
      'For "last" or "latest" mail, list or search first; do not guess from memory.',
    ],
  },
  {
    id: 'memory',
    label: 'Durable memory',
    tools: ['memory'],
    source: 'builtin',
    rules: [
      'memory stores declarative operator facts; use session-search for work history.',
      'Do not save task progress, PR numbers, or session outcomes to memory.',
    ],
  },
  {
    id: 'session-recall',
    label: 'Session recall',
    tools: ['session-search'],
    source: 'builtin',
    rules: [
      'Use session-search for prior transcripts; injected context is a curated summary only.',
      'Discovery: query arg; scroll: session_id + cursor; browse: no args for recent sessions.',
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    toolsets: ['integrations'],
    tools: ['homeassistant', 'ha-call-service', 'ha-list-entities'],
    source: 'builtin',
    rules: [
      'List entities or services before calling homeassistant actions when state is unknown.',
      'Use integration tools rather than raw HTTP to vendor APIs when a tool exists.',
    ],
  },
  {
    id: 'workspace-docs',
    label: 'Workspace documents',
    toolsets: ['workspace'],
    tools: ['notes-manage', 'documents-manage'],
    source: 'builtin',
    rules: [
      'Use notes-manage for notes and todos; use documents-manage for longer docs.',
      'Do not store note bodies in durable memory; keep them in workspace tools.',
    ],
  },
];
