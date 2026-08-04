import type { Tool } from '../types/index.js';
import { findContact, loadAllContacts, contactsContextBlock } from '../profiles/contacts.js';

export const contactsTool: Tool = {
  name: 'contacts',
  description:
    'Lookup personal and business contacts from Carina profiles. Actions: list, search, context.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'search', 'context'] },
      query: { type: 'string' },
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

    return { error: `unknown action: ${action}` };
  },
};
