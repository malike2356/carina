import fs from 'fs/promises';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';
import type { McpToolDefinition } from './types.js';

export interface McpToolPermission {
  toolName: string;
  serverName: string;
  allowed: boolean;
  scopes?: string[];
  requiresApproval: boolean;
  approvedAt: string;
  approvedBy: string;
}

interface PermissionFile {
  permissions: McpToolPermission[];
}

function permissionsPath(): string {
  return path.join(resolveCarinaHome(), 'mcp', 'permissions.json');
}

export class McpSecurityManager {
  private permissions = new Map<string, McpToolPermission>();

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(permissionsPath(), 'utf8');
      const parsed = JSON.parse(raw) as PermissionFile;
      this.permissions.clear();
      for (const perm of parsed.permissions ?? []) {
        this.permissions.set(`${perm.serverName}:${perm.toolName}`, perm);
      }
    } catch {
      this.permissions.clear();
    }
  }

  async save(): Promise<void> {
    const file = permissionsPath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const payload: PermissionFile = { permissions: [...this.permissions.values()] };
    await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
  }

  classifyTool(tool: McpToolDefinition): 'filesystem' | 'shell' | 'database' | 'network' | 'generic' {
    const text = `${tool.name} ${tool.description ?? ''}`.toLowerCase();
    if (/shell|exec|command|bash/.test(text)) return 'shell';
    if (/file|read|write|directory|path|fs/.test(text)) return 'filesystem';
    if (/sql|postgres|mysql|database|query|db/.test(text)) return 'database';
    if (/http|fetch|request|network|url|webhook/.test(text)) return 'network';
    return 'generic';
  }

  async requestPermission(
    tool: McpToolDefinition,
    serverName: string,
    approvedBy = 'operator',
  ): Promise<McpToolPermission> {
    const kind = this.classifyTool(tool);
    const permission: McpToolPermission = {
      toolName: tool.name,
      serverName,
      allowed: kind !== 'shell',
      scopes: kind === 'filesystem' ? [process.cwd()] : undefined,
      requiresApproval: kind === 'shell' || kind === 'database',
      approvedAt: new Date().toISOString(),
      approvedBy,
    };
    this.permissions.set(`${serverName}:${tool.name}`, permission);
    await this.save();
    return permission;
  }

  async checkPermission(
    serverName: string,
    toolName: string,
    _args: Record<string, unknown>,
  ): Promise<boolean> {
    await this.load();
    const perm = this.permissions.get(`${serverName}:${toolName}`);
    if (!perm) return false;
    return perm.allowed;
  }

  revokePermission(serverName: string, toolName: string): void {
    this.permissions.delete(`${serverName}:${toolName}`);
  }

  listPermissions(): McpToolPermission[] {
    return [...this.permissions.values()];
  }
}

let singleton: McpSecurityManager | null = null;

export function getMcpSecurityManager(): McpSecurityManager {
  if (!singleton) {
    singleton = new McpSecurityManager();
  }
  return singleton;
}

export function _resetMcpSecurityManagerForTests(): void {
  singleton = null;
}
