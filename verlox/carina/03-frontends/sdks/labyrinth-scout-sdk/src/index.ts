export { ScoutClient } from './client.js';
export { KillSwitchWatcher, KillSwitchSseWatcher } from './kill-switch.js';
export { scoutWrap } from './wrap.js';
export { scoutMiddleware } from './middleware.js';
export type { ScoutClientOptions } from './client.js';
export type { ScoutWrapOptions } from './wrap.js';
export type { ScoutMiddlewareOptions } from './middleware.js';
export type { KillSwitchWatcherOptions } from './kill-switch.js';
export type * from './types.js';

// v0.1 compatibility alias
export { ScoutClient as LabyrinthScoutClient } from './client.js';
