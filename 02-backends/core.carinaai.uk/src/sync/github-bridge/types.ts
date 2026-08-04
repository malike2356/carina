export type GithubBridgeProduct = 'carina' | 'aiva' | 'shared';
export type GithubBridgeScopeKind = 'workspace' | 'user' | 'shared';

export interface GithubBridgeManifest {
  version: number;
  canonicalRepo: string;
  defaultBranch: string;
  /** Folders agents may read into working memory / RAG. */
  readFolders: string[];
  /** Folders agents may push durable updates into. */
  writeFolders: string[];
  /** Paths that must never be committed (globs relative to repo root). */
  denyGlobs: string[];
  products: Record<
    GithubBridgeProduct,
    {
      mountFolders: string[];
      agentId: string;
    }
  >;
}

export interface GithubBridgeConfig {
  scopeKind: GithubBridgeScopeKind;
  scopeId: string | null;
  enabled: boolean;
  owner: string;
  repo: string;
  branch: string;
  /** Minutes between pull cycles. */
  pullIntervalMinutes: number;
  /** Minutes between push of approved durable updates. 0 = push only on explicit save. */
  pushIntervalMinutes: number;
  /** Subset of manifest read folders actually mounted for this install. */
  allowedFolders: string[];
  /** When true, human-edited local files are not overwritten on pull. */
  humanEditsWin: boolean;
  /** Product mount identity for shared schema. */
  product: GithubBridgeProduct;
  /** Local clone directory (under CARINA_HOME when empty). */
  localPath?: string;
  lastPullAt?: string | null;
  lastPushAt?: string | null;
  lastIndexAt?: string | null;
  lastError?: string | null;
}

export interface GithubBridgeStatus {
  scopeKind: GithubBridgeScopeKind;
  scopeId: string | null;
  scopeKey: string;
  configured: boolean;
  enabled: boolean;
  hasToken: boolean;
  repo: string | null;
  branch: string;
  localPath: string;
  cloneExists: boolean;
  allowedFolders: string[];
  pullIntervalMinutes: number;
  pushIntervalMinutes: number;
  humanEditsWin: boolean;
  product: GithubBridgeProduct;
  lastPullAt: string | null;
  lastPushAt: string | null;
  lastIndexAt: string | null;
  lastError: string | null;
  indexedChunks: number;
}

export interface GithubBridgeSearchHit {
  path: string;
  score: number;
  snippet: string;
  product?: string;
  agent?: string;
}

export interface SyncCycleResult {
  ok: boolean;
  action: 'pull' | 'push' | 'index' | 'full';
  pulled?: boolean;
  pushed?: boolean;
  indexed?: number;
  committedFiles?: string[];
  skippedSecrets?: string[];
  skippedHuman?: string[];
  error?: string;
}

export const DEFAULT_MANIFEST: GithubBridgeManifest = {
  version: 1,
  canonicalRepo: 'malike2356/agent-sync',
  defaultBranch: 'main',
  readFolders: ['memory', 'skills', 'plans', 'AGENTS.md', 'DESIGN.md', 'README.md', 'sync'],
  writeFolders: ['memory/agents', 'memory/sessions', 'memory/projects', 'memory/decisions.md', 'plans', 'sync/logs'],
  denyGlobs: [
    '.env',
    '.env.*',
    '**/.env',
    '**/.env.*',
    '**/*secret*',
    '**/*credential*',
    '**/*password*',
    '**/*.pem',
    '**/*.key',
    '**/*token*',
    '**/node_modules/**',
    '**/.git/**',
  ],
  products: {
    shared: { mountFolders: ['memory', 'skills', 'plans'], agentId: 'shared' },
    carina: { mountFolders: ['memory', 'skills', 'plans', 'memory/projects/carina.md'], agentId: 'carina' },
    aiva: { mountFolders: ['memory', 'skills', 'plans', 'memory/projects'], agentId: 'aiva' },
  },
};

export const DEFAULT_CONFIG: GithubBridgeConfig = {
  scopeKind: 'workspace',
  scopeId: null,
  enabled: false,
  owner: '',
  repo: '',
  branch: 'main',
  pullIntervalMinutes: 15,
  pushIntervalMinutes: 0,
  allowedFolders: ['memory', 'skills', 'plans', 'AGENTS.md'],
  humanEditsWin: true,
  product: 'shared',
  lastPullAt: null,
  lastPushAt: null,
  lastIndexAt: null,
  lastError: null,
};
