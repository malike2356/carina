import { buildSecurityDashboardData, formatDashboardTui } from '../../security/dashboard/index.js';
import { padLine, truncate } from '../terminal.js';

export class SecurityDashboardPanel {
  private cachedLines: string[] = [];
  private cachedAt = 0;

  async getLines(width: number, height: number): Promise<string[]> {
    const now = Date.now();
    if (now - this.cachedAt > 3000 || this.cachedLines.length === 0) {
      const data = await buildSecurityDashboardData();
      this.cachedLines = formatDashboardTui(data, width).split('\n');
      this.cachedAt = now;
    }

    const innerH = Math.max(1, height);
    return this.cachedLines.slice(0, innerH).map((line) => padLine(truncate(line, width), width));
  }
}
