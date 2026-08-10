/**
 * Carina / Aiva default feature registry (live product endpoints).
 */
import { clearFeatureRegistry, registerFeature } from './index.js';

let seeded = false;

export function seedCarinaFeatureRegistry(force = false): void {
  if (seeded && !force) return;
  if (force) clearFeatureRegistry();

  registerFeature('billing', ['/api/billing/health', '/api/health'], 'billing', {
    criticalPath: true,
    revenueImpact: 10,
  });
  registerFeature('auth', ['/api/health'], 'platform', {
    criticalPath: true,
    revenueImpact: 8,
  });
  registerFeature('outreach', ['/api/aiva/outreach/health', '/api/health'], 'growth', {
    revenueImpact: 6,
  });
  registerFeature('concierge', ['/api/health'], 'growth', { revenueImpact: 5 });
  registerFeature('approvals', ['/api/health'], 'growth', { revenueImpact: 4 });
  registerFeature('analytics', ['/api/health'], 'platform', { revenueImpact: 2 });
  registerFeature('cohort_retention', ['/api/health'], 'platform');
  registerFeature('calendar', ['/api/health'], 'platform');
  registerFeature('email', ['/api/health'], 'platform', { revenueImpact: 3 });
  registerFeature('workers', ['/api/health'], 'platform');
  registerFeature('settings', ['/api/health'], 'platform');
  registerFeature('tools', ['/api/health'], 'platform');
  registerFeature('pipeline', ['/api/health'], 'growth');
  registerFeature('qualification', ['/api/health'], 'growth');

  seeded = true;
}
