import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  scoreClient,
  getDefaultScorecardTemplate,
  SCORECARD_CRITERIA,
  recommendationGuidance,
} from './qualification-scorecard.js';
import {
  generateDeclineEmail,
  listWalkAwayTemplates,
  suggestDeclineReason,
} from './walk-away-templates.js';
import {
  analyzePatterns,
  buildDeclinedDealRecord,
  improveScorecard,
  getWinLossRatio,
  buildQuarterlyReview,
} from './post-decline-review.js';
import {
  appendDeclinedDeal,
  appendFounderOverride,
  getWorkspaceWeights,
  listDeclinedDeals,
  resetQualificationStoreCache,
  setWorkspaceWeights,
} from './store.js';

const PREV_HOME = process.env.CARINA_HOME;

describe('client qualification scorecard', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-qual-'));
    process.env.CARINA_HOME = tmpHome;
    resetQualificationStoreCache();
  });

  afterEach(() => {
    resetQualificationStoreCache();
    if (PREV_HOME === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = PREV_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('exposes at least 8 weighted criteria in the template', () => {
    const template = getDefaultScorecardTemplate();
    expect(template.criteria.length).toBeGreaterThanOrEqual(8);
    expect(SCORECARD_CRITERIA).toHaveLength(8);
  });

  it('scores good / borderline / bad clients as GREEN / YELLOW / RED', () => {
    const good = scoreClient({
      name: 'Acme Ltd',
      company: 'Acme',
      scopeChangeCount: 0,
      budgetMatchesScope: true,
      decisionMakerPresent: true,
      timelineRealistic: true,
      asksAboutProcess: true,
      complimentCount: 1,
      substantiveQuestionCount: 4,
      badVendorHistory: false,
      paymentIssues: false,
    });
    expect(good.score).toBeGreaterThanOrEqual(75);
    expect(good.recommendation).toBe('GREEN');
    expect(recommendationGuidance(good.recommendation)).toMatch(/Proceed/i);

    const yellow = scoreClient({
      name: 'Caution Co',
      scopeChangeCount: 1,
      budgetMatchesScope: true,
      decisionMakerPresent: true,
      timelineRealistic: true,
      asksAboutProcess: false,
      complimentCount: 0,
      substantiveQuestionCount: 2,
      badVendorHistory: false,
      paymentIssues: false,
    });
    expect(yellow.score).toBeGreaterThanOrEqual(50);
    expect(yellow.score).toBeLessThan(75);
    expect(yellow.recommendation).toBe('YELLOW');

    const bad = scoreClient({
      name: 'Chaos Inc',
      scopeChangeCount: 3,
      budgetMatchesScope: false,
      decisionMakerPresent: false,
      timelineRealistic: false,
      asksAboutProcess: false,
      complimentCount: 10,
      substantiveQuestionCount: 1,
      badVendorHistory: true,
      paymentIssues: false,
    });
    expect(bad.score).toBeLessThan(50);
    expect(bad.recommendation).toBe('RED');
  });

  it('forces RED on payment issues regardless of other scores', () => {
    const result = scoreClient({
      name: 'Nonpayer',
      scopeChangeCount: 0,
      budgetMatchesScope: true,
      decisionMakerPresent: true,
      timelineRealistic: true,
      asksAboutProcess: true,
      paymentIssues: true,
    });
    expect(result.automaticFail).toBe(true);
    expect(result.score).toBe(0);
    expect(result.recommendation).toBe('RED');
  });

  it('generates personalized decline emails for each scenario', () => {
    const templates = listWalkAwayTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(4);
    const profile = { name: 'Jordan Lee', company: 'Lee Ventures' };
    for (const t of templates) {
      const email = generateDeclineEmail({
        clientProfile: profile,
        reason: t.reason,
        senderName: 'Malike',
        alternative: 'a boutique delivery studio',
      });
      expect(email.subject.length).toBeGreaterThan(5);
      expect(email.body).toContain('Jordan');
      expect(email.body).toContain('Malike');
      expect(email.tone).toBe('professional_firm_open_door');
    }
  });

  it('logs post-decline reviews and analyzes recurring flags', () => {
    const ws = 'ws-test';
    const bad = scoreClient({
      name: 'Bad Deal',
      industry: 'agency',
      dealSizeGbp: 12_000,
      scopeChangeCount: 2,
      budgetMatchesScope: false,
      paymentIssues: false,
    });
    const record = buildDeclinedDealRecord({
      workspaceId: ws,
      clientProfile: bad.profileSnapshot,
      scorecard: bad,
      reason: suggestDeclineReason(bad),
      screenEarlier: 'Ask for written scope before second call',
    });
    appendDeclinedDeal(record);
    expect(listDeclinedDeals(ws)).toHaveLength(1);

    const patterns = analyzePatterns(listDeclinedDeals(ws));
    expect(patterns.declinedCount).toBe(1);
    expect(patterns.topRecurringFlags.length).toBeGreaterThan(0);
    expect(improveScorecard(patterns).length).toBeGreaterThanOrEqual(0);
    expect(getWinLossRatio(listDeclinedDeals(ws)).length).toBeGreaterThan(0);

    const email = generateDeclineEmail({
      clientProfile: bad.profileSnapshot,
      reason: 'scope_mismatch',
    });
    expect(email.body).toMatch(/scope/i);
  });

  it('allows adjustable workspace weights and founder override audit', () => {
    const ws = 'ws-weights';
    const updated = setWorkspaceWeights(ws, { scope_creep: 5 });
    expect(updated.scope_creep).toBe(5);
    expect(getWorkspaceWeights(ws).scope_creep).toBe(5);

    appendFounderOverride({
      id: 'ov1',
      workspaceId: ws,
      at: new Date().toISOString(),
      clientName: 'Override Co',
      scorecardScore: 20,
      recommendationWas: 'RED',
      approvedBy: 'founder@verlox.uk',
      justification: 'Strategic partnership trial with prepaid retainer',
    });

    const review = buildQuarterlyReview({
      declined: listDeclinedDeals(ws),
      overrides: [
        {
          id: 'ov1',
          workspaceId: ws,
          at: new Date().toISOString(),
          clientName: 'Override Co',
          scorecardScore: 20,
          recommendationWas: 'RED',
          approvedBy: 'founder@verlox.uk',
          justification: 'trial',
        },
      ],
      from: '2020-01-01T00:00:00.000Z',
      to: '2099-01-01T00:00:00.000Z',
    });
    expect(review.overridesCount).toBe(1);
    expect(review.predictionNotes.length).toBeGreaterThan(0);
  });
});
