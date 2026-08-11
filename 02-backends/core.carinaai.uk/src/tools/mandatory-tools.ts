export type MandatoryToolCategory =
  | 'arithmetic'
  | 'encoding'
  | 'time'
  | 'system_state'
  | 'file_contents'
  | 'git'
  | 'live_facts'
  | 'email_draft_approval'
  | 'send_email'
  | 'api_data'
  | 'memory_instruction'
  | 'memory_recall'
  | 'image_generation'
  | 'workspace_personal_task'
  | 'workspace_document'
  | 'workspace_document_drive_import'
  | 'workspace_research'
  | 'channel_self_config'
  | 'workspace_contacts_fast'
  | 'workspace_contacts'
  | 'workspace_inventory'
  | 'worker_activity_audit'
  | 'worker_automations'
  | 'companies_house';

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
    id: 'email_draft_approval',
    label: 'Draft email for workspace approval',
    tools: ['workspace-email-draft-for-approval', 'workspace-document-create'],
    guidance:
      'Call workspace-email-draft-for-approval with to, subject, and draftBody. '
      + 'This queues /aiva/approvals and does NOT send. '
      + 'Do not call memory or save search preferences. '
      + 'Phrases like "no, draft" or "draft and keep in workspace" mean create the approval draft now.',
    patterns: [
      /\bdraft\b.+\b(e-?mail|mail)\b/i,
      /\b(e-?mail|mail)\b.+\bdraft\b/i,
      /\bdraft\b.+\b(approv|workspace)\b/i,
      /\b(approv|review)\b.+\b(e-?mail|draft|send)\b/i,
      /\bkeep\b.+\b(in\s+)?(the\s+)?workspace\b/i,
      /\bno[, ]+\s*draft\b/i,
      /\bdon'?t\s+send\b.+\b(draft|e-?mail)\b/i,
      /\bdraft\s+and\s+keep\b/i,
      /\bqueue\b.+\b(approv|draft)\b/i,
    ],
  },
  {
    id: 'send_email',
    label: 'Send outbound email',
    tools: ['gmail-send', 'email-send', 'email-smtp-send'],
    guidance:
      'Call gmail-send when available, otherwise email-send or email-smtp-send. Do not claim IMAP is required. '
      + 'If the user asked to draft/approve first, OR named a contact to email, use contacts(action="email") '
      + 'then workspace-email-draft-for-approval instead of live send.',
    patterns: [
      /\bsend\s+(this\s+)?(an?\s+)?e-?mails?\b/i,
      /\bsend\s+(this\s+)?(message|mail)\s+to\b/i,
      /\bemail\s+this\s+to\b/i,
      /\bto:\s*\S+@\S+/i,
    ],
  },
  {
    id: 'api_data',
    label: 'API responses and live data',
    tools: [
      'http-request',
      'web-search',
      'gmail-list',
      'gmail-get',
      'google-drive-list',
      'google-drive-search',
      'google-drive-read',
    ],
    guidance:
      'Call the endpoint, search, or connected Gmail/Drive tools; do not invent inbox or Drive contents.',
    patterns: [
      /\bcall\s+(the\s+)?api\b/i,
      /\bfetch\s+from\b/i,
      /\bget\s+response\s+from\b/i,
      /\blast\s+\d+\s+emails?\b/i,
      /\b(most\s+recent|latest|newest|last)\s+(e-?mail|mail|message)\b/i,
      /\b(my|the)\s+(inbox|emails?)\b/i,
      /\bread\s+(my\s+)?(email|mail|gmail)\b/i,
      /\bgoogle\s+drive\b/i,
      /\b(my|the)\s+drive\b/i,
      /\bboreholes?\b/i,
      /\bBDAG\b/,
    ],
  },
  {
    id: 'companies_house',
    label: 'UK Companies House register lookup',
    tools: [
      'companies-house-search-companies',
      'companies-house-search-officers',
      'companies-house-get-company',
      'companies-house-list-officers',
      'companies-house-list-psc',
    ],
    guidance:
      'Call companies-house-search-companies (or officers/get/list tools). '
      + 'Do not say Companies House is unavailable when these tools are connected. '
      + 'Do not send the user to find-and-update.company-information.service.gov.uk as the only answer.',
    patterns: [
      /\bcompanies?\s*house\b/i,
      /\buk\s+company\s+register\b/i,
      /\bcompany\s+number\b/i,
      /\bsearch\s+(for\s+)?(uk\s+)?compan(y|ies)\b/i,
      /\bofficers?\s+(of|for)\s+(company|ltd|limited)\b/i,
      /\bpersons?\s+with\s+significant\s+control\b/i,
      /\bpscs?\b/i,
      /\bfind\s+(uk\s+)?(company|ltd|limited)\b/i,
    ],
  },
  {
    id: 'memory_instruction',
    label: 'Explicit memory save instruction',
    tools: ['worker-memory', 'memory'],
    guidance:
      'Call worker-memory(action="add") for Aiva sessions (or memory for host). '
      + 'Verbal acknowledgement alone is not enough.',
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
    tools: ['worker-memory', 'worker-conversation-search', 'memory'],
    guidance:
      'Call worker-memory(action="list") and worker-conversation-search before claiming you remember nothing. '
      + 'Host memory/session-search are unavailable on Aiva.',
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
  {
    id: 'workspace_personal_task',
    label: 'Personal task list / reminder',
    tools: ['notes-manage'],
    guidance:
      'Call notes-manage action=create with format=task or format=reminder (set remind_at for timed reminders). '
      + 'After a successful create, your reply MUST include the returned stable id as "Task ID: <uuid>" or "Reminder ID: <uuid>". '
      + 'If status=exists, quote that existing id and do not create another. '
      + 'Never reply with only DONE / saved / reminded. Never point the user to Schedules (/tasks). '
      + 'Tell them Notes (/notes) for the list, and Calendar (/calendar) Local only for timed reminders. '
      + 'Those are real workspace pages. Never say Notes/Calendar do not exist. '
      + 'For follow-up ("what is the task ID", "update that reminder"), call notes-manage get/list with that id.',
    patterns: [
      /\b(put|add|save)\b.+\b(task list|to-?do|todo|reminder)\b/i,
      /\bremind\s+me\b/i,
      /\b(as a|as an?)\s+reminder\b/i,
      /\btask\s+id\b/i,
      /\breminder\s+id\b/i,
      /\b(my|the)\s+(task|reminder)\s+list\b/i,
      /\bfollow\s*up\b.+\b(task|reminder)\b/i,
    ],
  },
  {
    id: 'workspace_inventory',
    label: 'Workspace inventory',
    tools: ['workspace-inventory', 'worker-activity-audit'],
    guidance:
      'Call workspace-inventory when the user asks what is in the workspace, what you can see, or whether you have full access. '
      + 'For self activity / audit / "what did you do", call worker-activity-audit.',
    patterns: [
      /\bworkspace[- ]inventory\b/i,
      /\bwhat (is|are) in (my|the|this) workspace\b/i,
      /\bwhat can you see\b/i,
      /\bfull (workspace )?access\b/i,
      /\binventory\b.+\bworkspace\b/i,
      /\bhow many channels\b/i,
    ],
  },
  {
    id: 'worker_activity_audit',
    label: 'Aiva self activity audit',
    tools: ['worker-activity-audit', 'worker-conversation-search', 'workspace-inventory'],
    guidance:
      'Call worker-activity-audit with hours=24 (or the requested window) and summarise the returned events. '
      + 'Also use worker-conversation-search for chat details. Do not claim search or activity tools are unavailable; '
      + 'use these worker-scoped tools instead of host session-search/memory.',
    patterns: [
      /\bself[-\s]?inventor/i,
      /\binventor(y|ies)\b/i,
      /\baudit\b/i,
      /\b(your|my)\s+activit/i,
      /\bactivit(y|ies)\b.+\b(last|past|24|hour|today)\b/i,
      /\b(last|past)\s+\d+\s+hours?\b/i,
      /\bwhat\s+did\s+you\s+do\b/i,
      /\bactivity\s+log\b/i,
      /\bsession\s+history\b/i,
    ],
  },
  {
    id: 'workspace_document',
    label: 'Document Vault',
    tools: [
      'vault-list',
      'vault-search',
      'vault-read',
      'vault-create-file',
      'vault-create-folder',
      'workspace-document-create',
      'workspace-document-list',
      'workspace-document-get',
    ],
    guidance:
      'Prefer vault-list / vault-search / vault-read / vault-create-file / vault-create-folder for Document Vault work. '
      + 'Legacy workspace-document-* tools remain as migration-safe aliases. '
      + 'Never accept a model-supplied workspaceId; the trusted session supplies the tenant.',
    patterns: [
      /\b(create|write|draft|make|save)\b.+\b(document|doc|file)\b/i,
      /\b(save|put|add)\b.+\b(documents?|document vault|workspace documents?)\b/i,
      /\bcreate.+\bin (my|the)\s+workspace\b/i,
      /\b(list|show|find|search|open|read)\b.+\b(documents?|document vault|vault)\b/i,
      /\bdocument\s+vault\b/i,
    ],
  },
  {
    id: 'workspace_document_drive_import',
    label: 'Find docs in vault then Drive and index',
    tools: [
      'vault-list',
      'vault-search',
      'vault-read',
      'vault-create-file',
      'workspace-document-list',
      'workspace-document-get',
      'google-drive-search',
      'google-drive-read',
      'workspace-document-create',
      'vault-sync-request',
    ],
    guidance:
      'For investor packs, pitch decks, DBA materials, financial forecasts, or November docs: '
      + '1) Call vault-list or vault-search first (compact metadata; not full bodies). '
      + '2) Call vault-read for each relevant id. '
      + '3) If needed titles are still missing, google-drive-search then google-drive-read, then vault-create-file. '
      + '4) Summarise readiness from the documents you actually listed/read. '
      + 'Do not claim materials are missing if vault-list returned matching titles.',
    patterns: [
      /\bdba\b/i,
      /\bdorset\s+business\s+angels\b/i,
      /\bpitch\s+(deck|pack|event)\b/i,
      /\bnovember\b.+\b(pitch|docs?|documents?|financials?)\b/i,
      /\b(financial|forecast|summary\s+sheet)\b.+\b(pitch|dba|november|investor)\b/i,
      /\b(import|index|copy|pull)\b.+\b(drive|google\s+drive)\b/i,
      /\b(docs?|documents?)\b.+\b(from|in)\b.+\b(drive|google\s+drive)\b/i,
      /\binvestor\s+materials?\b/i,
    ],
  },
  {
    id: 'workspace_research',
    label: 'Workspace research save',
    tools: ['workspace-research-create', 'workspace-research-list'],
    guidance:
      'Call workspace-research-create for deep research requests that should be saved to the Aiva Research page.',
    patterns: [
      /\bdeep\s+research\b/i,
      /\bresearch\b.+\b(save|saved|workspace|research area|research page)\b/i,
      /\b(save|put|add)\b.+\bresearch\b/i,
    ],
  },
  {
    id: 'channel_self_config',
    label: 'Aiva channel self-configuration',
    tools: ['aiva-channel-connect'],
    guidance:
      'Call aiva-channel-connect when the user provides a Telegram BotFather token or asks this Aiva to connect Telegram.',
    patterns: [
      /\btelegram\b.+\b(bot\s+token|token|connect|configure|setup|set up)\b/i,
      /\b\d+:[A-Za-z0-9_-]{20,}\b/,
      /\bBotFather\b/i,
    ],
  },
  {
    id: 'workspace_contacts_fast',
    label: 'Fast person name lookup',
    tools: ['contacts', 'companies-house-search-officers'],
    guidance:
      'Call contacts(action="search", query="<exact name the user typed>") AND '
      + 'companies-house-search-officers with the same name in the same turn when Companies House tools are available. '
      + 'Do not call gmail, Drive, Documents, or web-search first on a bare name find. '
      + 'Answer with clearly labelled sections: Contacts (workspace) then Companies House officers. '
      + 'If several match in either source, list them and ask which one. '
      + 'Never reuse a different person from earlier in this chat. '
      + 'If Companies House is not granted or the API key is missing, still return Contacts results and say CH was skipped with the Tools reconnect hint. '
      + 'If the user asks "what did you find?" after a name lookup, search Contacts and Companies House again with that same name before answering.',
    patterns: [
      /\b(what|and what) did you find\b/i,
      /\bwho is\b/i,
      /\b(find me|look\s*up)\s+[A-Za-z]/i,
      // "find ayeke" / "find Afia" (not "find my documents")
      /\bfind\s+(?!my\b|the\b|a\b|an\b|all\b|that\b|this\b|those\b|these\b|some\b|any\b|it\b)[A-Za-z][A-Za-z0-9.'-]{2,}(\s+[A-Za-z][A-Za-z0-9.'-]{2,}){0,4}\s*[?.!]?\s*$/i,
    ],
  },
  {
    id: 'workspace_contacts',
    label: 'Workspace contact / phone / email escalation',
    tools: [
      'contacts',
      'companies-house-search-officers',
      'companies-house-get-company',
      'companies-house-list-officers',
      'google-contacts',
      'gmail-search',
      'gmail-list',
      'google-drive-search',
      'web-search',
      'workspace-email-draft-for-approval',
    ],
    guidance:
      'Call contacts(action="search") first against the synced Contacts directory, and in the same people hunt '
      + 'also call companies-house-search-officers for UK register officer matches. '
      + 'To CALL someone: contacts(action="call", query="...") which rings the owner phone then bridges (click-to-call). '
      + 'To EMAIL someone: contacts(action="email", query="...", subject, body) then workspace-email-draft-for-approval. '
      + 'Do not use gmail-send for "email X" unless they said send now without approval. '
      + 'If a needed field is missing (email, phone, company), escalate after Contacts + Companies House: '
      + 'gmail-search / gmail-list, then google-drive-search, then web-search. '
      + 'Do not invent contacts. Do not open Documents for a person-name hunt. '
      + 'Companies House does not supply marketing emails; use it for officer/company identity, then escalate for email/phone.',
    patterns: [
      /\b(find|search|look\s*up|get|check)\b.+\b(contact|number|phone|mobile|email)\b/i,
      /\b(phone|mobile|whatsapp|email)\s+(number|address|of|for)\b/i,
      /\b(did you )?(find|check|search).+\b(contact|contacts|email)\b/i,
      /\bdid you find\s+[A-Za-z][A-Za-z.'-]+(\s+[A-Za-z][A-Za-z.'-]+)+\b/i,
      /\bdid you (find|check|search).{0,80}\b(him|her|them|that contact|the number|an? email)\b/i,
      /\bin (my )?(google )?contacts\b/i,
      /\b(google )?contacts\b.+\b(for|named|called|find|search)\b/i,
      /\bcontact (for|named|called)\b/i,
      /\b(his|her|their)\s+(number|phone|mobile|email)\b/i,
      /\bdoes (he|she|they)\s+have\s+(an?\s+)?(email|phone|number)\b/i,
      /\bhave you tried (my )?(emails?|gmail|drive|contacts)\b/i,
      /\b(call|dial|phone|ring)\b.+\b(contact|[A-Za-z][A-Za-z.'-]{1,40})\b/i,
      /\b(call|dial|phone|ring)\s+(him|her|them|[A-Za-z][A-Za-z.'-]+(\s+[A-Za-z][A-Za-z.'-]+)?)\b/i,
      /\b(email|mail|message)\b.+\b(contact|[A-Za-z][A-Za-z.'-]{1,40})\b/i,
      /\bsend\s+(an?\s+)?e-?mail\s+to\b/i,
    ],
  },
  {
    id: 'worker_automations',
    label: 'Aiva scheduled automations / cron / morning digest',
    tools: ['worker-automation'],
    guidance:
      'Call worker-automation (not the host cron tool). '
      + 'For "list/show/what cron jobs": action=list (scope=workspace if they say all). '
      + 'For "test cron/digest": action=test (omit automation_id or use all to test every enabled job). '
      + 'Never claim there is no morning digest without listing first.',
    patterns: [
      /\bcron\b/i,
      /\b(morning|daily)\s+(digest|briefing|brief)\b/i,
      /\bworker-?automation\b/i,
      /\bscheduled\s+(jobs?|automations?|tasks?|briefs?)\b/i,
      /\b(list|show|test|run|check)\b.+\b(automations?|schedules?|digests?)\b/i,
      /\b(automations?|digests?)\b.+\b(list|show|test|run|check)\b/i,
      /\btest all cron\b/i,
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
  // Draft/approve wins over live send when both match.
  if (matches.some((m) => m.rule.id === 'email_draft_approval')) {
    return matches.filter((m) => m.rule.id !== 'send_email');
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
