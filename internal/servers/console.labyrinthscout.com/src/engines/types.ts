import type { FindingSeverity } from '../findings/types.js';

export interface EngineFinding {
  tool: string;
  findingType: string;
  severity: FindingSeverity;
  title: string;
  description?: string;
  remediation?: string;
  cvssScore?: number;
  rawData?: Record<string, unknown>;
}

export interface QuickScanMeta {
  openPorts: number[];
  subdomains: string[];
  techStack: string[];
  durationMs: number;
  enginesUsed: string[];
}

export interface QuickScanResult {
  findings: EngineFinding[];
  meta: QuickScanMeta;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
