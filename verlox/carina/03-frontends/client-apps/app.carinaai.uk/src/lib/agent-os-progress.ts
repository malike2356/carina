export type AgentOsProgressInput = {
  documentCount: number;
  workflowCount: number;
  activeTaskCount: number;
};

export type AgentOsMilestone = {
  id: 'day-1' | 'day-7' | 'day-30';
  title: string;
  copy: string;
  complete: boolean;
};

export function buildAgentOsMilestones(input: AgentOsProgressInput): AgentOsMilestone[] {
  return [
    {
      id: 'day-1',
      title: 'First useful output',
      copy: 'Create your first document with an Agent OS workflow.',
      complete: input.documentCount > 0,
    },
    {
      id: 'day-7',
      title: 'Repeatable workflow',
      copy: 'Save a workflow you can run again.',
      complete: input.workflowCount > 0,
    },
    {
      id: 'day-30',
      title: 'Ongoing automation',
      copy: 'Keep at least one scheduled task active.',
      complete: input.activeTaskCount > 0,
    },
  ];
}
