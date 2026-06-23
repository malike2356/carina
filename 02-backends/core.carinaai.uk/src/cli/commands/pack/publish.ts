import { publishPackToHub } from '../../../skills/hub/hub-client.js';
import { readFlag, positionalArg } from './shared.js';

export async function runPackPublish(args: string[]): Promise<void> {
  const packDir = positionalArg(args);
  if (!packDir) {
    console.error('Usage: carina pack publish <path> [--featured]');
    process.exit(1);
  }

  const featured = readFlag(args, '--featured');
  const baseUrl = process.env.HUB_URL ?? process.env.SKILLS_HUB_URL;

  try {
    const result = await publishPackToHub(packDir, { baseUrl, featured });
    const verifiedNote = result.pendingVerification
      ? ' (pending verification)'
      : ' (verified)';
    console.log(`Published ${result.name}@${result.version} to hub${verifiedNote}`);
    if (result.archivePath) {
      console.log(`  archive: ${result.archivePath}`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
