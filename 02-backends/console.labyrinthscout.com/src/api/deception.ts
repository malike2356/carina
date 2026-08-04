import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { movingTarget } from '../deception/moving-target.js';
import { DEFAULT_ROTATION_CONFIG } from '../deception/deception-config.js';
import { listDeceptionTraps } from '../deception/trap-list.js';
import { getSystemPromptAugmentation } from '../security/prompt-guard.js';

export const deceptionRouter: IRouter = Router();

deceptionRouter.get('/traps', async (req: Request, res: Response): Promise<void> => {
  try {
    const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id.trim() : '';
    const rawLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 200;
    const limit = Number.isFinite(rawLimit) ? rawLimit : 200;
    const traps = await listDeceptionTraps({ instanceId: instanceId || undefined, limit });
    res.json({ traps });
  } catch (err) {
    console.error('[deception] traps error:', err);
    res.status(500).json({ error: 'Failed to list deception traps' });
  }
});

deceptionRouter.get('/augmentation', async (req: Request, res: Response): Promise<void> => {
  const instanceId =
    typeof req.query.instance_id === 'string' ? req.query.instance_id.trim() : '';

  try {
    const marker = movingTarget.getCurrentMarker();
    const previous = movingTarget.getPreviousMarkers();
    const rotatesAt = new Date(
      marker.rotatedAt.getTime() + DEFAULT_ROTATION_CONFIG.marker_interval_minutes * 60 * 1000,
    );

    const augmentation = instanceId
      ? await getSystemPromptAugmentation(instanceId)
      : null;

    res.json({
      instance_id: instanceId || null,
      augmentation,
      marker: {
        id: marker.value,
        value: marker.value,
        rotated_at: marker.rotatedAt.toISOString(),
        rotatedAt: marker.rotatedAt.toISOString(),
      },
      current_marker: marker.value,
      previous_markers: previous.map((m) => ({
        id: m.value,
        value: m.value,
        rotated_at: m.rotatedAt.toISOString(),
        rotatedAt: m.rotatedAt.toISOString(),
        active_from: m.rotatedAt.toISOString(),
        retired_at: null,
      })),
      rotates_at: rotatesAt.toISOString(),
      rotatesAt: rotatesAt.toISOString(),
      rotation_interval_minutes: DEFAULT_ROTATION_CONFIG.marker_interval_minutes,
    });
  } catch (err) {
    console.error('[deception] augmentation error:', err);
    res.status(500).json({ error: 'Failed to build deception augmentation' });
  }
});
