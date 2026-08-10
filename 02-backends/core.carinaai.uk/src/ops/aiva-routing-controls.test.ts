import { afterEach, describe, expect, it } from 'vitest';
import { getAivaRoutingControls, resetAivaRoutingControlsForTests, updateAivaRoutingControls } from './aiva-routing-controls.js';

describe('Aiva routing controls', () => {
  afterEach(() => resetAivaRoutingControlsForTests());
  it('supports audited safe operator controls', () => {
    const result = updateAivaRoutingControls({ pinnedProvider: 'carina', readOnly: true, mutationsPaused: true, disabledProviders: ['keprix', 'keprix'] });
    expect(result.pinnedProvider).toBe('carina');
    expect(result.readOnly).toBe(true);
    expect(result.disabledProviders).toEqual(['keprix']);
    expect(getAivaRoutingControls().updatedAt).not.toBe(new Date(0).toISOString());
  });
});
