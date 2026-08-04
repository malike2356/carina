# Changelog

All notable changes to `@verlox/carina-core` and the stable public API.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-06-14

### Public API

- **Introduced stable extension entrypoints** (semver-governed):
  - `@verlox/carina-core` barrel
  - `@verlox/carina-core/pack` - `PackManifest`, `validatePackManifest`, `resolvePack`
  - `@verlox/carina-core/tool` - `Tool`, `registerTool`, `ToolRegistry`
  - `@verlox/carina-core/channel` - `ChannelAdapter` (`IChannelAdapter`)
  - `@verlox/carina-core/memory` - `MemoryBackend` type and backend listing
  - `@verlox/carina-core/provider` - `ProviderDefinition`, `registerProvider`
- Documented policy in `docs/kernel/STABLE_API.md`
- Added `src/public-api/compatibility.test.ts` with manifest field snapshot
- **Extracted `@verlox/carina-web`** optional package (gateway UI + dashboard assets); `carina serve` loads it dynamically

### Changed

- Package renamed from `carina-agent` to `@verlox/carina-core` (kernel)
- `carina-agent` meta-package remains as transition shim
- Domain pack sources excluded from npm tarball; lazy pack loading via `pack-resolver`

[Unreleased]: https://github.com/malike2356/carina-agent/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/malike2356/carina-agent/releases/tag/v0.2.0
