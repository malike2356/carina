import { describe, it, expect, vi, beforeEach } from 'vitest';
import './index.js';
import {
  auditToolInventory,
  findUnregisteredTools,
  LEAK_PRONE_TOOL_NAMES,
} from './tool-inventory.js';
import { registry } from './registry.js';
import { resolveActiveToolNames } from './toolset-config.js';
import { fileWriteTool } from './file.js';
import { emailSendTool } from './email.js';
import { webhookTool } from './webhook.js';
import { httpTool } from './http.js';
import { codeExecTool } from './code.js';
import { shellExecTool } from './shell.js';
import { mcpTool } from './mcp.js';
import { sendMessageTool } from './send-message.js';

describe('tool risk registry completeness', () => {
  it('classifies every registered tool in TOOL_RISK_REGISTRY', () => {
    const missing = findUnregisteredTools();
    expect(missing, `add to tool-risk-registry.ts: ${missing.join(', ')}`).toEqual([]);
  });

  it('marks leak-prone tools with dangerous flag', () => {
    const report = auditToolInventory();
    for (const name of LEAK_PRONE_TOOL_NAMES) {
      expect(report.missingDangerousFlag, name).not.toContain(name);
    }
    expect(report.unclassified).toEqual([]);
  });
});

describe('default least-privilege install', () => {
  it('excludes execute and messaging tools without toolsets.yaml', () => {
    const tools = new Set(resolveActiveToolNames({ platform: 'default' }));
    expect(tools.has('shell-exec')).toBe(false);
    expect(tools.has('email-send')).toBe(false);
    expect(tools.has('send-message')).toBe(false);
    expect(tools.has('webhook')).toBe(false);
    expect(tools.has('file-read')).toBe(true);
    expect(tools.has('web-search')).toBe(true);
  });
});

describe('file-write security', () => {
  it('is marked dangerous and blocks /etc writes', async () => {
    expect(fileWriteTool.dangerous).toBe(true);
    const result = await fileWriteTool.execute({ path: '/etc/passwd', content: 'x' });
    expect(String(result)).toContain('Error');
  });
});

describe('email-send security', () => {
  it('is marked dangerous and requires confirmation', () => {
    expect(emailSendTool.dangerous).toBe(true);
    expect(emailSendTool.requiresConfirmation).toBe(true);
  });
});

describe('webhook security', () => {
  it('is marked dangerous and rejects non-HTTPS subscribe URLs', async () => {
    expect(webhookTool.dangerous).toBe(true);
    const result = await webhookTool.execute({
      action: 'subscribe',
      url: 'http://evil.example/hook',
      events: ['process.complete'],
    }) as Record<string, unknown>;
    expect(result.error).toContain('HTTPS');
  });
});

describe('http-request security', () => {
  it('is marked dangerous', () => {
    expect(httpTool.dangerous).toBe(true);
  });
});

describe('code-exec security', () => {
  it('is marked dangerous', () => {
    expect(codeExecTool.dangerous).toBe(true);
  });
});

describe('shell-exec security', () => {
  it('is marked dangerous', () => {
    expect(shellExecTool.dangerous).toBe(true);
  });
});

describe('mcp security', () => {
  it('is marked dangerous', () => {
    expect(mcpTool.dangerous).toBe(true);
  });
});

describe('send-message security', () => {
  it('is marked dangerous', () => {
    expect(sendMessageTool.dangerous).toBe(true);
  });
});

describe('registry leak-prone coverage', () => {
  it('registers every leak-prone tool name', () => {
    for (const name of LEAK_PRONE_TOOL_NAMES) {
      expect(registry.get(name), name).toBeDefined();
    }
  });
});
