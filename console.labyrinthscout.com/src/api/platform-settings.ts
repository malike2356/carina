import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { requireScoutPro } from '../middleware/plan-gate.js';
import { logAdminAction } from '../audit/audit-logger.js';
import {
  loadPlatformSecuritySettings,
  savePlatformSecuritySettings,
} from '../lib/platform-settings.js';

export const platformSettingsRouter: IRouter = Router();

platformSettingsRouter.get('/', requireScoutPro, async (_req: Request, res: Response): Promise<void> => {
  try {
    const security = await loadPlatformSecuritySettings();
    res.json({
      settings: {
        egress_filter_enabled: security.egress_filter_enabled,
        egress_filter_source: security.egress_filter_source,
        sandbox_enabled: security.sandbox_enabled,
        sandbox_source: security.sandbox_source,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

platformSettingsRouter.put('/', requireScoutPro, async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body.egress_filter_enabled !== 'boolean' || typeof body.sandbox_enabled !== 'boolean') {
    res.status(400).json({ error: 'egress_filter_enabled and sandbox_enabled must be boolean' });
    return;
  }

  try {
    const before = await loadPlatformSecuritySettings();
    const settings = await savePlatformSecuritySettings({
      egress_filter_enabled: body.egress_filter_enabled,
      sandbox_enabled: body.sandbox_enabled,
    });

    await logAdminAction({
      tenant_id: 'system',
      action: 'platform_security_settings_updated',
      detail: {
        updated_by: 'operator',
        before,
        after: settings,
      },
      severity: 'warning',
    });

    res.json({ ok: true, settings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
