import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import { writeAuditLog } from '@/lib/audit';
import {
  type PlatformFlagMap,
  type ResolvedWorkspaceFeature,
  type WorkspaceFeatureKey,
  defaultPlatformFlags,
  getWorkspaceFeature,
  isWorkspaceFeatureKey,
  parseFeatureOverrides,
  resolveAllWorkspaceFeatures,
  resolveWorkspaceFeature,
} from '@/lib/workspace-features';

export type FeatureOverrideMutationResult = {
  feature: ResolvedWorkspaceFeature;
  overrides: Record<string, boolean>;
};

function auditValue(value: boolean | null | undefined): string | boolean {
  if (value === null || value === undefined) return 'platform_default';
  return value;
}

async function loadWorkspaceRow(workspaceId: string) {
  const [row] = await db
    .select({
      id: workspaces.id,
      featureOverrides: workspaces.featureOverrides,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return row ?? null;
}

async function persistOverrides(workspaceId: string, overrides: Record<string, boolean>) {
  await db
    .update(workspaces)
    .set({
      featureOverrides: overrides,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId));
}

export class WorkspaceFeatureService {
  constructor(private readonly platformFlags: PlatformFlagMap = defaultPlatformFlags()) {}

  async listFeatures(workspaceId: string): Promise<ResolvedWorkspaceFeature[]> {
    const row = await loadWorkspaceRow(workspaceId);
    const overrides = parseFeatureOverrides(row?.featureOverrides);
    return resolveAllWorkspaceFeatures(overrides, this.platformFlags);
  }

  async isEnabled(workspaceId: string, feature: WorkspaceFeatureKey): Promise<boolean> {
    const row = await loadWorkspaceRow(workspaceId);
    const overrides = parseFeatureOverrides(row?.featureOverrides);
    return resolveWorkspaceFeature(
      getWorkspaceFeature(feature),
      overrides,
      this.platformFlags,
    ).enabled;
  }

  async getOverrides(workspaceId: string): Promise<Record<string, boolean>> {
    const row = await loadWorkspaceRow(workspaceId);
    return parseFeatureOverrides(row?.featureOverrides);
  }

  async setOverride(input: {
    workspaceId: string;
    userId: string;
    feature: WorkspaceFeatureKey;
    enabled: boolean;
    ip?: string | null;
  }): Promise<FeatureOverrideMutationResult> {
    const definition = getWorkspaceFeature(input.feature);
    if (definition.alwaysOn) {
      throw new Error('Core features cannot be overridden');
    }

    const current = await this.getOverrides(input.workspaceId);
    const hadKey = Object.prototype.hasOwnProperty.call(current, input.feature);
    const oldValue = hadKey ? current[input.feature] : null;
    const next = { ...current, [input.feature]: input.enabled };
    await persistOverrides(input.workspaceId, next);

    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: 'workspace_feature_override_set',
      detail: {
        feature: input.feature,
        old_value: auditValue(oldValue),
        new_value: input.enabled,
      },
      ip: input.ip,
    });

    return {
      overrides: next,
      feature: resolveWorkspaceFeature(definition, next, this.platformFlags),
    };
  }

  async removeOverride(input: {
    workspaceId: string;
    userId: string;
    feature: WorkspaceFeatureKey;
    ip?: string | null;
  }): Promise<FeatureOverrideMutationResult> {
    const definition = getWorkspaceFeature(input.feature);
    if (definition.alwaysOn) {
      throw new Error('Core features cannot be overridden');
    }

    const current = await this.getOverrides(input.workspaceId);
    const hadKey = Object.prototype.hasOwnProperty.call(current, input.feature);
    const oldValue = hadKey ? current[input.feature] : null;
    const next = { ...current };
    delete next[input.feature];
    await persistOverrides(input.workspaceId, next);

    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: 'workspace_feature_override_removed',
      detail: {
        feature: input.feature,
        old_value: auditValue(oldValue),
        new_value: 'platform_default',
      },
      ip: input.ip,
    });

    return {
      overrides: next,
      feature: resolveWorkspaceFeature(definition, next, this.platformFlags),
    };
  }

  async resetOverrides(input: {
    workspaceId: string;
    userId: string;
    ip?: string | null;
  }): Promise<Record<string, boolean>> {
    const current = await this.getOverrides(input.workspaceId);
    await persistOverrides(input.workspaceId, {});

    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: 'workspace_feature_overrides_reset',
      detail: {
        feature: null,
        old_value: current,
        new_value: {},
      },
      ip: input.ip,
    });

    return {};
  }
}

export const workspaceFeatureService = new WorkspaceFeatureService();

export function assertWorkspaceFeatureKey(value: string): WorkspaceFeatureKey {
  if (!isWorkspaceFeatureKey(value)) {
    throw new Error(`Unknown feature: ${value}`);
  }
  return value;
}
