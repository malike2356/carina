import { loadFromYaml, writeConfig } from './loader.js';
import type { AuxiliaryModelConfig, AuxiliaryTaskName } from '../../types/auxiliary-model.js';
import type { CarinaCliConfig } from './defaults.js';

export async function getAuxiliaryModels(): Promise<NonNullable<CarinaCliConfig['auxiliaryModels']>> {
  const config = await loadFromYaml();
  return config.auxiliaryModels ?? {};
}

export async function saveAuxiliaryConfig(
  task: AuxiliaryTaskName,
  patch: AuxiliaryModelConfig,
): Promise<void> {
  const config = await loadFromYaml();
  const current = config.auxiliaryModels ?? {};
  const existing = current[task] ?? {};
  config.auxiliaryModels = {
    ...current,
    [task]: {
      ...existing,
      ...patch,
      ...(patch.provider === undefined ? {} : { provider: patch.provider || undefined }),
      ...(patch.model === undefined ? {} : { model: patch.model || undefined }),
    },
  };
  await writeConfig(config);
}

export async function deleteAuxiliaryConfig(task: AuxiliaryTaskName): Promise<void> {
  const config = await loadFromYaml();
  if (!config.auxiliaryModels?.[task]) return;
  const next = { ...config.auxiliaryModels };
  delete next[task];
  config.auxiliaryModels = Object.keys(next).length > 0 ? next : undefined;
  await writeConfig(config);
}
