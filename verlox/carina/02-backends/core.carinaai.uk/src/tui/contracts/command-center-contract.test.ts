import { describe, expect, it } from 'vitest';
import {
  COMMAND_CENTER_CONTRACT_AREAS,
  getCommandCenterContractSummary,
  renderCommandCenterContractTable,
} from './command-center-contract.js';

describe('Carina TUI Command Center contract', () => {
  it('tracks all planned Command Center areas', () => {
    expect(COMMAND_CENTER_CONTRACT_AREAS).toHaveLength(11);
    expect(COMMAND_CENTER_CONTRACT_AREAS.map((area) => area.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('maps every area to files and a build prompt', () => {
    for (const area of COMMAND_CENTER_CONTRACT_AREAS) {
      expect(area.title).toBeTruthy();
      expect(area.files.length).toBeGreaterThan(0);
      expect(area.plannedPrompt).toMatch(/^carina-tui-command-center--/);
    }
  });

  it('keeps the initial audit non-blocking while later prompts land', () => {
    const summary = getCommandCenterContractSummary();
    expect(summary.total).toBe(11);
    expect(summary.partial + summary.missing + summary.present).toBe(11);
    expect(summary.percentReady).toBeGreaterThanOrEqual(0);
    expect(summary.percentReady).toBeLessThanOrEqual(100);
  });

  it('renders a progress table with Carina-native language', () => {
    const report = renderCommandCenterContractTable();
    expect(report).toContain('Carina TUI Command Center contract');
    expect(report).toContain('Ready:');
    expect(report.toLowerCase()).not.toContain('keprix');
    expect(report.toLowerCase()).not.toContain('hermes');
  });
});
