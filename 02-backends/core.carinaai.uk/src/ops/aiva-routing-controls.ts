export type AivaRoutingControls = {
  pinnedProvider?: string;
  disabledProviders: string[];
  readOnly: boolean;
  mutationsPaused: boolean;
  killSwitch: boolean;
  updatedAt: string;
};

let controls: AivaRoutingControls = { disabledProviders: [], readOnly: false, mutationsPaused: false, killSwitch: false, updatedAt: new Date(0).toISOString() };

export function getAivaRoutingControls(): AivaRoutingControls { return { ...controls, disabledProviders: [...controls.disabledProviders] }; }

export function updateAivaRoutingControls(patch: Partial<Omit<AivaRoutingControls, 'updatedAt'>>): AivaRoutingControls {
  controls = { ...controls, ...patch, disabledProviders: patch.disabledProviders ? [...new Set(patch.disabledProviders)] : controls.disabledProviders, updatedAt: new Date().toISOString() };
  return getAivaRoutingControls();
}

export function resetAivaRoutingControlsForTests(): void { controls = { disabledProviders: [], readOnly: false, mutationsPaused: false, killSwitch: false, updatedAt: new Date(0).toISOString() }; }
