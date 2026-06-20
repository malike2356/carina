import type { RedTeamExercise } from './types.js';

export const DEFAULT_RED_TEAM_EXERCISES: RedTeamExercise[] = [
  {
    id: 'weekly-prompt-injection',
    name: 'Weekly Prompt Injection Battery',
    attackType: 'prompt_injection',
    mitreTactic: 'TA0040',
    targetSystems: ['prompt_guard', 'rasp_engine'],
    schedule: '0 2 * * 0',
    results: [],
  },
  {
    id: 'daily-tool-abuse',
    name: 'Daily Tool Abuse Simulation',
    attackType: 'tool_sequence_attack',
    mitreTactic: 'TA0005',
    targetSystems: ['tool_sequence_guard', 'tool_policy', 'rasp_engine'],
    schedule: '0 3 * * *',
    results: [],
  },
  {
    id: 'weekly-data-exfil',
    name: 'Weekly Data Exfiltration Test',
    attackType: 'data_exfiltration',
    mitreTactic: 'TA0010',
    targetSystems: ['egress_filter', 'rasp_engine'],
    schedule: '0 4 * * 1',
    results: [],
  },
];

export function describeScheduleHint(cron: string): string {
  if (cron === '0 2 * * 0') return 'Every Sunday at 02:00';
  if (cron === '0 3 * * *') return 'Every day at 03:00';
  if (cron === '0 4 * * 1') return 'Every Monday at 04:00';
  return cron;
}

export function getExerciseById(id: string, exercises = DEFAULT_RED_TEAM_EXERCISES): RedTeamExercise | undefined {
  return exercises.find((row) => row.id === id);
}

export function listExerciseIds(): string[] {
  return DEFAULT_RED_TEAM_EXERCISES.map((row) => row.id);
}
