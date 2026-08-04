import { config } from '../config/index.js';
import { findContact, type ContactProfile } from '../profiles/contacts.js';

function appContactsUrl(query?: string): string {
  const url = new URL('/contacts', config.product.appUrl);
  if (query?.trim()) url.searchParams.set('q', query.trim());
  return url.toString();
}

function formatContact(contact: ContactProfile, index: number): string {
  const channels = [
    contact.email ? `email: ${contact.email}` : '',
    contact.phone ? `phone: ${contact.phone}` : '',
    contact.whatsapp ? `whatsapp: ${contact.whatsapp}` : '',
    contact.telegram ? `telegram: ${contact.telegram}` : '',
  ].filter(Boolean);
  const meta = [
    contact.role || 'No role',
    contact.source || 'manual',
    channels.length > 0 ? channels.join(', ') : 'No direct channel',
  ].join(' | ');
  return `${index + 1}. ${contact.name} - ${meta}`;
}

function parseContactsQuery(input: string): { openOnly: boolean; query: string } {
  const trimmed = input.trim();
  const rest = trimmed.replace(/^\/contacts(?:@\w+)?/i, '').trim();
  if (!rest) {
    return { openOnly: true, query: '' };
  }
  const normalized = rest.replace(/^\b(?:open|show|module|list)\b\s*/i, '').trim();
  if (!normalized) {
    return { openOnly: true, query: '' };
  }
  const searchMatch = normalized.match(/^(?:search|find|lookup|for)\s+(.+)$/i);
  return { openOnly: false, query: (searchMatch?.[1] ?? normalized).trim() };
}

export async function formatContactsCommandReply(input: string): Promise<string> {
  const { openOnly, query } = parseContactsQuery(input);
  const moduleUrl = appContactsUrl(query || undefined);

  if (openOnly && !query) {
    return [
      `Contacts module: ${appContactsUrl()}`,
      'Use /contacts search <name> to search your synced contacts, or open the module to add and edit entries.',
    ].join('\n');
  }

  const matches = await findContact(query);
  if (matches.length === 0) {
    return [
      `No contacts matched "${query}".`,
      `Open Contacts: ${moduleUrl}`,
    ].join('\n');
  }

  return [
    `Contacts search for "${query}": ${matches.length} result${matches.length === 1 ? '' : 's'}.`,
    `Open Contacts: ${moduleUrl}`,
    '',
    ...matches.slice(0, 5).map((contact, index) => formatContact(contact, index)),
  ].join('\n');
}

