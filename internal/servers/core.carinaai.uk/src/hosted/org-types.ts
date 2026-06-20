export type OrgRole = 'owner' | 'admin' | 'operator' | 'auditor' | 'viewer';

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface OrgMembershipRow {
  orgId: string;
  userId: string;
  role: OrgRole;
}

export interface OrgInviteRow {
  id: string;
  orgId: string;
  email: string;
  role: Exclude<OrgRole, 'owner'>;
  expiresAt: Date;
  acceptedAt: Date | null;
}
