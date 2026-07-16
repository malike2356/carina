import { pool } from '../../memory/db.js';

export interface SocialSettings {
  socialRequireApproval: boolean;
  socialAutoReplyEnabled: boolean;
  socialAutoReplyAllowlist: string[];
}

const DEFAULT_SETTINGS: SocialSettings = {
  socialRequireApproval: true,
  socialAutoReplyEnabled: false,
  socialAutoReplyAllowlist: ['thanks', 'thank you', 'ok'],
};

function rowToSettings(row: Record<string, unknown> | undefined): SocialSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  const allowlist = row.social_auto_reply_allowlist;
  return {
    socialRequireApproval: row.social_require_approval !== false,
    socialAutoReplyEnabled: Boolean(row.social_auto_reply_enabled),
    socialAutoReplyAllowlist: Array.isArray(allowlist)
      ? allowlist.map(String)
      : DEFAULT_SETTINGS.socialAutoReplyAllowlist,
  };
}

export async function getSocialSettings(workspaceId: string): Promise<SocialSettings> {
  const result = await pool.query(
    'SELECT * FROM aiva_social_settings WHERE workspace_id = $1',
    [workspaceId],
  );
  return rowToSettings(result.rows[0] as Record<string, unknown> | undefined);
}

export async function upsertSocialSettings(
  workspaceId: string,
  input: Partial<SocialSettings>,
): Promise<SocialSettings> {
  const current = await getSocialSettings(workspaceId);
  const next: SocialSettings = {
    socialRequireApproval: input.socialRequireApproval ?? current.socialRequireApproval,
    socialAutoReplyEnabled: input.socialAutoReplyEnabled ?? current.socialAutoReplyEnabled,
    socialAutoReplyAllowlist: input.socialAutoReplyAllowlist ?? current.socialAutoReplyAllowlist,
  };
  await pool.query(
    `INSERT INTO aiva_social_settings (
       workspace_id, social_require_approval, social_auto_reply_enabled,
       social_auto_reply_allowlist, updated_at
     ) VALUES ($1, $2, $3, $4::jsonb, NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET
       social_require_approval = $2,
       social_auto_reply_enabled = $3,
       social_auto_reply_allowlist = $4::jsonb,
       updated_at = NOW()`,
    [
      workspaceId,
      next.socialRequireApproval,
      next.socialAutoReplyEnabled,
      JSON.stringify(next.socialAutoReplyAllowlist),
    ],
  );
  return next;
}
