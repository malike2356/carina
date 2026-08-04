/**
 * Workspace-facing feature catalogue for Aiva.
 * Platform defaults are the baseline; workspace overrides take priority when set.
 */

export type WorkspaceFeatureCategory = 'core' | 'workspace' | 'ai' | 'analytics';

export type WorkspaceFeatureKey =
  | 'document_vault'
  | 'google_drive_sync'
  | 'team_management'
  | 'ai_workers'
  | 'approvals'
  | 'projects'
  | 'email'
  | 'calendar'
  | 'contacts'
  | 'outreach'
  | 'channels'
  | 'youtube_channel'
  | 'marketplace'
  | 'human_assist'
  | 'workspace_lab'
  | 'ai_chat_assistant'
  | 'ai_document_search'
  | 'ai_agent_tools'
  | 'ai_auto_tagging'
  | 'ai_reports'
  | 'activity_analytics';

export type WorkspaceFeatureDefinition = {
  key: WorkspaceFeatureKey;
  label: string;
  description: string;
  category: WorkspaceFeatureCategory;
  /** Core features are always on and have no admin toggle. */
  alwaysOn: boolean;
  /** Platform default when no workspace override is set. */
  platformDefault: boolean;
  /**
   * Optional platform kill-switch key. When that platform flag is off,
   * the feature stays disabled even if the workspace override is true.
   */
  requiresPlatformFlag?: string;
};

export const WORKSPACE_FEATURE_CATEGORY_LABELS: Record<WorkspaceFeatureCategory, string> = {
  core: 'Core Features',
  workspace: 'Workspace Modules',
  ai: 'AI Features',
  analytics: 'Analytics',
};

export const WORKSPACE_FEATURES: WorkspaceFeatureDefinition[] = [
  {
    key: 'document_vault',
    label: 'Document Vault',
    description: 'Store and organise workspace documents and folders.',
    category: 'core',
    alwaysOn: true,
    platformDefault: true,
  },
  {
    key: 'google_drive_sync',
    label: 'Google Drive Sync',
    description: 'Connect Google Drive for document import and sync.',
    category: 'core',
    alwaysOn: true,
    platformDefault: true,
  },
  {
    key: 'team_management',
    label: 'Team Management',
    description: 'Invite teammates and manage workspace access.',
    category: 'core',
    alwaysOn: true,
    platformDefault: true,
  },
  {
    key: 'ai_workers',
    label: 'AI Workers',
    description: 'Hire and manage AI employees, including the org canvas.',
    category: 'workspace',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'ai_workers',
  },
  {
    key: 'approvals',
    label: 'Approvals',
    description: 'Review drafts before Aivas send email, messaging, or social replies.',
    category: 'workspace',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'approvals',
  },
  {
    key: 'projects',
    label: 'Projects',
    description: 'Group work into projects for your AI team.',
    category: 'workspace',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'projects',
  },
  {
    key: 'email',
    label: 'Email',
    description: 'Read, send, and triage workspace email.',
    category: 'workspace',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'email',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    description: 'Calendar views, schedules, and Google Calendar sync.',
    category: 'workspace',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'calendar',
  },
  {
    key: 'contacts',
    label: 'Contacts',
    description: 'Browse, edit, and resync Google or CSV contacts for your Aivas.',
    category: 'workspace',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'contacts',
  },
  {
    key: 'outreach',
    label: 'Outreach',
    description: 'Lead pipeline, follow-ups, replies, bookings, and handoffs.',
    category: 'workspace',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'outreach',
  },
  {
    key: 'channels',
    label: 'Channels',
    description: 'WhatsApp, Slack, Telegram, and other messaging channels.',
    category: 'workspace',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'channels',
  },
  {
    key: 'youtube_channel',
    label: 'YouTube Channel',
    description: 'Beta: faceless YouTube channel pipeline across selectable domains; MP4 render required before publish.',
    category: 'workspace',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'youtube_channel',
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    description: 'One-click provision paths for storefront templates.',
    category: 'workspace',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'marketplace',
  },
  {
    key: 'human_assist',
    label: 'Human Assist',
    description: 'Request optional human help when an Aiva needs it.',
    category: 'workspace',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'human_assist',
  },
  {
    key: 'workspace_lab',
    label: 'Workspace Lab',
    description: 'Playground, sessions, skills, models, and runtime config.',
    category: 'workspace',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'workspace_lab',
  },
  {
    key: 'ai_chat_assistant',
    label: 'AI Chat Assistant',
    description: 'Ask Carina for in-product help and guidance.',
    category: 'ai',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'ai_chat_assistant',
  },
  {
    key: 'ai_document_search',
    label: 'AI Document Search',
    description: 'Find documents by describing what you need.',
    category: 'ai',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'ai_document_search',
  },
  {
    key: 'ai_agent_tools',
    label: 'AI Agent Tools',
    description: 'Research, product tools, and AI-powered automations.',
    category: 'ai',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'ai_agent_tools',
  },
  {
    key: 'ai_auto_tagging',
    label: 'AI Auto-Tagging',
    description: 'Suggest tags and labels on documents automatically.',
    category: 'ai',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'ai_auto_tagging',
  },
  {
    key: 'ai_reports',
    label: 'AI Reports',
    description: 'AI-generated summaries and workspace reports.',
    category: 'analytics',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'ai_reports',
  },
  {
    key: 'activity_analytics',
    label: 'Activity Analytics',
    description: 'Usage and activity metrics for this workspace.',
    category: 'analytics',
    alwaysOn: false,
    platformDefault: true,
    requiresPlatformFlag: 'activity_analytics',
  },
];

