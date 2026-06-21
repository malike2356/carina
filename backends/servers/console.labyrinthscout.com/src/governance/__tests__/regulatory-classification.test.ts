import { describe, expect, it } from 'vitest';
import {
  classifyRegulatoryRisk,
  type RegulatoryClassificationInput,
} from '../regulatory-classification.js';

const NOW = new Date('2026-06-13T12:00:00.000Z');

function baseInput(overrides: Partial<RegulatoryClassificationInput> = {}): RegulatoryClassificationInput {
  return {
    risk_score: 15,
    unresolved_critical: 0,
    kill_switch_armed: true,
    kill_switch_triggered: false,
    erc8004_status: 'live',
    agents_total: 1,
    last_attestation_at: '2026-06-01T00:00:00.000Z',
    alert_channels_configured: true,
    audit_events_last_7d: true,
    egress_filter_enabled: true,
    breach_events_24h: 0,
    telemetry_days: 10,
    ...overrides,
  };
}

describe('classifyRegulatoryRisk', () => {
  it('minimal_risk: all conditions met returns minimal_risk with empty gaps', () => {
    const result = classifyRegulatoryRisk(baseInput(), NOW);
    expect(result.eu_ai_act.tier).toBe('minimal_risk');
    expect(result.eu_ai_act.gaps).toEqual([]);
    expect(result.data_sufficient).toBe(true);
  });

  it('limited_risk: missing attestation prevents minimal_risk', () => {
    const result = classifyRegulatoryRisk(baseInput({ last_attestation_at: null }), NOW);
    expect(result.eu_ai_act.tier).toBe('limited_risk');
    expect(result.eu_ai_act.gaps.length).toBeGreaterThan(0);
  });

  it('high_risk: unresolved critical incident forces high_risk', () => {
    const result = classifyRegulatoryRisk(baseInput({ unresolved_critical: 2 }), NOW);
    expect(result.eu_ai_act.tier).toBe('high_risk');
  });

  it('high_risk: risk_score >= 60 forces high_risk', () => {
    const result = classifyRegulatoryRisk(baseInput({ risk_score: 72 }), NOW);
    expect(result.eu_ai_act.tier).toBe('high_risk');
  });

  it('unacceptable_risk: risk >= 90 + breach + kill triggered', () => {
    const result = classifyRegulatoryRisk(baseInput({
      risk_score: 95,
      kill_switch_triggered: true,
      breach_events_24h: 3,
    }), NOW);
    expect(result.eu_ai_act.tier).toBe('unacceptable_risk');
  });

  it('uk_dsit aligned: kill switch + attestation + audit logs', () => {
    const result = classifyRegulatoryRisk(baseInput({
      audit_events_last_7d: true,
      kill_switch_armed: true,
      last_attestation_at: '2026-06-10T00:00:00.000Z',
      telemetry_days: 5,
    }), NOW);
    expect(result.uk_dsit.alignment).toBe('aligned');
  });

  it('uk_dsit partial: no attestation', () => {
    const result = classifyRegulatoryRisk(baseInput({
      last_attestation_at: null,
      audit_events_last_7d: true,
      telemetry_days: 5,
    }), NOW);
    expect(result.uk_dsit.alignment).toBe('partial');
  });

  it('data_sufficient false: fewer than 3 days telemetry returns not_assessed for uk_dsit', () => {
    const result = classifyRegulatoryRisk(baseInput({ telemetry_days: 2 }), NOW);
    expect(result.data_sufficient).toBe(false);
    expect(result.uk_dsit.alignment).toBe('not_assessed');
  });
});
