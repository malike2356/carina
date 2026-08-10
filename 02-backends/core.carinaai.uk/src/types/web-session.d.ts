import 'express-session';
import type { OrgRole } from '../hosted/org-types.js';
import type { OrgContext } from '../hosted/org-context.js';

declare module 'express-session' {
  interface SessionData {
    webAuthed?: boolean;
    webPendingTotp?: boolean;
    hostedAccountId?: string;
    hostedOrgId?: string;
    hostedOrgRole?: OrgRole;
    /** Snapshot of the user's session-version counter at login time; used to
     *  force-revoke sessions when the password changes (see auth-hardening.ts). */
    hostedSessionVersion?: number;
    /** Server-side auth session id from shared/sessions registry. */
    authSessionId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      hostedUser?: {
        id: string;
        email: string;
        tier: string;
      };
      orgContext?: OrgContext;
    }
  }
}

export {};
