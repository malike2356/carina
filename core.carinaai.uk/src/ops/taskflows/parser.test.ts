import { describe, expect, it } from 'vitest';
import { parseTaskFlowYaml, validateTaskFlowDocument } from './parser.js';

describe('taskflow parser', () => {
  it('parses YAML with agent and kanban steps', () => {
    const doc = parseTaskFlowYaml(`
name: nightly-report
profile: ops
max_retries: 2
triggers:
  - type: cron
    job_id: daily-report
steps:
  - type: agent
    prompt: Summarize yesterday
    model:
      provider: anthropic
      model: claude-sonnet-4-20250514
  - type: kanban
    action: create_cards
    titles: [Research, Draft]
  - type: delay
    ms: 100
`);
    expect(doc.name).toBe('nightly-report');
    expect(doc.profileName).toBe('ops');
    expect(doc.maxRetries).toBe(2);
    expect(doc.steps).toHaveLength(3);
    expect(doc.steps[0]?.type).toBe('agent');
    expect(doc.steps[1]?.type).toBe('kanban');
  });

  it('rejects empty step list', () => {
    const errors = validateTaskFlowDocument({ name: 'x', steps: [] });
    expect(errors.length).toBeGreaterThan(0);
  });
});
