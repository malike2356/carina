import { NextResponse } from 'next/server';
import { getCloudCapabilities, CLOUD_SKILLS } from '@/lib/cloud-capabilities';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const caps = getCloudCapabilities();
  const tools = [
    {
      id: 'chat',
      kind: 'tool' as const,
      name: 'Chat',
      description: caps.chatMode === 'core-proxy' ? 'Core-proxy chat with tools.' : 'BYOK direct chat.',
      status: 'ready' as const,
      href: '/chat',
      cta: 'Open chat',
    },
    {
      id: 'web-search',
      kind: 'tool' as const,
      name: 'Web search',
      description: 'Search the web from agent runs.',
      status: caps.webSearch ? ('ready' as const) : ('needs_setup' as const),
      href: caps.webSearch ? '/chat' : '/settings',
      cta: caps.webSearch ? 'Try in chat' : 'Enable core proxy',
    },
    {
      id: 'terminal',
      kind: 'tool' as const,
      name: 'Terminal',
      description: 'Browser PTY against the ops bridge.',
      status: caps.terminal ? ('ready' as const) : ('needs_setup' as const),
      href: caps.terminal ? '/terminal' : '/settings',
      cta: caps.terminal ? 'Open terminal' : 'Configure ops bridge',
    },
    {
      id: 'agent-tools',
      kind: 'tool' as const,
      name: 'Agent tools',
      description: 'Tool loops for files, browsers, and automations.',
      status: caps.agentTools ? ('ready' as const) : ('gated' as const),
      href: caps.agentTools ? '/chat' : '/settings/keys',
      cta: caps.agentTools ? 'Try in chat' : 'Connect keys / core',
    },
  ];

  const skills = CLOUD_SKILLS.map((skill) => ({
    id: skill.id,
    kind: 'skill' as const,
    name: skill.name,
    description: skill.description,
    status: 'ready' as const,
    href: '/knowledge',
    cta: 'Open knowledge',
  }));

  const channels = [
    {
      id: 'channels',
      kind: 'channel' as const,
      name: 'Channels',
      description: 'Messaging and productivity connections.',
      status: 'ready' as const,
      href: '/settings/channels',
      cta: 'Connect',
    },
  ];

  const mcp = [
    {
      id: 'mcp',
      kind: 'mcp' as const,
      name: 'MCP servers',
      description: 'Model Context Protocol connections.',
      status: caps.mcp ? ('ready' as const) : ('needs_setup' as const),
      href: '/mcp',
      cta: caps.mcp ? 'Open MCP' : 'Enable core proxy',
    },
  ];

  const packs = [
    {
      id: 'packs',
      kind: 'skill' as const,
      name: 'Skill packs',
      description: 'Install domain packs for workers and chat.',
      status: 'ready' as const,
      href: '/packs',
      cta: 'Browse packs',
    },
  ];

  const items = [...tools, ...skills, ...packs, ...channels, ...mcp];
  const needsSetup = items.filter((item) => item.status === 'needs_setup' || item.status === 'gated');

  return NextResponse.json({
    summary: {
      total: items.length,
      ready: items.filter((item) => item.status === 'ready').length,
      needsSetup: needsSetup.length,
    },
    items,
    missing: needsSetup,
  });
}
