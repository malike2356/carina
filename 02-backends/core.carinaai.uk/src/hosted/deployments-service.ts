import { randomUUID } from 'crypto';
import { queryForOrg } from './scoped-query.js';
import { writeProductAudit } from './product-audit.js';

export interface PlatformEnvironment {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  status: string;
  apiBaseUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformDeployment {
  id: string;
  orgId: string;
  name: string;
  environmentId: string | null;
  status: string;
  model: string;
  provider: string;
  version: string;
  deployedAt: Date | null;
  metadataJson: Record<string, unknown>;
  createdAt: Date;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'item';
}

function mapEnvironment(row: Record<string, unknown>): PlatformEnvironment {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    name: String(row.name),
    slug: String(row.slug),
    status: String(row.status),
    apiBaseUrl: row.api_base_url != null ? String(row.api_base_url) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapDeployment(row: Record<string, unknown>): PlatformDeployment {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    name: String(row.name),
    environmentId: row.environment_id != null ? String(row.environment_id) : null,
    status: String(row.status),
    model: String(row.model),
    provider: String(row.provider),
    version: String(row.version),
    deployedAt: row.deployed_at as Date | null,
    metadataJson: (row.metadata_json ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as Date,
  };
}

export async function listEnvironmentsForOrg(orgId: string): Promise<PlatformEnvironment[]> {
  const result = await queryForOrg(
    orgId,
    `SELECT id, org_id, name, slug, status, api_base_url, notes, created_at, updated_at
     FROM ai_platform_environments
     WHERE org_id = $1
     ORDER BY name`,
  );
  return result.rows.map(mapEnvironment);
}

export async function createEnvironmentForOrg(
  orgId: string,
  input: { name: string; slug?: string; apiBaseUrl?: string; notes?: string },
  actorUserId: string,
): Promise<PlatformEnvironment> {
  const id = randomUUID();
  const slug = input.slug?.trim() || slugify(input.name);
  await queryForOrg(
    orgId,
    `INSERT INTO ai_platform_environments (id, org_id, name, slug, api_base_url, notes, status)
     VALUES ($2, $1, $3, $4, $5, $6, 'active')`,
    [id, input.name, slug, input.apiBaseUrl ?? null, input.notes ?? null],
  );

  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'environment.created',
    resourceType: 'environment',
    resourceId: id,
    details: { name: input.name, slug },
  });

  const envs = await listEnvironmentsForOrg(orgId);
  return envs.find((env) => env.id === id)!;
}

export async function listDeploymentsForOrg(orgId: string): Promise<PlatformDeployment[]> {
  const result = await queryForOrg(
    orgId,
    `SELECT id, org_id, name, environment_id, status, model, provider, version,
            deployed_at, metadata_json, created_at
     FROM ai_platform_deployments
     WHERE org_id = $1
     ORDER BY deployed_at DESC NULLS LAST, created_at DESC`,
  );
  return result.rows.map(mapDeployment);
}

export async function createDeploymentForOrg(
  orgId: string,
  input: {
    name: string;
    environmentId?: string;
    model?: string;
    provider?: string;
    version?: string;
    notes?: string;
  },
  actorUserId: string,
): Promise<PlatformDeployment> {
  const id = randomUUID();
  const metadata = input.notes ? { notes: input.notes } : {};
  await queryForOrg(
    orgId,
    `INSERT INTO ai_platform_deployments
      (id, org_id, name, environment_id, model, provider, version, status, metadata_json)
     VALUES ($2, $1, $3, $4, $5, $6, $7, 'pending', $8::jsonb)`,
    [
      id,
      input.name,
      input.environmentId ?? null,
      input.model ?? '',
      input.provider ?? '',
      input.version ?? '1.0.0',
      JSON.stringify(metadata),
    ],
  );

  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'deployment.created',
    resourceType: 'deployment',
    resourceId: id,
    details: {
      name: input.name,
      environmentId: input.environmentId ?? null,
    },
  });

  const deployments = await listDeploymentsForOrg(orgId);
  return deployments.find((dep) => dep.id === id)!;
}
