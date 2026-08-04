import { describe, expect, it } from 'vitest';
import { classifyComment } from './lead-detector.js';

describe('lead-detector', () => {
  it('classifies a comment with contact info and buying intent as hot_lead', () => {
    const result = classifyComment(
      'This looks like a great deal, is it still available? Email me at buyer@example.com',
    );
    expect(result.classification).toBe('hot_lead');
    expect(result.contactInfo.email).toBe('buyer@example.com');
  });

  it('classifies an interested question with no contact info as warm_lead', () => {
    const result = classifyComment('How much does a property like this usually rent for?');
    expect(result.classification).toBe('warm_lead');
    expect(result.contactInfo.email).toBeUndefined();
  });

  it('classifies investor language as warm_lead when no contact info is present', () => {
    const result = classifyComment('What kind of ROI and yield are you seeing on deals like this?');
    expect(result.classification).toBe('warm_lead');
  });

  it('classifies generic engagement as cold_lead', () => {
    const result = classifyComment('Great video, really enjoyed this one!');
    expect(result.classification).toBe('cold_lead');
    expect(result.signals).toEqual([]);
  });

  it('classifies short generic praise as cold_lead without false-positiving', () => {
    const result = classifyComment('Nice video, thanks for sharing');
    expect(result.classification).toBe('cold_lead');
  });

  it('classifies promotional comments as spam', () => {
    const result = classifyComment('Check out my channel for daily crypto giveaway videos!');
    expect(result.classification).toBe('spam');
  });

  it('detects a phone number as contact info', () => {
    const result = classifyComment('DM me or call 07123 456789, interested in a deal');
    expect(result.contactInfo.phone).toBeDefined();
    expect(result.classification).toBe('hot_lead');
  });

  it('does not detect a fragment of digits as a phone number', () => {
    const result = classifyComment('This property was built in 1995 and has 3 bedrooms');
    expect(result.contactInfo.phone).toBeUndefined();
    expect(result.classification).toBe('cold_lead');
  });
});
