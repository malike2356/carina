import { Resend } from 'resend';
import { config } from '../config/index.js';
import { pool } from '../memory/db.js';
import type { Tool } from '../types/index.js';

export const emailSendTool: Tool = {
  name: 'email-send',
  dangerous: true,
  requiresConfirmation: true,
  description: 'Send a plain-text email via Resend.',
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

export const emailListTool: Tool = {
  name: 'email-list',
  description: 'List recent inbound emails stored from the Resend webhook.',
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
