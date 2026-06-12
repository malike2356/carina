export const EXTENSION_MANIFEST_VERSION = 1;

export type ExtensionCapability =
  | 'skills'
  | 'prompts'
  | 'tools'
  | 'mcp'
  | 'hooks'
  | 'rag';

export type ExtensionRisk = 'low' | 'medium' | 'high';

export interface ExtensionEntryPoints {
  skills?: string;
  prompts?: string;
  tools?: string;
  mcp?: string;
  hooks?: string;
  rag?: string;
}

export interface ExtensionDependencies {
  packs?: string[];
  extensions?: string[];
}

export interface ExtensionEvalConfig {
  required?: boolean;
  path?: string;
}

export interface ExtensionManifest {
  manifestVersion: number;
  id: string;
  version: string;
  name: string;
  author: string;
  description: string;
  entryPoints: ExtensionEntryPoints;
  capabilities: ExtensionCapability[];
  dependencies?: ExtensionDependencies;
  eval?: ExtensionEvalConfig;
  risk?: ExtensionRisk;
}

export function validateExtensionManifest(raw: unknown, context = 'extension.json'): ExtensionManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid ${context}: not an object`);
  }
  const m = raw as Record<string, unknown>;

  const manifestVersion = Number(m.manifestVersion ?? 0);
  if (manifestVersion !== EXTENSION_MANIFEST_VERSION) {
    throw new Error(
      `Invalid ${context}: manifestVersion must be ${EXTENSION_MANIFEST_VERSION}`,
    );
  }

  for (const key of ['id', 'version', 'name', 'author', 'description'] as const) {
    if (!m[key] || typeof m[key] !== 'string' || !String(m[key]).trim()) {
      throw new Error(`Invalid ${context}: missing ${key}`);
    }
  }

  const id = String(m.id).trim();
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(id)) {
    throw new Error(`Invalid ${context}: id must be lowercase slug (a-z0-9-)`);
  }

  const capabilitiesRaw = m.capabilities;
  if (!Array.isArray(capabilitiesRaw) || capabilitiesRaw.length === 0) {
    throw new Error(`Invalid ${context}: capabilities must be a non-empty array`);
  }

  const validCaps = new Set<ExtensionCapability>([
    'skills', 'prompts', 'tools', 'mcp', 'hooks', 'rag',
  ]);
  const capabilities = capabilitiesRaw.map(String) as ExtensionCapability[];
  for (const cap of capabilities) {
    if (!validCaps.has(cap)) {
      throw new Error(`Invalid ${context}: unknown capability "${cap}"`);
    }
  }

  const entryPointsRaw = m.entryPoints;
  if (!entryPointsRaw || typeof entryPointsRaw !== 'object') {
    throw new Error(`Invalid ${context}: entryPoints object is required`);
  }
  const ep = entryPointsRaw as Record<string, unknown>;
  const entryPoints: ExtensionEntryPoints = {};
  for (const cap of capabilities) {
    const value = ep[cap];
    if (value !== undefined && typeof value !== 'string') {
      throw new Error(`Invalid ${context}: entryPoints.${cap} must be a string path`);
    }
    if (typeof value === 'string' && value.trim()) {
      entryPoints[cap] = value.trim();
    }
  }

  for (const cap of capabilities) {
    if (!entryPoints[cap]) {
      throw new Error(`Invalid ${context}: capability "${cap}" requires entryPoints.${cap}`);
    }
  }

  let dependencies: ExtensionDependencies | undefined;
  if (m.dependencies !== undefined) {
    if (!m.dependencies || typeof m.dependencies !== 'object') {
      throw new Error(`Invalid ${context}: dependencies must be an object`);
    }
    const deps = m.dependencies as Record<string, unknown>;
    dependencies = {
      packs: Array.isArray(deps.packs) ? deps.packs.map(String) : undefined,
      extensions: Array.isArray(deps.extensions) ? deps.extensions.map(String) : undefined,
    };
  }

  let evalConfig: ExtensionEvalConfig | undefined;
  if (m.eval !== undefined) {
    if (!m.eval || typeof m.eval !== 'object') {
      throw new Error(`Invalid ${context}: eval must be an object`);
    }
    const ev = m.eval as Record<string, unknown>;
    evalConfig = {
      required: ev.required === true,
      path: ev.path ? String(ev.path) : undefined,
    };
  }

  const riskRaw = m.risk;
  const risk = riskRaw ? String(riskRaw) as ExtensionRisk : 'low';
  if (!['low', 'medium', 'high'].includes(risk)) {
    throw new Error(`Invalid ${context}: risk must be low, medium, or high`);
  }

  return {
    manifestVersion,
    id,
    version: String(m.version),
    name: String(m.name),
    author: String(m.author),
    description: String(m.description),
    entryPoints,
    capabilities,
    dependencies,
    eval: evalConfig,
    risk,
  };
}
