import { parseMcpServerOptions } from '../../mcp/server/config.js';
import { startMcpServer } from '../../mcp/server/start.js';
import { bindMcpProfile } from '../../mcp/server/profile-bind.js';
import { listMcpTools } from '../../mcp/server/tool-catalog.js';

export async function runMcpCommand(args: string[]): Promise<void> {
  const sub = (args[0] ?? 'help').toLowerCase();

  if (sub === 'server' || sub === 'serve') {
    const rest = args.slice(1);
    const options = parseMcpServerOptions(rest);
    await startMcpServer(options);
    return;
  }

  if (sub === 'status') {
    const profile = bindMcpProfile();
    const { registerSessionTools } = await import('../../tools/index.js');
    registerSessionTools('mcp-status');
    const allowDangerous = process.env.CARINA_MCP_ALLOW_DANGEROUS === 'true';
    const tools = listMcpTools(allowDangerous);
    console.log(`MCP server mode: opt-in (run: carina mcp server)`);
    console.log(`Active profile: ${profile.profileName}`);
    console.log(`Toolsets file: ${profile.toolsetsPath}`);
    console.log(`Exposed tools (${tools.length}): ${tools.map((t) => t.name).join(', ')}`);
    return;
  }

  console.log(`Usage:
  carina mcp server [--stdio] [--http] [--profile NAME] [--allow-dangerous] [--port N] [--host HOST]
  carina mcp status

MCP server mode exposes Carina tools to external MCP clients (stdio or HTTP).
Disabled by default; does not affect normal chat/runtime until explicitly started.
HTTP transport requires CARINA_MCP_SERVER_TOKEN (or CARINA_OPS_TOKEN).`);
}
