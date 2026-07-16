import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSsoProviders } from '@/db/schema';
import type { WorkspaceSsoProvider, SsoProviderType } from '@/db/schema';

const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com',
  'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
  'zoho.com', 'yandex.com', 'yandex.ru', 'mail.com', 'gmx.com',
  'gmx.net', 'fastmail.com', 'tutanota.com', 'tuta.io', 'hey.com',
]);

export function isPublicDomain(domain: string): boolean {
  return PUBLIC_DOMAINS.has(domain.toLowerCase().trim());
}

export function normalizeDomain(domain: string): string {
  return domain.toLowerCase().trim().replace(/^@/, '');
}

function vaultKey(): Buffer {
  const secret = process.env.VAULT_SECRET ?? process.env.BETTER_AUTH_SECRET ?? '';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plaintext: string): { enc: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptSecret(enc: string, iv: string, tag: string): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return decipher.update(enc, 'base64', 'utf8') + decipher.final('utf8');
}

export async function listSsoProviders(workspaceId: string): Promise<Omit<WorkspaceSsoProvider, 'clientSecretEnc' | 'clientSecretIv' | 'clientSecretTag' | 'samlCertificateEnc' | 'samlCertificateIv' | 'samlCertificateTag'>[]> {
  const rows = await db
    .select()
    .from(workspaceSsoProviders)
    .where(eq(workspaceSsoProviders.workspaceId, workspaceId))
    .orderBy(workspaceSsoProviders.createdAt);

  return rows.map(({ clientSecretEnc, clientSecretIv, clientSecretTag, samlCertificateEnc, samlCertificateIv, samlCertificateTag, ...rest }) => rest);
}

export interface CreateOidcProviderInput {
  workspaceId: string;
  displayName: string;
  domain: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  defaultRole?: string;
  enabled?: boolean;
  createdByUserId?: string;
}

export async function createOidcProvider(input: CreateOidcProviderInput): Promise<WorkspaceSsoProvider> {
  const domain = normalizeDomain(input.domain);
  const { enc, iv, tag } = encryptSecret(input.clientSecret);

  const [row] = await db
    .insert(workspaceSsoProviders)
    .values({
      workspaceId: input.workspaceId,
      providerType: 'oidc',
      displayName: input.displayName,
      domain,
      issuer: input.issuer,
      clientId: input.clientId,
      clientSecretEnc: enc,
      clientSecretIv: iv,
      clientSecretTag: tag,
      defaultRole: input.defaultRole ?? 'member',
      enabled: input.enabled ?? true,
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();
  return row;
}

export interface CreateSamlProviderInput {
  workspaceId: string;
  displayName: string;
  domain: string;
  entityId: string;
  ssoUrl: string;
  certificate: string;
  defaultRole?: string;
  enabled?: boolean;
  createdByUserId?: string;
}

export async function createSamlProvider(input: CreateSamlProviderInput): Promise<WorkspaceSsoProvider> {
  const domain = normalizeDomain(input.domain);
  const { enc, iv, tag } = encryptSecret(input.certificate);

  const [row] = await db
    .insert(workspaceSsoProviders)
    .values({
      workspaceId: input.workspaceId,
      providerType: 'saml',
      displayName: input.displayName,
      domain,
      samlEntityId: input.entityId,
      samlSsoUrl: input.ssoUrl,
      samlCertificateEnc: enc,
      samlCertificateIv: iv,
      samlCertificateTag: tag,
      defaultRole: input.defaultRole ?? 'member',
      enabled: input.enabled ?? true,
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();
  return row;
}

export interface UpdateProviderInput {
  displayName?: string;
  enabled?: boolean;
  defaultRole?: string;
  ssoRequired?: boolean;
  clientId?: string;
  clientSecret?: string;
  issuer?: string;
  samlEntityId?: string;
  samlSsoUrl?: string;
  samlCertificate?: string;
}

export async function updateSsoProvider(
  id: string,
  workspaceId: string,
  input: UpdateProviderInput,
): Promise<WorkspaceSsoProvider | null> {
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (input.displayName !== undefined) patch.displayName = input.displayName;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.defaultRole !== undefined) patch.defaultRole = input.defaultRole;
  if (input.ssoRequired !== undefined) patch.ssoRequired = input.ssoRequired;
  if (input.clientId !== undefined) patch.clientId = input.clientId;
  if (input.issuer !== undefined) patch.issuer = input.issuer;
  if (input.samlEntityId !== undefined) patch.samlEntityId = input.samlEntityId;
  if (input.samlSsoUrl !== undefined) patch.samlSsoUrl = input.samlSsoUrl;

  if (input.clientSecret) {
    const { enc, iv, tag } = encryptSecret(input.clientSecret);
    patch.clientSecretEnc = enc;
    patch.clientSecretIv = iv;
    patch.clientSecretTag = tag;
  }
  if (input.samlCertificate) {
    const { enc, iv, tag } = encryptSecret(input.samlCertificate);
    patch.samlCertificateEnc = enc;
    patch.samlCertificateIv = iv;
    patch.samlCertificateTag = tag;
  }

  const [row] = await db
    .update(workspaceSsoProviders)
    .set(patch)
    .where(and(eq(workspaceSsoProviders.id, id), eq(workspaceSsoProviders.workspaceId, workspaceId)))
    .returning();
  return row ?? null;
}

export async function deleteSsoProvider(id: string, workspaceId: string): Promise<boolean> {
  const result = await db
    .delete(workspaceSsoProviders)
    .where(and(eq(workspaceSsoProviders.id, id), eq(workspaceSsoProviders.workspaceId, workspaceId)))
    .returning({ id: workspaceSsoProviders.id });
  return result.length > 0;
}

export async function resolveSsoProviderByDomain(domain: string): Promise<WorkspaceSsoProvider | null> {
  const normalized = normalizeDomain(domain);
  const [row] = await db
    .select()
    .from(workspaceSsoProviders)
    .where(and(eq(workspaceSsoProviders.domain, normalized), eq(workspaceSsoProviders.enabled, true)))
    .limit(1);
  return row ?? null;
}

export function getDecryptedClientSecret(provider: WorkspaceSsoProvider): string | null {
  if (!provider.clientSecretEnc || !provider.clientSecretIv || !provider.clientSecretTag) return null;
  return decryptSecret(provider.clientSecretEnc, provider.clientSecretIv, provider.clientSecretTag);
}

export function getDecryptedSamlCertificate(provider: WorkspaceSsoProvider): string | null {
  if (!provider.samlCertificateEnc || !provider.samlCertificateIv || !provider.samlCertificateTag) return null;
  return decryptSecret(provider.samlCertificateEnc, provider.samlCertificateIv, provider.samlCertificateTag);
}
