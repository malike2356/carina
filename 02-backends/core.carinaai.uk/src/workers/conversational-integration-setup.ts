import { listEffectiveToolGrants } from './aiva-parity-store.js';

const SETUP_ACTION_RE =
  /\b(connect|configure|set\s*up|setup|add|link|integrate|enable|authorize|authenticate|reauthori[sz]e)\b/i;
const REMOVAL_ACTION_RE =
  /\b(disconnect|remove|delete|disable|revoke|unlink|forget)\b/i;

type ToolTarget = {
  slug: string;
  label: string;
  connectPath: string;
  secondaryPath?: string;
  hint: string;
};

const TOOL_TARGETS: ToolTarget[] = [
  {
    slug: 'gmail',
    label: 'Gmail',
    connectPath: '/aiva/tools?tool=gmail',
    hint: 'Use this for inbox search, sending, drafting, and follow-ups.',
  },
  {
    slug: 'google-calendar',
    label: 'Google Calendar',
    connectPath: '/aiva/tools?tool=google-calendar',
    hint: 'Use this for scheduling, availability, and event updates.',
  },
  {
    slug: 'google-drive',
    label: 'Google Drive / Docs',
    connectPath: '/aiva/tools?tool=google-drive',
    hint: 'Use this for files, folders, docs, and shared workspace assets.',
  },
  {
    slug: 'google-contacts',
    label: 'Google Contacts',
    connectPath: '/aiva/tools?tool=google-contacts',
    hint: 'Use this for name, email, and phone lookups.',
  },
  {
    slug: 'trello',
    label: 'Trello',
    connectPath: '/aiva/tools?tool=trello',
    secondaryPath: 'https://trello.com/app-key',
    hint: 'Use this for boards, lists, cards, and task handoff.',
  },
  {
    slug: 'companies-house',
    label: 'Companies House',
    connectPath: '/aiva/tools?tool=companies-house',
    secondaryPath: 'https://developer.company-information.service.gov.uk/',
    hint: 'UK register search for companies, officers, and persons with significant control (no marketing emails).',
  },
];

function matchesTarget(message: string, target: ToolTarget): boolean {
  switch (target.slug) {
    case 'gmail':
      return /\b(gmail|e-?mails?|inbox|sent mail|mailboxes?)\b/i.test(message);
    case 'google-calendar':
      return /\b(calendar|calender|meeting|schedule|appointment|availability)\b/i.test(message);
    case 'google-drive':
      return /\b(google\s+drive|drive|docs?|documents?|files?|folders?)\b/i.test(message);
    case 'google-contacts':
      return /\b(contacts?|phone number|email address|address book|contact list)\b/i.test(message);
    case 'trello':
      return /\btrello\b/i.test(message);
    case 'companies-house':
      return /\b(companies?\s*house|uk\s+company\s+register|company\s+number|psc|persons?\s+with\s+significant\s+control|search\s+officers?)\b/i.test(
        message,
      );
    default:
      return false;
  }
}

function resolveTargets(message: string): ToolTarget[] {
  return TOOL_TARGETS.filter((target) => matchesTarget(message, target));
}

function grantStatusLabel(status?: string): 'connected' | 'needs_reauth' | 'missing' | 'other' {
  if (status === 'connected') return 'connected';
  if (status === 'needs_reauth' || status === 'error') return 'needs_reauth';
  if (!status) return 'missing';
  return 'other';
}

function formatTargetBlock(target: ToolTarget, status: 'connected' | 'needs_reauth' | 'missing' | 'other'): string {
  const statusText =
    status === 'connected'
      ? 'already connected'
      : status === 'needs_reauth'
        ? 'needs reauth'
        : status === 'missing'
          ? 'not connected yet'
          : `status: ${status}`;
  const lines = [
    `- ${target.label}: ${statusText}. ${target.hint}`,
    `  Open: ${target.connectPath}`,
  ];
  if (target.secondaryPath) {
    lines.push(`  Secondary reference: ${target.secondaryPath}`);
  }
  return lines.join('\n');
}

/**
 * Intercept when the user asks to *use* a Google/Trello tool that is missing or needs_reauth,
 * or when they explicitly ask to connect/configure one.
 * Ordinary work on an already-connected tool returns null so the agent turn continues.
 */
export async function buildConversationalIntegrationSetupReply(input: {
  workspaceId: string;
  workerId: string;
  message: string;
}): Promise<string | null> {
  const message = input.message.trim();
  if (!message || REMOVAL_ACTION_RE.test(message)) return null;

  const targets = resolveTargets(message);
  if (targets.length === 0) return null;

  const explicitSetup = SETUP_ACTION_RE.test(message);
  const grants = await listEffectiveToolGrants(input.workspaceId, input.workerId).catch(() => []);
  const grantsBySlug = new Map(grants.map((grant) => [grant.toolSlug, grant]));

  const blocked = targets.filter((target) => {
    const status = grantStatusLabel(grantsBySlug.get(target.slug)?.status);
    return status === 'missing' || status === 'needs_reauth';
  });

  // Explicit connect/configure always gets a secure handoff.
  // Use-intent (e.g. "check my calendar") only intercepts when that tool cannot run yet.
  if (!explicitSetup && blocked.length === 0) return null;
  const focus = explicitSetup ? targets : blocked;
  if (focus.length === 0) return null;

  const lines = [
    explicitSetup
      ? `Yes. I can help connect ${focus.map((target) => target.label).join(', ')}.`
      : `I can do that once ${focus.map((target) => target.label).join(', ')} is connected for me.`,
    'Do not paste passwords, API keys, or OAuth secrets into chat.',
    'Open the Tools page first: /aiva/tools',
    '',
  ];

  for (const target of focus) {
    const grant = grantsBySlug.get(target.slug);
    const status = grantStatusLabel(grant?.status);
    lines.push(formatTargetBlock(target, status));
    lines.push('');
  }

  lines.push(
    'After the grant is saved, ask me the same question again. '
    + 'If a grant shows needs_reauth, reconnect it before retrying.',
  );

  return lines.join('\n').trim();
}
