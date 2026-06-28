import type { SlashCommand } from './registry.js';
import type { InboundMessage } from '../types.js';
import { pool } from '../../memory/db.js';

export const newCommand: SlashCommand = {
  name: 'new',
  description: 'Start a fresh conversation (forget current context)',
  async handler(msg: InboundMessage) {
    try {
      const key = `tg:${msg.contactId}`;
      await pool.query(
        `DELETE FROM aiva_messages WHERE session_id IN (
          SELECT id FROM aiva_sessions WHERE external_key = $1 AND worker_id = $2
        )`,
        [key, msg.workerId],
      );
      await pool.query(
        `DELETE FROM aiva_sessions WHERE external_key = $1 AND worker_id = $2`,
        [key, msg.workerId],
      );
      return 'Fresh conversation started. Previous context cleared.';
    } catch (err) {
      return 'Fresh conversation started. (Note: if you were in a long session, start a new chat in Telegram for a clean break.)';
    }
  },
};
