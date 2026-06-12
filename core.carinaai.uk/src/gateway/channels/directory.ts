import type { ChannelName } from './channel-adapter.interface.js';
import { findContact, loadAllContacts, type ContactProfile } from '../../profiles/contacts.js';

export type DirectoryEntry = {
  channel: ChannelName | 'phone' | 'email';
  peerId: string;
  displayName: string;
  source: 'contacts' | 'manual';
  group?: boolean;
};

const manualPeers = new Map<string, DirectoryEntry>();

function manualKey(channel: string, peerId: string): string {
  return `${channel}:${peerId}`;
}

export function registerDirectoryPeer(entry: DirectoryEntry): void {
  manualPeers.set(manualKey(entry.channel, entry.peerId), entry);
}

export async function lookupDirectoryPeer(
  channel: ChannelName,
  peerId: string,
): Promise<DirectoryEntry | null> {
  const manual = manualPeers.get(manualKey(channel, peerId));
  if (manual) return manual;

  const contacts = await loadAllContacts();
  for (const c of contacts) {
    const match = matchContactToPeer(c, channel, peerId);
    if (match) return match;
  }
  return null;
}

function matchContactToPeer(
  contact: ContactProfile,
  channel: ChannelName,
  peerId: string,
): DirectoryEntry | null {
  const normalized = peerId.replace(/\D/g, '');
  if (channel === 'telegram' && contact.telegram && contact.telegram === peerId) {
    return { channel, peerId, displayName: contact.name, source: 'contacts' };
  }
  if (channel === 'whatsapp' && contact.whatsapp) {
    const w = contact.whatsapp.replace(/\D/g, '');
    if (w && (peerId.includes(w) || normalized.includes(w))) {
      return { channel, peerId, displayName: contact.name, source: 'contacts' };
    }
  }
  if ((channel === 'sms' || channel === 'signal') && contact.phone) {
    const p = contact.phone.replace(/\D/g, '');
    if (p && normalized.includes(p)) {
      return { channel, peerId, displayName: contact.name, source: 'contacts' };
    }
  }
  if (channel === 'email' && contact.email && contact.email.toLowerCase() === peerId.toLowerCase()) {
    return { channel, peerId, displayName: contact.name, source: 'contacts' };
  }
  if (channel === 'imessage' && contact.phone) {
    const p = contact.phone.replace(/\D/g, '');
    const normalized = peerId.replace(/\D/g, '');
    if (p && normalized.includes(p)) {
      return { channel, peerId, displayName: contact.name, source: 'contacts' };
    }
  }
  if (channel === 'discord' || channel === 'slack' || channel === 'mattermost') {
    const tagHit = contact.tags?.find((t) => t.startsWith(`${channel}:`));
    if (tagHit) {
      const taggedId = tagHit.split(':').slice(1).join(':');
      if (taggedId === peerId) {
        return { channel, peerId, displayName: contact.name, source: 'contacts' };
      }
    }
  }
  return null;
}

export async function searchDirectory(
  channel: ChannelName,
  query: string,
): Promise<DirectoryEntry[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: DirectoryEntry[] = [];
  for (const entry of manualPeers.values()) {
    if (entry.channel !== channel) continue;
    if (entry.displayName.toLowerCase().includes(q) || entry.peerId.includes(q)) {
      results.push(entry);
    }
  }

  const contacts = await findContact(q);
  for (const c of contacts) {
    const peerField = channel === 'telegram' ? c.telegram
      : channel === 'whatsapp' ? c.whatsapp
        : channel === 'email' ? c.email
          : c.phone;
    if (!peerField) continue;
    results.push({
      channel,
      peerId: String(peerField),
      displayName: c.name,
      source: 'contacts',
    });
  }
  return results;
}

export async function listDirectoryGroups(channel: ChannelName): Promise<DirectoryEntry[]> {
  return [...manualPeers.values()].filter((e) => e.group === true && e.channel === channel);
}
