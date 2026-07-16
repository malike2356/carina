import { config } from '../config/index.js';
import { loadFromYaml } from './config/loader.js';
import { buildScoutSnapshot } from '../tui/panels/scout-panel.js';
import { scoutIntegrationRequested } from '../security/load-scout-package.js';

export type ScoutAccessTier = 'basic' | 'full' | 'local';

export type ScoutAccess = {
  tier: ScoutAccessTier;
  provisioned: boolean;
  reachable: boolean;
  trustScore: number;
  activeThreats: number;
};

export class ScoutGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScoutGateError';
  }
}

export async function resolveScoutAccess(): Promise<ScoutAccess> {
  const cliConfig = await loadFromYaml();
  const snapshot = buildScoutSnapshot();
  const provisioned = cliConfig.scout.enabled
    || config.labyrinth.enabled
    || scoutIntegrationRequested();
  const reachable = provisioned || snapshot.trustScore > 0;
  const tier: ScoutAccessTier = config.labyrinth.enabled ? 'full' : provisioned ? 'basic' : 'local';

  return {
    tier,
    provisioned,
    reachable,
    trustScore: snapshot.trustScore,
    activeThreats: snapshot.killSwitchActive ? 1 : 0,
  };
}

export async function requireScoutAccess(command: string): Promise<ScoutAccess> {
  const access = await resolveScoutAccess();
  if (!access.provisioned && !access.reachable) {
    throw new ScoutGateError(
      `Scout is not provisioned for this workspace (${command}).\n`
      + '  Enable Scout in config: carina config set scout.enabled true\n'
      + '  Or upgrade at: https://carinaai.uk/billing',
    );
  }
  return access;
}
