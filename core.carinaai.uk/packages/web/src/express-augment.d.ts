import 'express-session';

declare module 'express-session' {
  interface SessionData {
    webAuthed?: boolean;
    hostedAccountId?: string;
    hostedOrgId?: string;
    hostedOrgRole?: string;
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
    }
  }
}

export {};
