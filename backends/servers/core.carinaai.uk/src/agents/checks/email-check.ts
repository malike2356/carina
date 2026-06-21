import { pool } from '../../memory/db.js';

export interface CheckResult {
  name: string;
  urgent: boolean;
  summary: string | null;
}

export interface EmailCandidate {
  from: string;
  subject: string;
  snippet: string;
  receivedAt: Date;
}

export async function checkRecentInboundEmails(since?: Date): Promise<CheckResult> {
  const params: unknown[] = [];
  const where = since ? 'WHERE received_at > $1' : '';
  if (since) params.push(since);

  const result = await pool.query<{
    from_address: string;
    subject: string | null;
    body_text: string | null;
    received_at: Date;
  }>(
    `SELECT from_address, subject, body_text, received_at
     FROM inbound_emails
     ${where}
     ORDER BY received_at DESC
     LIMIT 10`,
    params,
  );

  if (result.rows.length === 0) {
    return { name: 'email', urgent: false, summary: null };
  }

  const candidates = result.rows.map((row) => ({
    from: row.from_address,
    subject: row.subject ?? '(no subject)',
    snippet: (row.body_text ?? '').replace(/\s+/g, ' ').slice(0, 220),
    receivedAt: row.received_at,
  }));

  return {
    name: 'email',
    urgent: false,
    summary: `Recent inbound email candidates for agent urgency review:\n${formatCandidates(candidates)}`,
  };
}

function formatCandidates(candidates: EmailCandidate[]): string {
  return candidates
    .map((email) => `- ${email.receivedAt.toISOString()} from ${email.from}: ${email.subject}\n  ${email.snippet}`)
    .join('\n');
}
