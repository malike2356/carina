import fs from 'node:fs';
import path from 'node:path';
import { CARINA_HOME } from '../../config/paths.js';
import { getLogLines } from '../log-buffer.js';

const MAX_LINES = 200;

function resolveLogPaths(): string[] {
  return [
    path.join(CARINA_HOME, 'data', 'logs', 'shell.log'),
    path.join(process.cwd(), 'data', 'logs', 'shell.log'),
    path.join(CARINA_HOME, 'data', 'logs', 'turns.jsonl'),
  ];
}

export class LogPanel {
  private fileLines: string[] = [];
  private watchPaths: string[] = [];

  startTailing(): void {
    this.watchPaths = resolveLogPaths();
    this.refreshFromDisk();
    for (const logPath of this.watchPaths) {
      try {
        fs.watchFile(logPath, { interval: 1000 }, () => this.refreshFromDisk());
      } catch {
        // file may not exist yet
      }
    }
  }

  stopTailing(): void {
    for (const logPath of this.watchPaths) {
      try {
        fs.unwatchFile(logPath);
      } catch {
        // ignore
      }
    }
  }

  private refreshFromDisk(): void {
    for (const logPath of this.watchPaths) {
      try {
        if (!fs.existsSync(logPath)) continue;
        const raw = fs.readFileSync(logPath, 'utf8');
        const lines = raw.trim().split('\n').filter(Boolean);
        if (lines.length > 0) {
          this.fileLines = lines.slice(-MAX_LINES);
          return;
        }
      } catch {
        // try next path
      }
    }
  }

  getLines(width: number, height: number): string[] {
    this.refreshFromDisk();
    const bufferLines = getLogLines();
    const combined = [...this.fileLines, ...bufferLines.map((l) => `[tui] ${l}`)];
    const tail = combined.slice(-MAX_LINES).slice(-(height));
    return tail.map((line) => line.slice(0, width));
  }
}
