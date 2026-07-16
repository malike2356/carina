import type { PackSkillInput } from './pack-types.js';
import { registry } from '../tools/registry.js';

export type SkillLintIssue = {
  level: 'error' | 'warn';
  code: string;
  message: string;
};

export type SkillLintResult = {
  ok: boolean;
  issues: SkillLintIssue[];
};

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function lintPackSkill(skill: PackSkillInput, packName = 'pack'): SkillLintResult {
  const issues: SkillLintIssue[] = [];

  if (!skill.name?.trim()) {
    issues.push({ level: 'error', code: 'name.missing', message: 'Skill name is required' });
  } else if (!NAME_PATTERN.test(skill.name)) {
    issues.push({
      level: 'error',
      code: 'name.format',
      message: `Skill name "${skill.name}" must be lowercase kebab-case`,
    });
  }

  if (!skill.description?.trim() || skill.description.trim().length < 10) {
    issues.push({
      level: 'error',
      code: 'description.short',
      message: `${skill.name}: description must be at least 10 characters`,
    });
  }

  if (!Array.isArray(skill.trigger) || skill.trigger.length === 0) {
    issues.push({
      level: 'error',
      code: 'trigger.empty',
      message: `${skill.name}: at least one trigger phrase is required`,
    });
  } else {
    for (const t of skill.trigger) {
      if (!String(t).trim()) {
        issues.push({ level: 'warn', code: 'trigger.blank', message: `${skill.name}: empty trigger ignored` });
      }
    }
  }

  if (!skill.steps?.trim() || skill.steps.trim().length < 20) {
    issues.push({
      level: 'error',
      code: 'steps.short',
      message: `${skill.name}: steps must be at least 20 characters`,
    });
  }

  const tools = skill.toolsUsed ?? [];
  const knownTools = new Set(registry.list().map((t) => t.name));
  for (const tool of tools) {
    if (!tool.trim()) {
      issues.push({ level: 'warn', code: 'tool.blank', message: `${skill.name}: blank tool reference` });
      continue;
    }
    if (!knownTools.has(tool) && !tool.startsWith('ext_')) {
      issues.push({
        level: 'warn',
        code: 'tool.unknown',
        message: `${skill.name}: tool "${tool}" is not registered (may be extension-scoped)`,
      });
    }
  }


  return {
    ok: issues.every((i) => i.level !== 'error'),
    issues,
  };
}

export function lintPackSkills(skills: PackSkillInput[], packName: string): SkillLintResult {
  const issues: SkillLintIssue[] = [];
  const seen = new Set<string>();

  for (const skill of skills) {
    const result = lintPackSkill(skill, packName);
    issues.push(...result.issues);
    if (skill.name) {
      if (seen.has(skill.name)) {
        issues.push({
          level: 'error',
          code: 'name.duplicate',
          message: `Duplicate skill name in ${packName}: ${skill.name}`,
        });
      }
      seen.add(skill.name);
    }
  }

  return {
    ok: issues.every((i) => i.level !== 'error'),
    issues,
  };
}

export function formatSkillLint(result: SkillLintResult): string {
  return result.issues
    .map((i) => `[${i.level}] ${i.code}: ${i.message}`)
    .join('\n');
}
