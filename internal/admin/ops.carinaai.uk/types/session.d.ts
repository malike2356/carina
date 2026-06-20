import 'express-session';
import type { ImpersonationSession } from '../lib/support-impersonation.js';

declare module 'express-session' {
  interface SessionData {
    admin?: boolean;
    impersonation?: ImpersonationSession;
  }
}
