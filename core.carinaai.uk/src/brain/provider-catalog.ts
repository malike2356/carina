import type { ProviderAuthType, ProviderDefinition, ProviderStatus } from './provider-registry.js';
import {
  PROVIDER_DEFINITIONS,
  isProviderConfigured,
  isRoutableProvider,
  providerModel,
  providerTransportType,
  resolveAliasTarget,
  type ProviderTransportType,
} from './provider-registry.js';
import { getProviderHealth, type ProviderHealthState } from './provider-health.js';
import type { ProviderCostTag } from './provider-tags.js';
import { providerCostLabel } from './provider-tags.js';

export interface ProviderCatalogRow {
  id: string;
  displayName: string;
  authType: ProviderAuthType;
  costTag: ProviderCostTag;
  status: ProviderStatus;
  transportType: ProviderTransportType;
  configured: boolean;
  routable: boolean;
  health: ProviderHealthState;
  model?: string;
  aliasFor?: string;
}

export interface ProviderCatalogOptions {
  /** Names returned by LLMRouter.list() when runtime instances exist. */
  runtimeConfigured?: Set<string>;
  /** Include aliases, external-cli, oauth entries. Default false for chat surfaces. */
  includeCatalogOnly?: boolean;
}

function rowFromDefinition(
  def: ProviderDefinition,
  runtimeConfigured?: Set<string>,
): ProviderCatalogRow {
  const configured = runtimeConfigured
    ? runtimeConfigured.has(def.name)
    : isProviderConfigured(def);

  return {
    id: def.name,
    displayName: def.displayName,
    authType: def.authType,
    costTag: def.tags.cost,
    status: def.status,
    transportType: providerTransportType(def),
    configured,
    routable: isRoutableProvider(def),
    health: getProviderHealth(def.name),
    model: isRoutableProvider(def) ? providerModel(def) : undefined,
    aliasFor: def.aliasFor,
  };
}

export function buildCatalogRows(options: ProviderCatalogOptions = {}): ProviderCatalogRow[] {
  const { runtimeConfigured, includeCatalogOnly = false } = options;
  return PROVIDER_DEFINITIONS
    .filter((def) => includeCatalogOnly || isRoutableProvider(def))
    .map((def) => rowFromDefinition(def, runtimeConfigured));
}

export function discoverConfiguredProviderNames(): string[] {
  return PROVIDER_DEFINITIONS
    .filter((def) => isRoutableProvider(def) && isProviderConfigured(def))
    .map((def) => def.name);
}

function configuredLabel(row: ProviderCatalogRow): string {
  if (row.status === 'alias') return `alias -> ${row.aliasFor}`;
  if (row.status === 'external-cli') return 'install required';
  if (row.status === 'oauth') return 'oauth setup';
  return row.configured ? 'configured' : 'missing key';
}

export function formatCompactCatalogLine(row: ProviderCatalogRow): string {
  const health = row.health !== 'unknown' ? ` health=${row.health}` : '';
  return [
    row.id.padEnd(16),
    providerCostLabel(row.costTag).padEnd(14),
    row.authType.padEnd(12),
    row.status.padEnd(13),
    configuredLabel(row).padEnd(16),
    row.transportType,
  ].join(' ') + health;
}

export function formatProviderCatalogHeader(): string {
  return [
    'name'.padEnd(16),
    'cost'.padEnd(14),
    'auth'.padEnd(12),
    'status'.padEnd(13),
    'configured'.padEnd(16),
    'transport',
  ].join(' ');
}

export function formatProviderCatalogReply(options: {
  currentProvider: string;
  currentModel: string;
  configuredNames: string[];
  preset?: string;
  title?: string;
}): string {
  const rows = buildCatalogRows({
    runtimeConfigured: new Set(options.configuredNames),
  });
  const lines: string[] = [];
  const title = options.title ?? 'Provider catalog (routable)';
  lines.push(title);
  lines.push(`Current: ${options.currentProvider} / ${options.currentModel}`);
  if (options.preset) {
    lines.push(`Preset: ${options.preset}`);
  }
  lines.push('');
  lines.push(formatProviderCatalogHeader());
  for (const row of rows) {
    lines.push(formatCompactCatalogLine(row));
  }
  lines.push('');
  lines.push('Usage: /provider <name> [model]  |  carina providers list  |  carina providers copilot');
  return lines.join('\n');
}

export function resolveProviderAlias(name: string): string {
  return resolveAliasTarget(name) ?? name;
}
