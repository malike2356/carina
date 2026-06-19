import {
  formatSkinList,
  getActiveSkin,
  listSkinNames,
  setActiveSkin,
} from '../../tui/skins/skin-store.js';

export async function runSkinCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const name = args[1];

  if (action === 'list' || (action !== 'set' && !name && action !== 'reset')) {
    if (action !== 'list' && listSkinNames().includes(action)) {
      setActiveSkin(action);
      console.log(`Skin set to "${action}"`);
      return;
    }
    console.log(formatSkinList());
    console.log(`\nActive: ${getActiveSkin().label}`);
    return;
  }

  if (action === 'set') {
    if (!name) {
      console.error('Usage: carina skin set <name>');
      process.exit(1);
    }
    if (name === 'reset') {
      setActiveSkin('default');
      console.log('Skin reset to default');
      return;
    }
    try {
      setActiveSkin(name);
      console.log(`Skin set to "${name}" (${getActiveSkin().label})`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    return;
  }

  if (action === 'reset') {
    setActiveSkin('default');
    console.log('Skin reset to default');
    return;
  }

  try {
    setActiveSkin(action);
    console.log(`Skin set to "${action}" (${getActiveSkin().label})`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
