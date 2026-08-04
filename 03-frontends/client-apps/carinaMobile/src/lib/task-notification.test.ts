import { describe, expect, it } from 'vitest';
import {
  buildTaskNotificationContent,
  shouldNotifyForAppState,
  truncatePrompt,
} from './task-notification';

describe('task-notification', () => {
  it('truncates long prompts', () => {
    const long = 'a'.repeat(100);
    expect(truncatePrompt(long, 20).length).toBe(20);
    expect(truncatePrompt(long, 20).endsWith('…')).toBe(true);
  });

  it('builds completed notification copy', () => {
    expect(buildTaskNotificationContent('Draft email', 'completed')).toEqual({
      title: 'Task completed',
      body: 'Draft email',
    });
  });

  it('builds failed notification copy', () => {
    expect(buildTaskNotificationContent('Research topic', 'failed').title).toBe(
      'Task failed',
    );
  });

  it('notifies only when app is not active', () => {
    expect(shouldNotifyForAppState('active')).toBe(false);
    expect(shouldNotifyForAppState('background')).toBe(true);
    expect(shouldNotifyForAppState('inactive')).toBe(true);
  });
});