export const WORKSPACE_FEATURE_KEYS = WORKSPACE_FEATURES.map((feature) => feature.key);

export function isWorkspaceFeatureKey(value: string): value is WorkspaceFeatureKey {
  return WORKSPACE_FEATURE_KEYS.includes(value as WorkspaceFeatureKey);
}

export function getWorkspaceFeature(key: WorkspaceFeatureKey): WorkspaceFeatureDefinition {
  const found = WORKSPACE_FEATURES.find((feature) => feature.key === key);
  if (!found) {
    throw new Error(`Unknown workspace feature: ${key}`);
  }
  return found;
}

export function parseFeatureOverrides(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'boolean') continue;
    const normalized = key === 'property_channel' ? 'youtube_channel' : key;
    if (isWorkspaceFeatureKey(normalized)) {
      out[normalized] = value;
    }
  }
  return out;
}

/**
 * Platform flag map. Defaults to enabled for every known flag.
 * Pass a map with false values to simulate platform kill-switches in tests or ops.
 */
export type PlatformFlagMap = Record<string, boolean>;

export function defaultPlatformFlags(): PlatformFlagMap {
  const flags: PlatformFlagMap = {};
  for (const feature of WORKSPACE_FEATURES) {
    if (feature.requiresPlatformFlag) {
      flags[feature.requiresPlatformFlag] = true;
    }
  }
  return flags;
}

export type FeatureResolutionSource = 'always_on' | 'workspace_override' | 'platform_default' | 'platform_disabled';

export type ResolvedWorkspaceFeature = {
  key: WorkspaceFeatureKey;
  label: string;
  description: string;
  category: WorkspaceFeatureCategory;
  alwaysOn: boolean;
  enabled: boolean;
  overridden: boolean;
  source: FeatureResolutionSource;
  overrideValue: boolean | null;
  platformDefault: boolean;
  toggleable: boolean;
};

export function resolveWorkspaceFeature(
  feature: WorkspaceFeatureDefinition,
  overrides: Record<string, boolean>,
  platformFlags: PlatformFlagMap = defaultPlatformFlags(),
): ResolvedWorkspaceFeature {
  if (feature.alwaysOn) {
    return {
      key: feature.key,
      label: feature.label,
      description: feature.description,
      category: feature.category,
      alwaysOn: true,
      enabled: true,
      overridden: false,
      source: 'always_on',
      overrideValue: null,
      platformDefault: true,
      toggleable: false,
    };
  }

  const platformFlagKey = feature.requiresPlatformFlag;
  // Prefer explicit youtube_channel flag; accept legacy property_channel when present.
  const resolvedPlatformEnabled = (() => {
    if (!platformFlagKey) return true;
    if (Object.prototype.hasOwnProperty.call(platformFlags, platformFlagKey)) {
      return platformFlags[platformFlagKey] !== false;
    }
    if (platformFlagKey === 'youtube_channel' && Object.prototype.hasOwnProperty.call(platformFlags, 'property_channel')) {
      return platformFlags.property_channel !== false;
    }
    return true;
  })();

  if (!resolvedPlatformEnabled) {
    return {
      key: feature.key,
      label: feature.label,
      description: feature.description,
      category: feature.category,
      alwaysOn: false,
      enabled: false,
      overridden: Object.prototype.hasOwnProperty.call(overrides, feature.key),
      source: 'platform_disabled',
      overrideValue: Object.prototype.hasOwnProperty.call(overrides, feature.key)
        ? Boolean(overrides[feature.key])
        : null,
      platformDefault: feature.platformDefault,
      toggleable: true,
    };
  }

  if (Object.prototype.hasOwnProperty.call(overrides, feature.key)) {
    const overrideValue = Boolean(overrides[feature.key]);
    return {
      key: feature.key,
      label: feature.label,
      description: feature.description,
      category: feature.category,
      alwaysOn: false,
      enabled: overrideValue,
      overridden: true,
      source: 'workspace_override',
      overrideValue,
      platformDefault: feature.platformDefault,
      toggleable: true,
    };
  }

  return {
    key: feature.key,
    label: feature.label,
    description: feature.description,
    category: feature.category,
    alwaysOn: false,
    enabled: feature.platformDefault,
    overridden: false,
    source: 'platform_default',
    overrideValue: null,
    platformDefault: feature.platformDefault,
    toggleable: true,
  };
}

