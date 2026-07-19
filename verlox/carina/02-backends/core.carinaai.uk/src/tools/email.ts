import { Resend } from 'resend';
import { createTransport } from 'nodemailer';
import { config } from '../config/index.js';
import { pool } from '../memory/db.js';
import type { Tool } from '../types/index.js';

// ── Resend-based sender ──────────────────────────────────────────────

export const emailSendTool: Tool = {
  name: 'email-send',
  dangerous: true,
  requiresConfirmation: true,
  description:
    'Send a plain-text email via Resend. Prefer this when RESEND_API_KEY is configured (hosted Aiva/Carina). '
    + 'For a worker with Gmail connected, prefer gmail-send so mail goes from their mailbox.',
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Plain text body' },
    },
    required: ['to', 'subject', 'body'],
  },
  execute: async (params) => {
    if (!config.resend.apiKey) {
      throw new Error('RESEND_API_KEY not set in .env');
    }

    const resend = new Resend(config.resend.apiKey);
    const { data, error } = await resend.emails.send({
      from: config.resend.from,
      to: String(params.to),
      subject: String(params.subject),
      text: String(params.body),
    });

    if (error) {
      throw new Error(error.message);
    }

    return { id: data?.id ?? '', message: 'Email sent.' };
  },
};

// ── SMTP-based sender (Gmail / any SMTP relay) ──────────────────────

export const emailSmtpSendTool: Tool = {
  name: 'email-smtp-send',
  dangerous: true,
  requiresConfirmation: true,
  description:
    'Send email via SMTP. Uses config.smtp (SMTP_HOST/USER/PASS or SMTP_PASSWORD), falling back to Resend SMTP when RESEND_API_KEY is set. '
    + 'Prefer email-send (Resend API) or gmail-send (connected Gmail) when those are available.',
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Plain text body' },
      from: {
        type: 'string',
        description:
          'Optional sender address (defaults to SMTP_FROM / SYSTEM_EMAIL_FROM / SMTP_USER)',
      },
    },
    required: ['to', 'subject', 'body'],
  },
  execute: async (params) => {
    // Align with gateway smtp-sender: SMTP_PASS, SMTP_PASSWORD, or RESEND_API_KEY.
    const host = process.env.SMTP_HOST?.trim() || config.smtp.host;
    const port = Number(process.env.SMTP_PORT ?? config.smtp.port ?? 587);
    const user =
      process.env.SMTP_USER?.trim()
      || (config.smtp.user ? String(config.smtp.user) : '')
      || '';
    const pass =
      process.env.SMTP_PASS?.trim()
      || process.env.SMTP_PASSWORD?.trim()
      || (config.smtp.password ? String(config.smtp.password) : '')
      || '';
    const from =
      String(params.from ?? '').trim()
      || process.env.SMTP_FROM?.trim()
      || process.env.SYSTEM_EMAIL_FROM?.trim()
      || config.smtp.from
      || user
      || '';

    if (!user || !pass) {
      throw new Error(
        'SMTP credentials missing. Set SMTP_USER + SMTP_PASS (or SMTP_PASSWORD), or RESEND_API_KEY for Resend SMTP.',
      );
    }
    if (!from) {
      throw new Error(
        'No sender address; set SMTP_FROM / SYSTEM_EMAIL_FROM or pass the "from" parameter.',
      );
    }

    const transport = createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const info = await transport.sendMail({
      from,
      to: String(params.to),
      subject: String(params.subject),
      text: String(params.body),
    });

    return {
      id: info.messageId,
      message: 'Email sent via SMTP.',
    };
  },
};

// ── Inbound email listing ────────────────────────────────────────────

export const emailListTool: Tool = {
  name: 'email-list',
  description:
    'List recent inbound emails stored from the Resend webhook only. '
    + 'This is NOT Gmail. For a worker with Gmail connected, use gmail-list instead.',
  parameters: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max emails to return', default: 10 },
      unread: { type: 'boolean', description: 'Only unread emails', default: false },
    },
  },
  execute: async (params) => {
    const limit = Math.min(50, Math.max(1, Number(params.limit ?? 10)));
    const unreadOnly = Boolean(params.unread);

    const sql = unreadOnly
      ? `SELECT id, from_address, to_address, subject, body_text, read, received_at
         FROM inbound_emails WHERE read = FALSE
         ORDER BY received_at DESC LIMIT $1`
      : `SELECT id, from_address, to_address, subject, body_text, read, received_at
         FROM inbound_emails ORDER BY received_at DESC LIMIT $1`;

    const { rows } = await pool.query(sql, [limit]);
    return rows;
  },
};
