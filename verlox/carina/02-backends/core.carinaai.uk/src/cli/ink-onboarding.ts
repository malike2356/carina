import { loadCarinaEnv } from '../config/load-env.js';
import {
  isInteractiveTerminal,
  needsFirstRunOnboarding,
  writeMinimalBootstrap,
} from './first-run.js';
import { persistInkOnboardingState } from '../tui/ink/onboarding/persist.js';
import type { OnboardingState } from '../tui/ink/onboarding/types.js';

export async function runInkOnboarding(options: { force?: boolean } = {}): Promise<boolean> {
  if (!options.force) {
    const needs = await needsFirstRunOnboarding();
    if (!needs) return false;
  }

  if (!isInteractiveTerminal()) {
    if (options.force) {
      console.error('Ink onboarding requires an interactive terminal.');
      return false;
    }
    await writeMinimalBootstrap();
    return true;
  }

  const React = await import('react');
  const { render } = await import('ink');
  const { Onboarding } = await import('../tui/ink/onboarding/Onboarding.js');

  return new Promise<boolean>((resolve) => {
    const { unmount } = render(
      React.createElement(Onboarding, {
        onComplete: async (state: OnboardingState) => {
          await persistInkOnboardingState(state);
          loadCarinaEnv();
          unmount();
          resolve(true);
        },
      }),
      { exitOnCtrlC: false },
    );
  });
}
