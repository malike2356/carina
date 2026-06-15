import { describe, expect, it } from 'vitest';
import { buildScopedContext, parseWorkflowYaml } from './cron-workflow-parser.js';

describe('cron-workflow-parser', () => {
  it('parses declarative yaml workflow', () => {
    const def = parseWorkflowYaml(`
name: morning-brief
schedule: "0 9 * * *"
deliver_on: last
steps:
  - id: inbox
    prompt: Summarize inbox
  - id: brief
    prompt: Write briefing
    needs: [inbox]
    retries: 2
    deliver: false
on_failure:
  deliver: origin
  message: "Workflow failed at {{step}}"
`);
    expect(def.steps).toHaveLength(2);
    expect(def.steps[1]?.needs).toEqual(['inbox']);
    expect(def.steps[1]?.retries).toBe(2);
    expect(def.deliverOn).toBe('last');
  });

  it('buildScopedContext only includes requested step outputs', () => {
    const bag = {
      inbox: 'urgent: billing',
      brief: 'three bullets',
      secret: 'should not leak',
    };
    const ctx = buildScopedContext({
      id: 'send',
      contextFrom: ['brief'],
    }, bag);
    expect(ctx).toContain('three bullets');
    expect(ctx).not.toContain('billing');
    expect(ctx).not.toContain('should not leak');
  });
});
