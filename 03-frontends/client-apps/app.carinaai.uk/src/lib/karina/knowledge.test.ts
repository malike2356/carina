import { describe, expect, it } from 'vitest';
import { KARINA_KNOWLEDGE_BASE, KARINA_GREETING } from './knowledge';
import { karinaRagContext } from './rag';

describe('karina knowledge base', () => {
  it('covers the current product surface and shared knowledge bridge', () => {
    expect(KARINA_KNOWLEDGE_BASE).toContain('Contacts');
    expect(KARINA_KNOWLEDGE_BASE).toContain('Files');
    expect(KARINA_KNOWLEDGE_BASE).toContain('GitHub memory');
    expect(KARINA_KNOWLEDGE_BASE).toContain('Scout is a separate governance product');
    expect(KARINA_KNOWLEDGE_BASE).toContain('Aiva is the customer-facing AI Employee workspace');
  });

  it('covers stuck-point guidance for schedules, reminders, and telegram', () => {
    expect(KARINA_KNOWLEDGE_BASE).toContain('Schedules vs Automations vs personal tasks');
    expect(KARINA_KNOWLEDGE_BASE).toContain('NOT a personal todo list');
    expect(KARINA_KNOWLEDGE_BASE).toContain('Reminder ID');
    expect(KARINA_KNOWLEDGE_BASE).toContain('Telegram quiet');
    expect(KARINA_KNOWLEDGE_BASE).toContain('Training tab');
  });

  it('greets users with the updated support scope', () => {
    expect(KARINA_GREETING).toContain('Aiva');
    expect(KARINA_GREETING).toContain('Scout');
  });

  it('retrieves contact, schedules, and reminder help', () => {
    const contactsContext = karinaRagContext('where do I find contacts');
    const bridgeContext = karinaRagContext('how does the GitHub sync bridge work');
    const schedulesContext = karinaRagContext('where is my task list reminder schedules');
    const telegramContext = karinaRagContext('telegram aiva not replying quiet');

    expect(contactsContext.toLowerCase()).toMatch(/contacts/);
    expect(bridgeContext.toLowerCase()).toMatch(/github|agent-sync|bridge/);
    expect(schedulesContext.toLowerCase()).toMatch(/schedules|reminder|todo|automations/);
    expect(telegramContext.toLowerCase()).toMatch(/telegram|botfather|channels/);
  });
});
