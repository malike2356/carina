import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatContactsCommandReply } from './contacts-command.js';

const { findContact } = vi.hoisted(() => ({
  findContact: vi.fn(),
}));

vi.mock('../profiles/contacts.js', () => ({
  findContact,
}));

afterEach(() => {
  findContact.mockReset();
});

describe('contacts command reply', () => {
  it('opens the contacts module when no query is provided', async () => {
    const reply = await formatContactsCommandReply('/contacts');
    expect(reply).toContain('Contacts module:');
    expect(reply).toContain('/contacts');
  });

  it('searches contacts and includes a direct module link', async () => {
    findContact.mockResolvedValue([
      {
        id: 'contact-1',
        name: 'Jane Doe',
        role: 'Chief Operator',
        email: 'jane@example.com',
        phone: '+44 7000 000001',
        source: 'manual',
      },
    ]);

    const reply = await formatContactsCommandReply('/contacts search Jane');
    expect(findContact).toHaveBeenCalledWith('Jane');
    expect(reply).toContain('Contacts search for "Jane": 1 result');
    expect(reply).toContain('Open Contacts:');
    expect(reply).toContain('Jane Doe');
    expect(reply).toContain('jane@example.com');
  });
});
