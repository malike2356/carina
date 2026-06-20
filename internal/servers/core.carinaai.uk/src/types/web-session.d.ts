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
