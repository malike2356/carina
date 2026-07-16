import { describe, expect, it } from 'vitest';
import { shouldCreateAutoTask } from './task-store';

describe('automatic task classification', () => {
  it('does not turn casual chat into a task', () => {
    expect(shouldCreateAutoTask([])).toBe(false);
  });

  it('creates an automatic task only after tool use', () => {
    expect(shouldCreateAutoTask(['web_search'])).toBe(true);
  });
});
