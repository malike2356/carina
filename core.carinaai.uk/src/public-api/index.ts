// STABLE API: changes require semver major bump and docs/kernel/STABLE_API.md update.
//
// Pack authors and extension developers should import from documented entrypoints only:
//   @verlox/carina-core          barrel (this file)
//   @verlox/carina-core/pack     domain pack manifest and validation
//   @verlox/carina-core/tool      tool registration
//   @verlox/carina-core/channel   channel adapter types
//   @verlox/carina-core/memory    memory backend types
//   @verlox/carina-core/provider  LLM provider registration

export const STABLE_API_VERSION = '0.2.0';

export * from './pack.js';
export * from './tool.js';
export * from './channel.js';
export * from './memory.js';
export * from './provider.js';
