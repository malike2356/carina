import type { Tool } from '../types/index.js';
import {
  deleteSkill,
  getSkillByName,
  listSkills,
  saveSkill,
  updateSkill,
} from '../skills/store.js';

export const skillsListTool: Tool = {
  name: 'skills-list',
  description:
    'List all skills available to the agent (pack skills and user-created). Returns id, name, description, triggers array, and usage_count for each. limit: max skills to return, default 50, max 200. Use skill-view to see full steps for a specific skill.',
  parameters: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max skills to return (default 50)' },
    },
  },
  execute: async (params) => {
    const limit = Math.max(1, Math.min(Number(params.limit ?? 50), 200));
    try {
      const skills = await listSkills();
      return {
        count: skills.length,
        skills: skills.slice(0, limit).map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          triggers: s.trigger,
          usage_count: s.usageCount,
        })),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const skillViewTool: Tool = {
  name: 'skill-view',
  description:
    'View the full content of a skill by name. Returns id, name, description, triggers, steps (markdown), tools_used, usage_count, and created_at. Use skills-list first to find the exact skill name.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Skill name' },
    },
    required: ['name'],
  },
  execute: async (params) => {
    const name = String(params.name ?? '').trim();
    if (!name) return { error: 'name is required' };
    try {
      const skill = await getSkillByName(name);
      if (!skill) return { error: `skill not found: ${name}` };
      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        triggers: skill.trigger,
        steps: skill.steps,
        tools_used: skill.toolsUsed,
        usage_count: skill.usageCount,
        created_at: skill.createdAt.toISOString(),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const skillManageTool: Tool = {
  name: 'skill-manage',
  dangerous: true,
  requiresConfirmation: true,
  description:
    'Create, update, or delete user skills. action: create - saves a new skill (name, description, steps required; triggers and tools_used optional); update - patches fields on an existing skill by name (only provided fields are changed); delete - removes a skill by name permanently. Requires confirmation for update and delete. Returns status: created/updated/deleted on success.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'update', 'delete'] },
      name: { type: 'string', description: 'Skill name' },
      description: { type: 'string', description: 'Skill description (create/update)' },
      triggers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Trigger keywords (create/update)',
      },
      steps: { type: 'string', description: 'Skill steps markdown (create/update)' },
      tools_used: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tools this skill uses (create/update)',
      },
    },
    required: ['action', 'name'],
  },
  needsConfirmation: (params) => {
    const action = String(params.action ?? '').toLowerCase();
    return action === 'delete' || action === 'update';
  },
  execute: async (params) => {
    const action = String(params.action ?? '').toLowerCase();
    const name = String(params.name ?? '').trim();
    if (!name) return { error: 'name is required' };

    if (action === 'create') {
      const description = String(params.description ?? '').trim();
      const steps = String(params.steps ?? '').trim();
      const triggers = Array.isArray(params.triggers)
        ? (params.triggers as string[]).map(String)
        : [];
      const toolsUsed = Array.isArray(params.tools_used)
        ? (params.tools_used as string[]).map(String)
        : [];

      if (!description || !steps) {
        return { error: 'description and steps are required for create' };
      }

      try {
        const existing = await getSkillByName(name);
        if (existing) return { error: `skill already exists: ${name}` };
        const skill = await saveSkill({ name, description, trigger: triggers, steps, toolsUsed });
        return { status: 'created', id: skill.id, name: skill.name };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (action === 'update') {
      try {
        const existing = await getSkillByName(name);
        if (!existing) return { error: `skill not found: ${name}` };

        const updates: Record<string, unknown> = {};
        if (params.description !== undefined) updates.description = String(params.description);
        if (params.steps !== undefined) updates.steps = String(params.steps);
        if (params.triggers !== undefined) {
          updates.trigger = Array.isArray(params.triggers)
            ? (params.triggers as string[]).map(String)
            : [];
        }
        if (params.tools_used !== undefined) {
          updates.toolsUsed = Array.isArray(params.tools_used)
            ? (params.tools_used as string[]).map(String)
            : [];
        }

        const skill = await updateSkill(name, updates);
        return { status: 'updated', id: skill.id, name: skill.name };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (action === 'delete') {
      try {
        const removed = await deleteSkill(name);
        if (!removed) return { error: `skill not found: ${name}` };
        return { status: 'deleted', name };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    return { error: `unknown action: ${action}` };
  },
};
