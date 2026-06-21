import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { movingTarget } from '../deception/moving-target.js';
import { DEFAULT_ROTATION_CONFIG } from '../deception/deception-config.js';
import { getSystemPromptAugmentation } from '../security/prompt-guard.js';

export const deceptionRouter: IRouter = Router();

deceptionRouter.get('/augmentation', async (req: Request, res: Response): Promise<void> => {
  const instanceId =
    typeof req.query.instance_id === 'string' ? req.query.instance_id.trim() : '';
  if (!instanceId) {
    res.json({ augmentation: null, marker: null, rotatesAt: null });
    return;
  }

  try {
    const marker = movingTarget.getCurrentMarker();
    const previous = movingTarget.getPreviousMarkers();
    const rotatesAt = new Date(
      marker.rotatedAt.getTime() + DEFAULT_ROTATION_CONFIG.marker_interval_minutes * 60 * 1000,
    );

    const augmentation = await getSystemPromptAugmentation(instanceId);

    res.json({
      instance_id: instanceId,
      augmentation,
      current_marker: marker.value,
      previous_markers: previous.map((m) => ({
        value: m.value,
        rotated_at: m.rotatedAt.toISOString(),
      })),
      rotates_at: rotatesAt.toISOString(),
    });
  } catch (err) {
    console.error('[deception] augmentation error:', err);
    res.status(500).json({ error: 'Failed to build deception augmentation' });
  }
});
