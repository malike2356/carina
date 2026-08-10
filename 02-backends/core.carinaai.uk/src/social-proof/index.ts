export type {
  Platform,
  SentimentLabel,
  CurationStatus,
  Testimonial,
  CollectResult,
  ProofPageModel,
  ManualEntryInput,
} from './types.js';

export { normalizeQuote, fingerprintTestimonial, scoreSentiment, isDuplicate } from './sentiment.js';
export { TestimonialStore } from './store.js';
export {
  collectFromTwitter,
  collectFromLinkedIn,
  collectFromGitHub,
  collectFromDiscord,
  collectFromYouTube,
  collectFromPrimaryPlatforms,
  manualEntry,
} from './collector.js';
export { approve, reject, tag, assignProduct, inbox, curateTop } from './curation.js';
export { runWeeklyCollection, scheduleStatus, isWeeklyDue, resetScheduleForTests, WEEKLY_MS } from './schedule.js';
export { buildProofPageModel, renderProofPageHtml } from './proof-page.js';
