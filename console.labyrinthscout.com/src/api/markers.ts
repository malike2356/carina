import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { movingTarget } from '../deception/moving-target.js';
import { DEFAULT_ROTATION_CONFIG } from '../deception/deception-config.js';

export const markersRouter: IRouter = Router();

markersRouter.get('/markers', (_req: Request, res: Response) => {
  const marker = movingTarget.getCurrentMarker();
  const rotatesAt = new Date(
    marker.rotatedAt.getTime() + DEFAULT_ROTATION_CONFIG.marker_interval_minutes * 60 * 1000,
  );

  res.json({
    current: marker.value,
    rotates_at: rotatesAt.toISOString(),
  });
});
