import 'express-session';
import type { ImpersonationSession } from '../lib/support-impersonation.js';

declare module 'express-session' {
  interface SessionData {
    // Legacy single-password flag kept for backward compat during transition
    admin?: boolean;
    // Multi-user fields
    userId?: string;
    role?: 'superadmin' | 'admin' | 'viewer';
    userName?: string;
    impersonation?: ImpersonationSession;
  }
}
