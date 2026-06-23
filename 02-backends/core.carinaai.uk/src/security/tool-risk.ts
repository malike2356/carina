export type ToolRiskTier = 'low' | 'medium' | 'high' | 'critical';

const HIGH_RISK_TOOLS = new Set([
  'shell-exec',
  'code-exec',
  'file-write',
  'patch',
  'process',
  'webhook',
  'mcp',
  'send-message',
  'email-send',
  'computer-use',
  'checkpoint-manager',
  'skill-manage',
  'skill-curator',
  'mixture-of-agents',
  'image-generation',
  'video-generation',
]);

const MEDIUM_RISK_TOOLS = new Set([
  'http-request',
  'file-read',
  'search-files',
  'browser-navigate',
  'browser-click',
  'browser-type',
  'browser-screenshot',
  'lsp',
  'spotify-play',
]);

export function toolRiskTier(toolName: string, tool?: { dangerous?: boolean }): ToolRiskTier {
  if (HIGH_RISK_TOOLS.has(toolName) || tool?.dangerous) {
    if (toolName === 'shell-exec' || toolName === 'code-exec' || toolName === 'computer-use') {
      return 'critical';
    }
    return 'high';
  }
  if (MEDIUM_RISK_TOOLS.has(toolName)) return 'medium';
  return 'low';
}

export function tierMeets(min: ToolRiskTier, actual: ToolRiskTier): boolean {
  const order: ToolRiskTier[] = ['low', 'medium', 'high', 'critical'];
  return order.indexOf(actual) >= order.indexOf(min);
}