export function resolveAllWorkspaceFeatures(
  overrides: Record<string, boolean>,
  platformFlags: PlatformFlagMap = defaultPlatformFlags(),
): ResolvedWorkspaceFeature[] {
  return WORKSPACE_FEATURES.map((feature) =>
    resolveWorkspaceFeature(feature, overrides, platformFlags),
  );
}

export function isFeatureEnabled(
  key: WorkspaceFeatureKey,
  overrides: Record<string, boolean>,
  platformFlags: PlatformFlagMap = defaultPlatformFlags(),
): boolean {
  return resolveWorkspaceFeature(getWorkspaceFeature(key), overrides, platformFlags).enabled;
}

/** Routes gated by a workspace feature. Used by middleware-style checks. */
export const WORKSPACE_FEATURE_ROUTE_GATES: Array<{
  feature: WorkspaceFeatureKey;
  match: (pathname: string) => boolean;
}> = [
  {
    feature: 'ai_workers',
    match: (pathname) =>
      pathname.startsWith('/aiva/workers')
      || pathname.startsWith('/aiva/canvas')
      || pathname.startsWith('/aiva/hire')
      || pathname.startsWith('/aiva/provision')
      || pathname.startsWith('/aiva/roles'),
  },
  {
    feature: 'approvals',
    match: (pathname) =>
      pathname.startsWith('/aiva/approvals')
      || pathname.startsWith('/aiva/escalations')
      || pathname.startsWith('/conversations')
      || pathname.startsWith('/aiva/browser-assists')
      || pathname.startsWith('/api/approvals'),
  },
  {
    feature: 'projects',
    match: (pathname) =>
      pathname.startsWith('/aiva/projects')
      || pathname.startsWith('/api/projects'),
  },
  {
    feature: 'email',
    match: (pathname) =>
      pathname.startsWith('/email')
      || pathname.startsWith('/api/email'),
  },
  {
    feature: 'calendar',
    match: (pathname) =>
      pathname.startsWith('/calendar')
      || pathname.startsWith('/vical')
      || pathname.startsWith('/notes')
      || pathname.startsWith('/tasks')
      || pathname.startsWith('/scheduled')
      || pathname.startsWith('/api/calendar')
      || pathname.startsWith('/api/aiva/vical')
      || pathname.startsWith('/api/notes'),
  },
  {
    feature: 'contacts',
    match: (pathname) =>
      pathname.startsWith('/contacts')
      || pathname.startsWith('/settings/contacts')
      || pathname.startsWith('/api/contacts'),
  },
  {
    feature: 'outreach',
    match: (pathname) =>
      pathname.startsWith('/outreach')
      || pathname.startsWith('/api/outreach'),
  },
  {
    feature: 'channels',
    match: (pathname) =>
      pathname.startsWith('/settings/channels')
      || (pathname.startsWith('/channels') && !pathname.startsWith('/settings'))
      || pathname.startsWith('/api/channels'),
  },
  {
    feature: 'youtube_channel',
    match: (pathname) =>
      pathname.startsWith('/aiva/youtube-channel')
      || pathname.startsWith('/aiva/property-channel')
      || pathname.startsWith('/api/aiva/youtube-channel')
      || pathname.startsWith('/api/aiva/property-channel'),
  },
  {
    feature: 'outreach',
    match: (pathname) =>
      pathname.startsWith('/aiva/outreach')
      || pathname.startsWith('/api/aiva/outreach'),
  },
  {
    feature: 'marketplace',
    match: (pathname) => pathname.startsWith('/aiva/marketplace'),
  },
  {
    feature: 'human_assist',
    match: (pathname) =>
      pathname.startsWith('/aiva/human-assist')
      || pathname.startsWith('/api/human-assist'),
  },
  {
    feature: 'workspace_lab',
    match: (pathname) =>
      pathname.startsWith('/aiva/lab')
      || pathname.startsWith('/sessions')
      || pathname.startsWith('/skills')
      || pathname.startsWith('/models')
      || pathname.startsWith('/config'),
  },
  {
    feature: 'ai_agent_tools',
    match: (pathname) =>
      pathname.startsWith('/research')
      || pathname.startsWith('/api/research')
      || pathname.startsWith('/aiva/tools'),
  },
  {
    feature: 'ai_chat_assistant',
    match: (pathname) =>
      pathname.startsWith('/api/carina')
      || pathname.startsWith('/api/karina')
      || pathname.startsWith('/aiva/help'),
  },
  {
    feature: 'ai_document_search',
    match: (pathname) => pathname.startsWith('/api/documents/search'),
  },
  {
    feature: 'activity_analytics',
    match: (pathname) =>
      pathname.startsWith('/analytics')
      || pathname.startsWith('/api/analytics'),
  },
  {
    feature: 'ai_reports',
    match: (pathname) =>
      pathname.startsWith('/api/reports')
      || pathname.startsWith('/reports'),
  },
];

export function featureRequiredForPath(pathname: string): WorkspaceFeatureKey | null {
  for (const gate of WORKSPACE_FEATURE_ROUTE_GATES) {
    if (gate.match(pathname)) return gate.feature;
  }
  return null;
}
