import type { OutreachStoreShape } from './types.js';

export function emptyOutreachStore(): OutreachStoreShape {
  return {
    leads: [],
    campaigns: [],
    sequences: [],
    enrollments: [],
    deliveries: [],
    lists: [],
    replyReviews: [],
    bookings: [],
    reminders: [],
    bookingConfigs: {},
    boardConfigs: {},
    boardRefs: {},
    alertTargets: {},
    controls: {},
    followUpTasks: [],
    leadSheetConfigs: {},
    ingestJobs: [],
    leadViews: [],
    suppressions: [],
  };
}
