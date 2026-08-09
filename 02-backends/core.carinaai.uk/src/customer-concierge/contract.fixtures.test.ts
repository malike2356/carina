import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertMandatoryTenantAndActor,
  domainWrapperSchema,
  eventEnvelopeSchema,
  parseReadinessReport,
  providerCommandSchema,
  providerResultSchema,
  readinessReportSchema,
  stateTransitionSchema,
} from './schema.js';
import { conciergeFeatureFlags } from './readiness.js';
import { CUSTOMER_CONCIERGE_CONTRACT_VERSION } from './types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const contractRoot = path.resolve(here, '../../contracts/customer-concierge-v1');
const fixtureDir = path.join(contractRoot, 'fixtures/synthetic');

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixtureDir, name), 'utf8'));
}

describe('Customer Concierge v1 contract', () => {
  it('manifest declares version 1.0.0 and no runtime dependency', () => {
    const manifest = JSON.parse(
      readFileSync(path.join(contractRoot, 'contract.json'), 'utf8'),
    ) as { version: string; runtimeDependency: string };
    expect(manifest.version).toBe(CUSTOMER_CONCIERGE_CONTRACT_VERSION);
    expect(manifest.runtimeDependency).toBe('none');
  });

  it('validates all synthetic fixtures', () => {
    const files = readdirSync(fixtureDir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(8);

    for (const file of files) {
      const data = loadJson(file);
      if (file.startsWith('event-')) {
        const parsed = eventEnvelopeSchema.parse(data);
        assertMandatoryTenantAndActor(parsed);
      } else if (file.startsWith('domain-')) {
        const parsed = domainWrapperSchema.parse(data);
        assertMandatoryTenantAndActor(parsed.object);
      } else if (file.startsWith('transition-')) {
        const parsed = stateTransitionSchema.parse(data);
        assertMandatoryTenantAndActor(parsed);
      } else if (file.startsWith('provider-command-')) {
        const parsed = providerCommandSchema.parse(data);
        assertMandatoryTenantAndActor(parsed);
      } else if (file.startsWith('provider-result-')) {
        const parsed = providerResultSchema.parse(data);
        assertMandatoryTenantAndActor(parsed);
        if (file.includes('not-configured')) {
          expect(parsed.status).toBe('not_configured');
          expect(parsed.ok).toBe(false);
        }
      } else if (file.startsWith('readiness-')) {
        const parsed = readinessReportSchema.parse(data);
        expect(parsed.workspaceId).toBeTruthy();
        if (file.includes('not-configured')) {
          expect(parsed.ready).toBe(false);
          for (const feature of Object.values(parsed.features)) {
            expect(feature.status).toBe('not_configured');
          }
        }
      } else {
        throw new Error(`Unhandled fixture naming: ${file}`);
      }
    }
  });

  it('rejects fixtures missing workspaceId', () => {
    const bad = loadJson('event-conversation-started.json') as Record<string, unknown>;
    delete bad.workspaceId;
    expect(() => eventEnvelopeSchema.parse(bad)).toThrow();
  });

  it('rejects fixtures missing actorType', () => {
    const bad = loadJson('domain-booking-held.json') as {
      objectType: string;
      object: Record<string, unknown>;
    };
    delete bad.object.actorType;
    expect(() => domainWrapperSchema.parse(bad)).toThrow();
  });

  it('feature flags default on and can disable', () => {
    const flags = conciergeFeatureFlags();
    expect(flags.publicConcierge).toBe(true);
    const prev = process.env.AIVA_CONCIERGE_ZOOM_ENABLED;
    process.env.AIVA_CONCIERGE_ZOOM_ENABLED = 'false';
    expect(conciergeFeatureFlags().zoom).toBe(false);
    if (prev === undefined) delete process.env.AIVA_CONCIERGE_ZOOM_ENABLED;
    else process.env.AIVA_CONCIERGE_ZOOM_ENABLED = prev;
  });

  it('parses readiness fixture via helper', () => {
    const report = parseReadinessReport(loadJson('readiness-all-not-configured.json'));
    expect(report.blockers).toContain('zoom');
    expect(report.features.microsoftCalendar.status).toBe('not_configured');
  });
});
