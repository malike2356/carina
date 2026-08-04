import { describe, expect, it } from 'vitest';
import { buildAgentOsMilestones } from './agent-os-progress';

describe('buildAgentOsMilestones', () => {
  it('returns the day 1, 7, and 30 milestones in order', () => {
    const milestones = buildAgentOsMilestones({
      documentCount: 0,
      workflowCount: 0,
      activeTaskCount: 0,
    });
    expect(milestones.map((milestone) => milestone.id)).toEqual(['day-1', 'day-7', 'day-30']);
    expect(milestones.every((milestone) => !milestone.complete)).toBe(true);
  });

  it('marks milestones complete from production activity counts', () => {
    const milestones = buildAgentOsMilestones({
      documentCount: 1,
      workflowCount: 2,
      activeTaskCount: 1,
    });
    expect(milestones.every((milestone) => milestone.complete)).toBe(true);
  });
});
