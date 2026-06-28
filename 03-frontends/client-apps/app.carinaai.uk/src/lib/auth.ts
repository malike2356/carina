import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { provisionCoreAivaTrial } from './aiva-provision';
import { sendPasswordResetViaCore } from './password-reset-email';
import { ensureWorkspaceForUser } from './workspace';
import {
  aivaAppOrigin,
  aivaProductHosts,
  cloudAppHost,
  hasExternalAivaProductDomain,
} from './product-surface';

const appUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4100';
const cloudOrigin = `https://${cloudAppHost()}`;
const aivaOrigins = aivaProductHosts().map((host) => `https://${host}`);

function resolveCrossSubDomainCookies(): { enabled: true; domain: string } | { enabled: false } {
  const explicit = process.env.BETTER_AUTH_COOKIE_DOMAIN?.trim();
  if (explicit === 'false' || explicit === '0') return { enabled: false };
  if (explicit) return { enabled: true, domain: explicit.replace(/^\./, '') };
  if (hasExternalAivaProductDomain()) return { enabled: false };
  return { enabled: true, domain: 'carinaai.uk' };
}

export const auth = betterAuth({
  baseURL: {
    allowedHosts: [
      cloudAppHost(),
      ...aivaProductHosts(),
      'localhost',
      '127.0.0.1',
    ],
    fallback: appUrl.replace(/\/$/, ''),
    protocol: 'https',
  },
  trustedOrigins: [appUrl, cloudOrigin, aivaAppOrigin(), ...aivaOrigins, 'http://localhost:4100'].filter(
    (origin, index, list) => list.indexOf(origin) === index,
  ),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 10,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetViaCore({
        email: user.email,
        resetUrl: url,
        expiresInMinutes: 60,
      });
    },
  },
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {},
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    trustedProxyHeaders: true,
    crossSubDomainCookies: resolveCrossSubDomainCookies(),
  },
  user: {
    additionalFields: {
      termsAcceptedAt: {
        type: 'date',
        required: false,
        fieldName: 'terms_accepted_at',
      },
      termsVersion: {
        type: 'string',
        required: false,
        fieldName: 'terms_version',
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const workspace = await ensureWorkspaceForUser(user.id, user.name ?? user.email);
          void provisionCoreAivaTrial(workspace.id, {
            email: user.email,
            name: user.name ?? user.email.split('@')[0],
          });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
