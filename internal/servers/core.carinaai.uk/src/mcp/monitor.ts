export async function logMcpToolInvocation(input: {
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
  ok: boolean;
  error?: string;
}): Promise<void> {
  const entry = {
    at: new Date().toISOString(),
    category: 'tool_policy' as const,
    action: input.ok ? 'mcp_tool_call' : 'mcp_tool_call_failed',
    detail: `${input.serverName}/${input.toolName} ${input.ok ? 'ok' : input.error ?? 'failed'}`,
    metadata: {
      serverName: input.serverName,
      toolName: input.toolName,
      argKeys: Object.keys(input.args),
    },
  };

  try {
    const { appendSecurityAudit } = await import('../security/security-audit.js');
    appendSecurityAudit(entry);
  } catch {
    if (process.env.CARINA_DEBUG === 'true') {
      console.log('[mcp-monitor]', JSON.stringify(entry));
    }
  }

  if (process.env.LABYRINTH_ENABLED === 'true') {
    try {
      const { reportToolCall } = await import('../security/scout-client.js');
      await reportToolCall({
        toolName: `${input.serverName}/${input.toolName}`,
        params: input.args,
        resultSummary: input.ok ? 'ok' : (input.error ?? 'failed'),
        durationMs: 0,
        sessionId: 'mcp',
        success: input.ok,
        errorMessage: input.error,
      });
    } catch {
      // Scout optional
    }
  }
}
