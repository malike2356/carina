// STABLE API: extension authors should import only from @verlox/carina-core/plugin-sdk.

export const PLUGIN_SDK_VERSION = '0.2.0';

export type {
  DomainRulePack,
  ExtensionRulePackFile,
  ExtensionToolModule,
  Tool,
} from './types.js';

export {
  normaliseExtensionRulePacks,
  normaliseExtensionTools,
  parseDomainRulePackFile,
  validateDomainRulePack,
} from './types.js';

export {
  EXTENSION_API_VERSION,
  EXTENSION_MANIFEST_VERSION,
  validateExtensionManifest,
  type ExtensionCapability,
  type ExtensionDependencies,
  type ExtensionEntryPoints,
  type ExtensionEvalConfig,
  type ExtensionManifest,
  type ExtensionRisk,
  type ExtensionSafety,
} from '../public-api/extension.js';

export {
  PACK_API_VERSION,
  PACK_MANIFESTS,
  listKnownPackNames,
  readPackManifest,
  validatePackManifest,
  type PackManifest,
} from '../public-api/pack.js';

export {
  TOOL_API_VERSION,
  registerTool,
  unregisterTool,
  ToolRegistry,
  type ToolDefinition,
} from '../public-api/tool.js';

export {
  PROVIDER_API_VERSION,
  registerProvider,
  registerProviders,
  type ProviderDefinition,
} from '../public-api/provider.js';

export type { ProviderPlugin } from '../plugins/types.js';

export {
  CHANNEL_API_VERSION,
  type ChannelAdapter,
} from '../public-api/channel.js';

export {
  MEMORY_API_VERSION,
  type MemoryBackend,
} from '../public-api/memory.js';
