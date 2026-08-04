import { llm } from '../brain/llm.js';
import { resolveProviderFallbackChain } from '../brain/fallback-chain.js';
import { PROVIDER_DEFINITIONS } from '../brain/provider-registry.js';
import { operatorSessionEnabled } from '../surfaces/index.js';

export function formatGatewayStatusReply(input: {
  sessionId?: string;
  channel?: string;
  activeProvider: string;
  activeModel?: string;
}): string {
  const lines = [
    `Session: ${input.sessionId?.slice(0, 12) ?? 'unknown'}`,
    `Provider: ${input.activeProvider}${input.activeModel ? ` / ${input.activeModel}` : ''}`,
    `Continuity: ${operatorSessionEnabled()
      ? 'unified operator session (CLI, web, messengers share one thread)'
      : 'per-surface sessions (set CARINA_OPERATOR_SESSION=true to unify)'}`,
  ];
  if (input.channel) {
    lines.push(`Surface: ${input.channel}`);
  }

  try {
    const chain = resolveProviderFallbackChain({
      activeProvider: input.activeProvider,
      configuredNames: llm.list(),
      definitions: PROVIDER_DEFINITIONS,
    });
    if (chain.length > 1) {
      lines.push(`Fallback chain: ${chain.join(' -> ')}`);
    }
  } catch {
    // optional
  }

  lines.push('Switch: /model <provider>  |  New chat: /new  |  Stop: /stop');
  return lines.join('\n');
}

export function formatMessengerHelp(fullHelp: string, channel?: string): string {
  const plain = new Set(['telegram', 'sms', 'signal', 'irc']);
  if (!channel || !plain.has(channel)) {
    return fullHelp;
  }
  return [
    'Carina messenger commands',
    '/help - full command list',
    '/model [provider] - switch LLM (reversible)',
    '/provider - show configured providers',
    '/new - start a fresh conversation',
    '/stop - interrupt the current reply',
    '/status - session, provider, continuity mode',
    '/memories - list recent memory',
    '/usage --month - token usage summary',
  ].join('\n');
}
