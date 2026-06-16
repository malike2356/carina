import fs from 'fs/promises';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';
import { ensureAgentsConfig } from '../workspaces/agent-registry.js';
import { resolveAgentWorkspace } from '../workspaces/paths.js';

const DEFAULT_USER_PLACEHOLDER = 'Operator name, background, preferences';

export function buildUserProfileMarkdown(operatorName: string, operatorContext: string): string {
  const lines = ['# USER.md', ''];
  if (operatorName.trim()) {
    lines.push(`- **Name:** ${operatorName.trim()}`);
  }
  if (operatorContext.trim()) {
    lines.push(`- **Focus:** ${operatorContext.trim()}`);
  }
  lines.push('', 'Preferences and communication style (edit anytime).');
  return `${lines.join('\n')}\n`;
}

export function isDefaultUserProfile(contents: string): boolean {
  const trimmed = contents.trim();
  if (!trimmed) return true;
  return trimmed.includes(DEFAULT_USER_PLACEHOLDER);
}

/** Seed USER.md and workspace layout from CARINA_OPERATOR_* env after onboarding. */
export async function seedWorkspaceFromProfile(homeDir = resolveCarinaHome()): Promise<void> {
  const operatorName = process.env.CARINA_OPERATOR_NAME?.trim() ?? '';
  const operatorContext = process.env.CARINA_OPERATOR_CONTEXT?.trim() ?? '';

  const config = await ensureAgentsConfig(homeDir);
  const agent = config.agents.find((a) => a.default) ?? config.agents[0];
  if (!agent) return;

  const workspace = resolveAgentWorkspace(agent);
  const userPath = path.join(workspace, 'USER.md');

  if (operatorName || operatorContext) {
    let existing = '';
    try {
      existing = await fs.readFile(userPath, 'utf-8');
    } catch {
      existing = '';
    }

    if (isDefaultUserProfile(existing)) {
      await fs.writeFile(
        userPath,
        buildUserProfileMarkdown(operatorName, operatorContext),
        'utf-8',
      );
    }
  }
}
