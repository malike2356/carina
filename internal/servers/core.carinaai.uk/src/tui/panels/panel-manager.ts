import { ScoutPanel } from './scout-panel.js';
import { MemoryPanel } from './memory-panel.js';
import { SkillsPanel } from './skills-panel.js';
import { LogPanel } from './log-panel.js';
import { SecurityDashboardPanel } from './security-dashboard-panel.js';
import { padLine, truncate } from '../terminal.js';

export type SidePanelType = 'scout' | 'memory' | 'skills' | 'logs' | 'security' | 'none';

const PANEL_TITLES: Record<Exclude<SidePanelType, 'none'>, string> = {
  scout: 'SCOUT SECURITY',
  memory: 'MEMORY',
  skills: 'SKILLS',
  logs: 'LOG TAIL',
  security: 'SECURITY DASHBOARD',
};

export class PanelManager {
  private activePanelType: SidePanelType = 'none';
  private readonly scoutPanel = new ScoutPanel();
  private readonly memoryPanel = new MemoryPanel();
  private readonly skillsPanel = new SkillsPanel();
  private readonly logPanel = new LogPanel();
  private readonly securityPanel = new SecurityDashboardPanel();

  constructor() {
    this.logPanel.startTailing();
  }

  getActivePanel(): SidePanelType {
    return this.activePanelType;
  }

  setPanel(type: SidePanelType): void {
    this.activePanelType = type;
  }

  togglePanel(type: Exclude<SidePanelType, 'none'>): void {
    this.activePanelType = this.activePanelType === type ? 'none' : type;
  }

  closePanel(): void {
    this.activePanelType = 'none';
  }

  dispose(): void {
    this.logPanel.stopTailing();
  }

  async getPanelLines(width: number, height: number): Promise<string[]> {
    if (this.activePanelType === 'none' || width < 8 || height < 3) {
      return [];
    }

    const innerH = Math.max(1, height - 2);
    const innerW = Math.max(8, width - 2);
    let body: string[] = [];

    switch (this.activePanelType) {
      case 'scout':
        body = await this.scoutPanel.getLines(innerW, innerH);
        break;
      case 'memory':
        body = await this.memoryPanel.getLines(innerW, innerH);
        break;
      case 'skills':
        body = await this.skillsPanel.getLines(innerW, innerH);
        break;
      case 'logs':
        body = this.logPanel.getLines(innerW, innerH);
        break;
      case 'security':
        body = await this.securityPanel.getLines(innerW, innerH);
        break;
      default:
        body = [];
    }

    const title = PANEL_TITLES[this.activePanelType];
    const divider = '─'.repeat(Math.max(0, innerW));

    return [
      padLine(truncate(`[${title}]`, innerW), innerW),
      padLine(divider, innerW),
      ...body.slice(0, innerH).map((line) => padLine(truncate(line, innerW), innerW)),
    ];
  }
}

export function sidePanelFromFKey(name: string | undefined): Exclude<SidePanelType, 'none'> | 'close' | null {
  switch (name) {
    case 'f1': return 'scout';
    case 'f2': return 'memory';
    case 'f3': return 'skills';
    case 'f4': return 'logs';
    case 'f5': return 'close';
    case 'f6': return 'security';
    default: return null;
  }
}
