import { listSkills } from '../../skills/store.js';

export class SkillsPanel {
  async getLines(width: number, height: number): Promise<string[]> {
    const lines: string[] = [];

    try {
      const skills = await listSkills();
      lines.push(`\x1b[90mInstalled Skills (${skills.length}):\x1b[0m`);
      lines.push('');

      if (skills.length === 0) {
        lines.push('\x1b[90m(no skills saved)\x1b[0m');
        return lines.slice(0, height);
      }

      for (const skill of skills) {
        const status = '\x1b[32m[ON]\x1b[0m';
        const name = skill.name.slice(0, Math.max(8, width - 12));
        lines.push(`${status} \x1b[37m${name}\x1b[0m`);
        const desc = skill.description?.slice(0, Math.max(8, width - 6)) ?? '';
        if (desc) {
          lines.push(`     \x1b[90m${desc}\x1b[0m`);
        }
        if (skill.usageCount > 0) {
          lines.push(`     \x1b[90mused ${skill.usageCount}x\x1b[0m`);
        }
        lines.push('');
        if (lines.length >= height) break;
      }
    } catch {
      lines.push('\x1b[31mSkills store unavailable\x1b[0m');
    }

    return lines.slice(0, height);
  }
}
