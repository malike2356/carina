import { db } from '@/db';
import { auditLog } from '@/db/schema';
import { AIVA_SUPPORT_EMAIL } from '@/lib/docs-links';

export type CarinaHelpEscalationInput = {
  workspaceId: string;
  userId: string;
  userEmail: string;
  userName?: string | null;
  summary: string;
  transcript: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentPage?: string | null;
};

export type CarinaHelpEscalationResult = {
  id: string;
  emailed: boolean;
  telegram: boolean;
};

async function notifyTelegram(text: string): Promise<boolean> {
  const token =
    process.env.CARINA_HELP_ESCALATION_BOT_TOKEN?.trim() || process.env.KARINA_ESCALATION_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    '';
  const chatId =
    process.env.CARINA_HELP_ESCALATION_CHAT_ID?.trim() || process.env.KARINA_ESCALATION_CHAT_ID?.trim() ||
    process.env.CARINA_HELP_OWNER_CHAT_ID?.trim() || process.env.KARINA_OWNER_CHAT_ID?.trim() ||
    '';
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 3900),
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function notifyEmail(subject: string, body: string): Promise<boolean> {
  const to =
    process.env.CARINA_HELP_ESCALATION_EMAIL?.trim() || process.env.KARINA_ESCALATION_EMAIL?.trim() ||
    process.env.AIVA_P0_ESCALATION_CONTACT?.trim() ||
    AIVA_SUPPORT_EMAIL;
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.CARINA_HELP_ESCALATION_FROM?.trim() || process.env.KARINA_ESCALATION_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    'Carina Help <onboarding@resend.dev>';

  if (!resendKey) {
    console.info('[carina-help-escalate] email skipped (no RESEND_API_KEY)', { to, subject });
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createCarinaHelpEscalation(
  input: CarinaHelpEscalationInput,
): Promise<CarinaHelpEscalationResult> {
  const detail = {
    kind: 'carina_help_escalation',
    summary: input.summary,
    currentPage: input.currentPage ?? null,
    userEmail: input.userEmail,
    userName: input.userName ?? null,
    transcript: input.transcript.slice(-12).map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 2000),
    })),
  };

  const [row] = await db
    .insert(auditLog)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: 'carina_help_escalation',
      detail,
    })
    .returning({ id: auditLog.id });

  const subject = `[Carina escalate] ${input.summary.slice(0, 80) || 'Aiva help needed'}`;
  const body = [
    'Carina escalated an Aiva product-help conversation.',
    '',
    `Workspace: ${input.workspaceId}`,
    `User: ${input.userName || 'unknown'} <${input.userEmail}>`,
    `Page: ${input.currentPage || 'unknown'}`,
    `Escalation id: ${row.id}`,
    '',
    'Summary:',
    input.summary,
    '',
    'Recent transcript:',
    ...input.transcript.slice(-8).map((m) => `${m.role.toUpperCase()}: ${m.content}`),
  ].join('\n');

  const telegramText = [
    'Carina help escalation',
    `User: ${input.userEmail}`,
    `Page: ${input.currentPage || '-'}`,
    `Id: ${row.id}`,
    '',
    input.summary.slice(0, 500),
  ].join('\n');

  const [emailed, telegram] = await Promise.all([
    notifyEmail(subject, body),
    notifyTelegram(telegramText),
  ]);

  return { id: row.id, emailed, telegram };
}
