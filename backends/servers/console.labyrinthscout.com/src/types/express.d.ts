import type { ScoutAuth } from '../middleware/auth.js';

declare module 'express-serve-static-core' {
  interface Request {
    scoutAuth?: ScoutAuth;
  }
}
