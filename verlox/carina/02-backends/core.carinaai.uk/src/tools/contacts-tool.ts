import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import type { Tool } from '../types/index.js';
import { findContact, loadAllContacts, contactsContextBlock } from '../profiles/contacts.js';
import type { ContactProfile } from '../profiles/contacts.js';

function contactsDir(): string {
  const home = process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina');
  return path.join(home, 'profiles', 'contacts');
}

async function findContactFile(id: string): Promise<{ filePath: string; contacts: ContactProfile[] } | null> {
  const dir = contactsDir();
  if (!fsSync.existsSync(dir)) return null;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(dir, entry.name);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(raw) as ContactProfile[] | { contacts?: ContactProfile[] };
      const list = Array.isArray(data) ? data : (data.contacts ?? []);
      if (list.some((c) => c.id === id)) return { filePath, contacts: list };
    } catch { /* skip */ }
  }
  const rootFile = path.join(process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina'), 'contacts.json');
  if (fsSync.existsSync(rootFile)) {
    try {
      const raw = await fs.readFile(rootFile, 'utf8');
      const data = JSON.parse(raw) as ContactProfile[] | { contacts?: ContactProfile[] };
      const list = Array.isArray(data) ? data : (data.contacts ?? []);
      if (list.some((c) => c.id === id)) return { filePath: rootFile, contacts: list };
    } catch { /* skip */ }
  }
  return null;
}

export const contactsTool: Tool = {
  name: 'contacts',
  description:
    'Manage personal and business contacts from Carina profiles. Actions: list, search, context, send, update.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'search', 'context', 'send', 'update'] },
      query: { type: 'string', description: 'Contact name or email for search/send/update' },
      message: { type: 'string', description: 'Message text for send action' },
      channel: { type: 'string', enum: ['whatsapp', 'telegram', 'email', 'phone'], description: 'Preferred channel for send' },
      notes: { type: 'string', description: 'New notes for update action' },
      tags: { type: 'array', items: { type: 'string' }, description: 'New tags for update action' },
      phone: { type: 'string', description: 'New phone number for update action' },
      email: { type: 'string', description: 'New email for update action' },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');

    if (action === 'list') {
      const contacts = await loadAllContacts();
      return { contacts, count: contacts.length };
    }

    if (action === 'search') {
      const query = String(params.query ?? '').trim();
      if (!query) return { error: 'query is required for search' };
      return { contacts: await findContact(query) };
    }

    if (action === 'context') {
      const query = params.query ? String(params.query) : '';
      const contacts = query ? await findContact(query) : await loadAllContacts();
      return { context: contactsContextBlock(contacts.slice(0, 20)) };
    }

    if (action === 'send') {
      const query = String(params.query ?? '').trim();
      const message = String(params.message ?? '').trim();
      if (!query) return { error: 'query is required for send' };
      if (!message) return { error: 'message is required for send' };

      const results = await findContact(query);
      if (results.length === 0) return { error: `No contact found matching "${query}"` };
      const contact = results[0];

      const preferred = params.channel ? String(params.channel) : null;
      const channelOrder = preferred
        ? [preferred, 'whatsapp', 'telegram', 'email']
        : ['whatsapp', 'telegram', 'email'];

      let resolvedChannel: string | null = null;
      let resolvedIdentifier: string | null = null;

      for (const ch of channelOrder) {
        if (ch === 'whatsapp' && contact.whatsapp) { resolvedChannel = 'whatsapp'; resolvedIdentifier = contact.whatsapp; break; }
        if (ch === 'telegram' && contact.telegram) { resolvedChannel = 'telegram'; resolvedIdentifier = contact.telegram; break; }
        if (ch === 'email' && contact.email) { resolvedChannel = 'email'; resolvedIdentifier = contact.email; break; }
        if (ch === 'phone' && contact.phone) { resolvedChannel = 'phone'; resolvedIdentifier = contact.phone; break; }
      }

      if (!resolvedChannel || !resolvedIdentifier) {
        return { error: `Contact "${contact.name}" has no reachable channel. Available: ${JSON.stringify({ whatsapp: contact.whatsapp, telegram: contact.telegram, email: contact.email, phone: contact.phone })}` };
      }

      return {
        action: 'send_pending',
        contact: { id: contact.id, name: contact.name },
        channel: resolvedChannel,
        identifier: resolvedIdentifier,
        message,
        instruction: `Use the send-message tool with channel="${resolvedChannel}", recipient="${resolvedIdentifier}", and the message content above.`,
      };
    }

    if (action === 'update') {
      const query = String(params.query ?? '').trim();
      if (!query) return { error: 'query is required for update' };

      const results = await findContact(query);
      if (results.length === 0) return { error: `No contact found matching "${query}"` };
      const contact = results[0];

      const found = await findContactFile(contact.id);
      if (!found) return { error: `Contact file not found for "${contact.name}"` };

      const updated = found.contacts.map((c) => {
        if (c.id !== contact.id) return c;
        const patch: Partial<ContactProfile> = {};
        if (params.notes != null) patch.notes = String(params.notes);
        if (Array.isArray(params.tags)) patch.tags = (params.tags as unknown[]).map(String);
        if (params.phone != null) { patch.phone = String(params.phone); patch.whatsapp = patch.whatsapp ?? String(params.phone); }
        if (params.email != null) patch.email = String(params.email);
        return { ...c, ...patch };
      });

      await fs.writeFile(found.filePath, JSON.stringify(updated, null, 2), 'utf8');
      return { ok: true, contact: updated.find((c) => c.id === contact.id) };
    }

    return { error: `unknown action: ${action}` };
  },
};
