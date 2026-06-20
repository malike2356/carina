import {
  fetchHubPacks,
  hubBaseUrl,
  hubUnreachableHint,
} from '../../../skills/hub/hub-client.js';
import { formatPackSearchTable, readFlag, positionalArg } from './shared.js';

export async function runPackSearch(args: string[]): Promise<void> {
  const query = positionalArg(args) ?? '';
  const json = readFlag(args, '--json');
  const baseUrl = process.env.HUB_URL ?? process.env.SKILLS_HUB_URL;

  try {
    const packs = await fetchHubPacks({ q: query, baseUrl });
    if (json) {
      console.log(JSON.stringify({ query, hub: hubBaseUrl(baseUrl), packs }, null, 2));
      return;
    }
    if (!query) {
      console.log(`Skill packs on ${hubBaseUrl(baseUrl)} (${packs.length}):\n`);
    }
    console.log(formatPackSearchTable(packs));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    console.error(hubUnreachableHint(baseUrl));
    process.exit(1);
  }
}
