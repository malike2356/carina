export type { ProductMode, ProductSurface, RouteOwnership, ShellNavLink } from './types.js';
export {
  hostedAppHostname,
  hostedAppOrigin,
  isHostedSurface,
  isPrivateSurface,
  operatorHostList,
  resolveProductMode,
  resolveProductSurface,
} from './surface.js';
export {
  buildFeatureGuideContext,
  buildCapabilitySummaryLine,
} from './feature-guide.js';
export {
  buildCapabilitySummaryForSurface,
  buildSurfaceContract,
  collectSurfaceRuntimeSnapshot,
  resolveSurface,
  type CarinaSurface,
  type SurfaceCapabilityContract,
  type SurfaceCapabilityItem,
  type SurfaceRuntimeSnapshot,
} from './surface-capabilities.js';
export {
  hostedShellConfig,
  privateShellConfig,
  sharedWorkspacePageIds,
} from './shell-config.js';
export {
  classifyRoute,
  enforceRouteOwnership,
  isRouteAllowedForMode,
  normalizeRoutePath,
  opsBearerAllowedOnAnyHost,
  routeDenialForMode,
  surfaceForRequest,
} from './route-matrix.js';
