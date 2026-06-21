import type { Request } from 'express';
import type { ScoutAuth } from '../middleware/auth.js';

export type RequestWithScoutAuth = Request & {
  scoutAuth?: ScoutAuth;
};
