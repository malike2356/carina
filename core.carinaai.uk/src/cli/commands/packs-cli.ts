import fs from 'fs';
import { CARINA_PACKS_DIR } from '../../config/paths.js';

function hasBypassEval(args: string[]): boolean {
  return args.includes('--bypass-eval') || process.env.CARINA_EVAL_GATE === 'bypass';
}

function listInstalledPackNames(): string[] {
  if (!fs.existsSync(CARINA_PACKS_DIR)) return [];
  return fs.readdirSync(CARINA_PACKS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

export async function runPacksCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const name = args[1];

  if (action === 'list') {
    const installed = listInstalledPackNames();
    const { getOperatorActivePacks } = await import('../../skills/operator-pack-store.js');
    const active = new Set(getOperatorActivePacks());
    if (installed.length === 0) {
      console.log('No skill packs installed.');
      return;
    }
    console.log('Installed packs:');
    for (const p of installed) {
      const mark = active.has(p) ? ' [active]' : '';
      console.log(`  - ${p}${mark}`);
    }
    return;
  }

  if (action === 'status') {
    const { initOperatorPackStore, getOperatorActivePacks, listOperatorInstalledPacks } =
      await import('../../skills/operator-pack-store.js');
    await initOperatorPackStore();
    const installed = listInstalledPackNames();
    const active = getOperatorActivePacks();
    const records = await listOperatorInstalledPacks();
    console.log(`Active packs (${active.length}): ${active.join(', ') || '(none)'}`);
    console.log(`Installed on disk (${installed.length}): ${installed.join(', ') || '(none)'}`);
    if (records.length > 0) {
      console.log('Registry:');
      for (const row of records) {
        console.log(`  ${row.pack_name}@${row.version}  ${row.status}`);
      }
    }
    return;
  }

  if (action === 'enable') {
    if (!name) {
      console.error('Usage: carina packs enable <pack-name>');
      process.exit(1);
    }
    const { initOperatorPackStore, getOperatorActivePacks, syncOperatorActivePacks } =
      await import('../../skills/operator-pack-store.js');
    await initOperatorPackStore();
    const current = getOperatorActivePacks();
    if (current.includes(name)) {
      console.log(`Pack already active: ${name}`);
      return;
    }
    const result = await syncOperatorActivePacks([...current, name], { source: 'packs-cli' });
    console.log(`Enabled pack: ${name} (active: ${result.active.join(', ')})`);
    return;
  }

  if (action === 'disable') {
    if (!name) {
      console.error('Usage: carina packs disable <pack-name>');
      process.exit(1);
    }
    const { initOperatorPackStore, getOperatorActivePacks, syncOperatorActivePacks } =
      await import('../../skills/operator-pack-store.js');
    await initOperatorPackStore();
    const current = getOperatorActivePacks();
    if (!current.includes(name)) {
      console.log(`Pack not active: ${name}`);
      return;
    }
    const result = await syncOperatorActivePacks(
      current.filter((p) => p !== name),
      { source: 'packs-cli' },
    );
    console.log(`Disabled pack: ${name} (active: ${result.active.join(', ') || '(none)'})`);
    return;
  }

  if (action === 'install') {
    if (!name) {
      console.error('Usage: carina packs install <pack-name> [--bypass-eval]');
      process.exit(1);
    }
    if (!hasBypassEval(args)) {
      const { runPackEvalGate, resolveGateMode } = await import('../../skills/eval/gate.js');
      const gate = await runPackEvalGate(name, { mode: resolveGateMode() });
      if (gate.message) console.log(gate.message);
      if (gate.blocked) {
        console.error('Install blocked by eval gate. Use --bypass-eval for emergency installs.');
        process.exit(1);
      }
    }
    const { installPack } = await import('../../setup/install-pack.js');
    await installPack(name);
    return;
  }

  if (action === 'remove') {
    if (!name) {
      console.error('Usage: carina packs remove <pack-name>');
      process.exit(1);
    }
    const { initOperatorPackStore, getOperatorActivePacks, syncOperatorActivePacks } =
      await import('../../skills/operator-pack-store.js');
    await initOperatorPackStore();
    const current = getOperatorActivePacks();
    if (current.includes(name)) {
      await syncOperatorActivePacks(
        current.filter((p) => p !== name),
        { source: 'packs-cli' },
      );
    }
    const target = `${CARINA_PACKS_DIR}/${name}`;
    if (!fs.existsSync(target)) {
      console.error(`Pack not found: ${name}`);
      process.exit(1);
    }
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`Removed pack: ${name}`);
    return;
  }

  console.error('Usage: carina packs <list|status|enable|disable|install|remove> [name]');
  process.exit(1);
}
