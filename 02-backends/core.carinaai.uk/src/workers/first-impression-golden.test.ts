import { describe, expect, it } from 'vitest';
import { buildEmployeeWelcomeSeedMessage } from '../aiva/employee-comms.js';
import { aivaEmptyReplyFallback } from './aiva-empty-reply.js';

describe('first impression golden cases', () => {
  it('G1 welcome seed is useful and not blank', () => {
    const reply = buildEmployeeWelcomeSeedMessage('Aiva');
    expect(reply).toContain('Welcome to Aiva.');
    expect(reply).toContain('/aiva/tools');
    expect(reply).toContain('Google Calendar');
    expect(reply).not.toMatch(/^$/);
  });

  it('G2 calendar ask gets a connect CTA instead of an empty reply', () => {
    const reply = aivaEmptyReplyFallback('check my calender for hospital meetings');
    expect(reply).toContain('Google Calendar');
    expect(reply).toContain('/aiva/tools?tool=google-calendar');
    expect(reply).not.toMatch(/unable to respond/i);
  });

  it('G4 email search ask gets Gmail reconnect guidance', () => {
    const reply = aivaEmptyReplyFallback('retrospective email search');
    expect(reply).toContain('Gmail');
    expect(reply).toContain('/aiva/tools?tool=gmail');
    expect(reply).toContain('needs_reauth');
  });
});
