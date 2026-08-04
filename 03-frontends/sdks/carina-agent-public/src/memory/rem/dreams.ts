import fs from 'fs/promises';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';
import type { PromotionQueueRow } from './rem-promotion.js';

export function dreamsFilePath(homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'DREAMS.md');
}

export function renderDreamsMarkdown(
  pending: PromotionQueueRow[],
  generatedAt = new Date(),
): string {
  const lines: string[] = [
    '# DREAMS.md',
    '',
    'Reflective Episodic Memory (REM) review queue. Pending facts Carina wants to promote',
    'from short-term episodes into long-term memory. Approve or reject with:',
    '',
    '```bash',
    'carina memory promote approve <id>',
    'carina memory promote reject <id>',
    '```',
    '',
    `Generated: ${generatedAt.toISOString()}`,
    `Pending: ${pending.length}`,
    '',
  ];

  if (pending.length === 0) {
    lines.push('_No pending promotions. Run `carina memory promote run` to scan short-term memory._');
    lines.push('');
    return lines.join('\n');
  }

  for (const row of pending) {
    lines.push(`## ${row.id.slice(0, 8)} (score ${row.score})`);
    lines.push('');
    lines.push(`- Target: \`${row.proposedTarget}\``);
    lines.push(`- Episode: \`${row.episodeId.slice(0, 8)}\``);
    if (row.rationale) lines.push(`- Rationale: ${row.rationale}`);
    lines.push('');
    lines.push('```');
    lines.push(row.proposedContent);
    lines.push('```');
    lines.push('');
    lines.push(`Approve: \`carina memory promote approve ${row.id}\``);
    lines.push('');
  }

  return lines.join('\n');
}

export async function syncDreamsFile(
  pending: PromotionQueueRow[],
  homeDir = CARINA_HOME,
): Promise<string> {
  const filePath = dreamsFilePath(homeDir);
  const markdown = renderDreamsMarkdown(pending);
  await fs.mkdir(homeDir, { recursive: true });
  await fs.writeFile(filePath, markdown, 'utf-8');
  return filePath;
}
