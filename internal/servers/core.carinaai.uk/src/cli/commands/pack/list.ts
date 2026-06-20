import fs from 'fs';
import { CARINA_PACKS_DIR } from '../../../config/paths.js';
import { readFlag } from './shared.js';

export async function runPackList(args: string[]): Promise<void> {
  const json = readFlag(args, '--json');
  const { initOperatorPackStore, getOperatorActivePacks, listOperatorInstalledPacks } =
    await import('../../../skills/operator-pack-store.js');
  await initOperatorPackStore({ fileOnly: true });

  const onDisk = fs.existsSync(CARINA_PACKS_DIR)
    ? fs.readdirSync(CARINA_PACKS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
    : [];
  const records = await listOperatorInstalledPacks();
  const active = new Set(getOperatorActivePacks());

  const rows = onDisk.map((name) => {
    const record = records.find((r) => r.pack_name === name);
    return {
      name,
      version: record?.version ?? readPackVersion(name),
      active: active.has(name),
      status: record?.status ?? 'installed',
    };
  });

  if (json) {
    console.log(JSON.stringify({ packs: rows, installDir: CARINA_PACKS_DIR }, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log('No packs installed.');
    console.log(`Install dir: ${CARINA_PACKS_DIR}`);
    return;
  }

  console.log(`Installed packs (${CARINA_PACKS_DIR}):\n`);
  for (const row of rows) {
    const flags = [row.active ? 'active' : 'inactive', row.version].filter(Boolean).join(', ');
    console.log(`  ${row.name}  (${flags})`);
  }
}

function readPackVersion(name: string): string {
  try {
    const raw = fs.readFileSync(`${CARINA_PACKS_DIR}/${name}/pack.json`, 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
