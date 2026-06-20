import { listRecentMemories } from '../../memory/store.js';

function formatAge(createdAt: Date): string {
  const ms = Date.now() - createdAt.getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

export class MemoryPanel {
  async getLines(width: number, height: number): Promise<string[]> {
    const lines: string[] = [];
    lines.push('\x1b[90mRecent Memories:\x1b[0m');
    lines.push('');

    try {
      const memories = await listRecentMemories(20);
      if (memories.length === 0) {
        lines.push('\x1b[90m(no memories yet)\x1b[0m');
        return lines.slice(0, height);
      }

      for (const mem of memories) {
        const age = formatAge(mem.createdAt);
        const role = mem.role ? `${mem.role} ` : '';
        const content = `${role}${mem.content}`.replace(/\s+/g, ' ').slice(0, Math.max(8, width - 10));
        lines.push(`\x1b[36m${age}\x1b[0m ${content}`);
        lines.push('');
        if (lines.length >= height) break;
      }
    } catch {
      lines.push('\x1b[31mMemory unavailable\x1b[0m');
    }

    return lines.slice(0, height);
  }
}
