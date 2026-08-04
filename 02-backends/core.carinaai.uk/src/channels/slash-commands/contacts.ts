import type { SlashCommand } from './registry.js';
import { formatContactsCommandReply } from '../../contacts/contacts-command.js';

export const contactsCommand: SlashCommand = {
  name: 'contacts',
  description: 'Search contacts or open the Contacts module',
  async handler(msg) {
    return formatContactsCommandReply(msg.content);
  },
};

