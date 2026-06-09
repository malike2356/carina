import type { Tool } from '../types/index.js';
import {
  archiveSkill,
  curateFromWorkflow,
  listCuratedSkills,
  pruneStaleSkills,
  restoreSkill,
} from '../skills/curator.js';

export const skillCuratorTool: Tool = {
  name: 'skill-curator',
  description:
    'Skill curator lifecycle. Actions: list, archive, restore, prune, curate.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'archive', 'restore', 'prune', 'curate'] },
      name: { type: 'string' },
      status: { type: 'string', enum: ['active', 'archived', 'pruned'] },
      reason: { type: 'string' },
      dry_run: { type: 'boolean' },
      min_usage: { type: 'number' },
      max_age_days: { type: 'number' },
      description: { type: 'string' },
      trigger: { type: 'array', items: { type: 'string' } },
      steps: { type: 'string' },
      tools_used: { type: 'array', items: { type: 'string' } },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');

    if (action === 'list') {
      const status = String(params.status ?? 'active') as 'active' | 'archived' | 'pruned';
      const skills = await listCuratedSkills(status);
      return { skills, count: skills.length };
    }

    if (action === 'archive') {
      const name = String(params.name ?? '').trim();
      if (!name) return { error: 'name is required' };
      const ok = await archiveSkill(name, params.reason ? String(params.reason) : undefined);
      return ok ? { archived: name } : { error: 'skill not found or already archived' };
    }

    if (action === 'restore') {
      const name = String(params.name ?? '').trim();
      if (!name) return { error: 'name is required' };
      const ok = await restoreSkill(name);
      return ok ? { restored: name } : { error: 'skill not found' };
    }

    if (action === 'prune') {
      return pruneStaleSkills({
        dryRun: Boolean(params.dry_run),
        minUsage: params.min_usage != null ? Number(params.min_usage) : undefined,
        maxAgeDays: params.max_age_days != null ? Number(params.max_age_days) : undefined,
      });
    }

    if (action === 'curate') {
      const name = String(params.name ?? '').trim();
      const steps = String(params.steps ?? '').trim();
      if (!name || !steps) return { error: 'name and steps are required' };
      return curateFromWorkflow({
        name,
        description: String(params.description ?? name),
        trigger: Array.isArray(params.trigger) ? params.trigger.map(String) : [name],
        steps,
        toolsUsed: Array.isArray(params.tools_used) ? params.tools_used.map(String) : [],
      });
    }

    return { error: `unknown action: ${action}` };
  },
};
