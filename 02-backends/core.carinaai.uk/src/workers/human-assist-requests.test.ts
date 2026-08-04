import { describe, expect, it } from 'vitest';
import { canHumanAssistTransition } from './human-assist-requests.js';

describe('canHumanAssistTransition', () => {
  it('allows claim from queued', () => {
    expect(canHumanAssistTransition('queued', 'assigned')).toBe(true);
  });

  it('allows start and complete flow', () => {
    expect(canHumanAssistTransition('assigned', 'in_progress')).toBe(true);
    expect(canHumanAssistTransition('in_progress', 'done')).toBe(true);
  });

  it('blocks terminal reopen', () => {
    expect(canHumanAssistTransition('done', 'queued')).toBe(false);
    expect(canHumanAssistTransition('declined', 'assigned')).toBe(false);
  });

  it('blocks skip from queued to done', () => {
    expect(canHumanAssistTransition('queued', 'done')).toBe(false);
  });
});
