# Cursor Task: Fix and test send-message (#23) tool in Carina

## Context

Carina is a Node.js/TypeScript autonomous AI agent at:
`/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`

We are hardening the 27 Hermes tools one by one. This task covers tool #23:
`send-message`.

Read these files in full before touching anything:
- `src/tools/send-message.ts` (the only source file to change)
- `src/profiles/contacts.ts` (read only - understand what `findContact` can throw)
- `src/gateway/channels/channel-registry.ts` (read only - understand `ChannelRegistry`)
- `src/gateway/channels/channel-adapter.interface.ts` (read only - understand `IChannelAdapter`)

Do NOT modify any file except `src/tools/send-message.ts` and the new test file.

---

## Bug: `findContact` and contact resolution path have no error handling

The `execute` function calls `findContact(contactName)` which calls `loadAllContacts`
which calls `fs.readdir` on directories verified by `existsSync`. Between the
`existsSync` check and the `readdir` call, the directory can be deleted, causing
`readdir` to throw. Because there is no try/catch around the `findContact` call,
that error propagates out of `execute` as an unhandled rejection.

The same applies to any unexpected error in the contact resolution block.

### Fix: wrap the entire execute body in try/catch

Replace the current `execute` with:

```typescript
execute: async (params) => {
  try {
    let channel = String(params.channel ?? '').toLowerCase() as ChannelName;
    let conversationId = String(params.conversation_id ?? '').trim();
    const text = String(params.text ?? '').trim();
    const threadId = params.thread_id ? String(params.thread_id) : undefined;
    const contactName = String(params.contact_name ?? '').trim();

    if (!text) return { error: 'text is required' };

    if (contactName) {
      const matches = await findContact(contactName);
      if (matches.length === 0) return { error: `contact not found: ${contactName}` };
      const c = matches[0];
      if (!channel) {
        if (c.whatsapp) channel = 'whatsapp';
        else if (c.telegram) channel = 'telegram';
        else if (c.email) channel = 'email';
        else return { error: `contact ${c.name} has no messaging channel configured` };
      }
      if (!conversationId) {
        if (channel === 'whatsapp' && c.whatsapp) conversationId = `${c.whatsapp.replace(/\D/g, '')}@s.whatsapp.net`;
        else if (channel === 'telegram' && c.telegram) conversationId = c.telegram;
        else if (channel === 'email' && c.email) conversationId = c.email;
        else return { error: `contact ${c.name} has no ${channel} address` };
      }
    }

    if (!channel) return { error: 'channel or contact_name is required' };
    if (!conversationId) return { error: 'conversation_id is required (or use contact_name)' };
    if (!OUTBOUND_CHANNELS.includes(channel)) {
      return { error: `unsupported channel: ${channel}` };
    }

    const adapter = channelRegistry.getByName(channel);
    if (!adapter) {
      return { error: `channel adapter not loaded: ${channel}` };
    }
    if (!adapter.enabled) {
      return { error: `channel not enabled or configured: ${channel}` };
    }

    try {
      await adapter.sendMessage(conversationId, text, { threadId });
      return { sent: true, channel, conversation_id: conversationId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `send failed: ${msg}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
},
```

The inner try/catch around `adapter.sendMessage` is kept as-is. The outer try/catch
catches anything unexpected from `findContact` or the resolution logic.

---

## Improvement: update the description

Replace the current description with:

```
'Send a text message on any enabled channel. Supported channels: telegram, discord, slack, sms, whatsapp, signal, matrix, mattermost, dingtalk, feishu, wechat, imessage, email, homeassistant, api, webhooks. Contact resolution: pass contact_name to look up the contact from contacts.json and auto-select whatsapp, telegram, or email. If both contact_name and channel are given, that channel is used for lookup. Direct mode: pass channel + conversation_id explicitly (Telegram: numeric chat ID, WhatsApp: number@s.whatsapp.net, email: address). Returns { sent: true, channel, conversation_id } on success.'
```

---

## Create `src/tools/send-message.test.ts`

No test file exists. Create it. Mock both `findContact` and `channelRegistry` using
`vi.hoisted` so the mocks are stable under ESM.

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { findContactMock, getByNameMock } = vi.hoisted(() => {
  const findContactMock = vi.fn();
  const getByNameMock = vi.fn();
  return { findContactMock, getByNameMock };
});

vi.mock('../profiles/contacts.js', () => ({
  findContact: findContactMock,
}));

vi.mock('../gateway/channels/channel-registry.js', () => ({
  channelRegistry: {
    getByName: getByNameMock,
  },
}));

function makeAdapter(overrides: Partial<{ enabled: boolean; sendMessage: () => Promise<void> }> = {}): object {
  return {
    enabled: true,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findContactMock.mockResolvedValue([]);
  getByNameMock.mockReturnValue(undefined);
});

describe('send-message tool', () => {
  it('returns error when text is empty', async () => {
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({ text: '' }) as { error?: string };
    expect(result.error).toContain('text is required');
  });

  it('returns error when channel and contact_name are both absent', async () => {
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      conversation_id: '123',
    }) as { error?: string };
    expect(result.error).toContain('channel');
  });

  it('returns error when conversation_id is missing without contact_name', async () => {
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      channel: 'telegram',
    }) as { error?: string };
    expect(result.error).toContain('conversation_id');
  });

  it('returns error when contact_name is not found', async () => {
    findContactMock.mockResolvedValue([]);
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      contact_name: 'Nobody',
    }) as { error?: string };
    expect(result.error).toContain('contact not found');
  });

  it('returns error when contact has no messaging channel', async () => {
    findContactMock.mockResolvedValue([{ name: 'Alice', id: '1', source: 'carina' }]);
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      contact_name: 'Alice',
    }) as { error?: string };
    expect(result.error).toContain('no messaging channel');
  });

  it('returns error when channel adapter is not loaded', async () => {
    getByNameMock.mockReturnValue(undefined);
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      channel: 'telegram',
      conversation_id: '12345',
    }) as { error?: string };
    expect(result.error).toContain('not loaded');
  });

  it('returns error when channel adapter is not enabled', async () => {
    getByNameMock.mockReturnValue(makeAdapter({ enabled: false }));
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      channel: 'telegram',
      conversation_id: '12345',
    }) as { error?: string };
    expect(result.error).toContain('not enabled');
  });

  it('returns error when sendMessage throws', async () => {
    const adapter = makeAdapter({
      sendMessage: vi.fn().mockRejectedValue(new Error('network timeout')),
    } as { sendMessage: () => Promise<never> });
    getByNameMock.mockReturnValue(adapter);
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      channel: 'telegram',
      conversation_id: '12345',
    }) as { error?: string };
    expect(result.error).toContain('network timeout');
  });

  it('returns sent:true on success with direct channel+conversation_id', async () => {
    getByNameMock.mockReturnValue(makeAdapter());
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      channel: 'telegram',
      conversation_id: '12345',
    }) as { sent?: boolean; channel?: string; conversation_id?: string };
    expect(result.sent).toBe(true);
    expect(result.channel).toBe('telegram');
    expect(result.conversation_id).toBe('12345');
  });

  it('resolves contact and sends via telegram', async () => {
    findContactMock.mockResolvedValue([{
      id: '1', name: 'Alice', telegram: '67890', source: 'carina',
    }]);
    getByNameMock.mockReturnValue(makeAdapter());
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hi Alice',
      contact_name: 'Alice',
    }) as { sent?: boolean; channel?: string };
    expect(result.sent).toBe(true);
    expect(result.channel).toBe('telegram');
  });

  it('returns error when findContact throws unexpectedly', async () => {
    findContactMock.mockRejectedValue(new Error('EACCES: permission denied'));
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      contact_name: 'Alice',
    }) as { error?: string };
    expect(result.error).toContain('EACCES');
  });
});
```

---

## What NOT to change

- Do not change `contacts.ts`, `channel-registry.ts`, or `channel-adapter.interface.ts`.
- Do not change `dangerous: true`, `requiresConfirmation: true`, or the parameter schema.
- Do not change the `OUTBOUND_CHANNELS` list.
- Do not change the inner try/catch around `adapter.sendMessage`.

---

## General rules

- TypeScript only. No `any` unless unavoidable.
- No em dashes, no emojis anywhere.
- Run `npx tsc --noEmit` after changes and fix all errors before moving on.

---

## Verification checklist

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run src/tools/send-message.test.ts` - all 11 tests pass
- [ ] Outer try/catch wraps the full execute body in `send-message.ts`
- [ ] Description updated
- [ ] Regression: `npx vitest run src/tools/cronjob.test.ts src/tools/browser/session.test.ts src/tools/code.test.ts src/tools/delegate-task.test.ts` - all pass
