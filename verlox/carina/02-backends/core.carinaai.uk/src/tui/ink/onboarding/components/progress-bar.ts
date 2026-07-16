import { ONBOARDING_STEP_COUNT } from '../copy.js';

export function renderProgressBar(current: number, total = ONBOARDING_STEP_COUNT): string {
  const slots = 10;
  const filled = Math.max(0, Math.min(slots, Math.round((current / total) * slots)));
  return `${'█'.repeat(filled)}${'░'.repeat(slots - filled)}`;
}
