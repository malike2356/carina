export type InstalledPackRow = {
  pack_name: string;
  version: string;
  installed_at: string;
  status: string;
  updated_at?: string;
  updated_by?: string;
};

export function installedRowsFromActivePacks(
  bundled: Array<{ name: string; version: string }>,
  activePacks: string[],
): InstalledPackRow[] {
  const byName = new Map(bundled.map((p) => [p.name, p]));
  return activePacks.map((name) => ({
    pack_name: name,
    version: byName.get(name)?.version ?? '1.0.0',
    installed_at: new Date().toISOString(),
    status: 'installed',
  }));
}

export function guiInstalledPayload(installed: InstalledPackRow[]): {
  installed: InstalledPackRow[];
  management: 'gui';
  operatorHint: string;
} {
  return {
    installed,
    management: 'gui',
    operatorHint:
      'Enable or disable packs here, or use the ops.carinaai.uk Skill Packs page. Changes apply immediately without editing .env or restarting.',
  };
}
