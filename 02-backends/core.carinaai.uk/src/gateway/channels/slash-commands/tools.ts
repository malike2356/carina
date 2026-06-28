import type { SlashCommand } from './registry.js';
import fs from 'node:fs/promises';
import { describePlatformToolsets } from '../../../tools/toolset-config.js';

const CATALOGUE_TOOL_COUNT = 233;
const CAPABILITY_LAYER_COUNT = 21;
const PLATFORM_KNOWLEDGE_URL = new URL('../../../platform/platform-knowledge.md', import.meta.url);

async function readCatalogueCounts(): Promise<{ tools: number; layers: number }> {
  try {
    const text = await fs.readFile(PLATFORM_KNOWLEDGE_URL, 'utf8');
    const match = text.match(/(\d+)\s+tools\s+across\s+(\d+)\s+capability\s+layers/i);
    if (match?.[1] && match[2]) {
      return { tools: Number(match[1]), layers: Number(match[2]) };
    }
  } catch {
    // Fall back to the canonical catalogue constants if the knowledge file is not available in this build.
  }
  return { tools: CATALOGUE_TOOL_COUNT, layers: CAPABILITY_LAYER_COUNT };
}

export const toolsCommand: SlashCommand = {
  name: 'tools',
  description: 'List active tools and link to the full catalogue',
  handler: async (_msg) => {
    const active = describePlatformToolsets('telegram');
    const catalogue = await readCatalogueCounts();
    const toolsets = active.enabledToolsets.length > 0 ? active.enabledToolsets.join(', ') : 'none';
    const lines = [
      'Carina tools:',
      `Active: ${active.toolCount} tools`,
      `Active toolsets: ${toolsets}`,
      `Full catalogue: ${catalogue.tools} tools across ${catalogue.layers} capability layers`,
      'Catalogue: https://docs.carinaai.uk/tools',
      'Enable more: /packs or "carina tools enable <toolset>"',
    ];
    return lines.join('\n');
  },
};
