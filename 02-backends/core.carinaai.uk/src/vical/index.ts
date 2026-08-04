export type {
  VcalAvailabilityRule,
  VcalBlackoutDate,
  VcalBooking,
  VcalBookingSource,
  VcalBookingStatus,
  VcalBusyWindow,
  VcalEventType,
  VcalLocationMode,
  VcalOfferedSlot,
  VcalSessionOutcome,
  VcalSlotLock,
} from './types.js';
export { VCAL_BOOKING_SOURCES, VCAL_BOOKING_STATUSES, VCAL_SESSION_OUTCOMES } from './types.js';
export { emptyVicalStore, loadVicalStore, mutateVicalStore, resetVicalStoreCache, saveVicalStore } from './store.js';
export { isVcalError, SlotUnavailableError, VcalError } from './errors.js';
export { onVcalHook, emitVcalHook } from './hooks.js';
export { acquireSlotLock, listActiveLocks, pruneExpiredLocks, releaseSlotLock } from './locks.js';
export { assertSlotFree, collectBusyFromBookings, offerSlots, overlaps } from './slots.js';
export { ensureDiscoveryDefaults } from './seed.js';
export { syncConfigFromOutreach, readConfigAsOutreach } from './config-bridge.js';
export {
  backfillOutreachBookingsToVical,
  createOutreachBookingViaVical,
  mapVicalToOutreachBooking,
  offerSlotsViaVical,
  readMergedBookingConfig,
} from './outreach-adapter.js';
export {
  approveBooking,
  cancelBookingForGuest,
  cancelBookingForHost,
  createAvailabilityRule,
  createBlackout,
  createBooking,
  createEventType,
  createFromOutreach,
  deleteBlackout,
  getBooking,
  getBookingByGuestToken,
  getEventType,
  getOrCreatePublishProfile,
  listAvailabilityRules,
  listBlackouts,
  listBookings,
  listEventTypes,
  listOfferedSlots,
  rejectBooking,
  replaceAvailabilityRules,
  rescheduleBooking,
  rescheduleBookingForGuest,
  resolveWorkspaceByPublicSlug,
  setSessionOutcome,
  updateEventType,
} from './bookings.js';
