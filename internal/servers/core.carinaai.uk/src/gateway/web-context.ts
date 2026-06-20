import express, { type Express, type Request, type Response } from 'express';
import { config } from '../config/index.js';
import { llm } from '../brain/llm.js';
import { getUserProfile } from '../api/hosted-auth.js';
import { scoutServiceUrl } from '../billing/tenant-scout.js';
import { resolveProductMode, resolveProductSurface } from '../product/surface.js';
import { getActivePackNames } from '../skills/index.js';
import { activateProfile, getActiveProfileName, listProfiles } from '../profiles/manager.js';
import { describeNamedProfileScope } from '../profiles/scope.js';
import type { ProductMode } from '../product/types.js';

export type WebContextResponse = {
  mode: ProductMode;
  surface: {
    productName: string;
    workspaceName: string;
    titleSuffix: string;
    loginPath: string;
    defaultLanding: string;
    primaryNav: Array<{ id: string; href: string; label: string }>;
    accountNav: Array<{ id: string; href: string; label: string }>;
    instanceNav: Array<{ id: string; href: string; label: string }>;
  };
  activeProfile: string;
  profiles?: string[];
  profileScope?: {
    carinaHome: string;
    operatorSession: string;
    sessionPrefix: string;
  };
  activeSkillPack: string | null;
  activeSkillPacks: string[];
  provider: string;
  providers: string[];
  scoutAvailable: boolean;
  security?: Awaited<ReturnType<typeof import('../security/trust-state.js').buildSecurityTrustState>>;
  hosted?: {
    user: {
      id: string;
      email: string;
      tier: string;
      scoutActive: boolean;
      org?: { id: string; name: string; plan: string; role: string } | null;
    } | null;
  };
};

export async function buildWebContext(req: Request): Promise<WebContextResponse> {
  let activeProvider = '';
  try {
    activeProvider = llm.current().name;
  } catch {
    activeProvider = '';
  }

  const packs = getActivePackNames();
  const activeSkillPack = config.carina.activePack || packs[0] || null;
  const scoutAvailable = Boolean(config.labyrinth.apiKey && scoutServiceUrl());
  const surface = resolveProductSurface(req.hostname);
  const mode = resolveProductMode(req.hostname);
  let security: WebContextResponse['security'];
  try {
    const { buildSecurityTrustState } = await import('../security/trust-state.js');
    security = await buildSecurityTrustState();
  } catch {
    security = undefined;
  }
  const activeProfile = process.env.CARINA_PROFILE ?? getActiveProfileName() ?? 'default';
  const profiles = mode === 'private' ? await listProfiles().catch(() => []) : [];
  let profileScope: WebContextResponse['profileScope'];
  try {
    const scope = describeNamedProfileScope(activeProfile, getActiveProfileName());
    profileScope = {
      carinaHome: scope.scoped.carinaHome,
      operatorSession: scope.runtime.operatorSession,
      sessionPrefix: scope.runtime.sessionPrefix,
    };
  } catch {
    profileScope = undefined;
  }

  const body: WebContextResponse = {
    mode,
    surface: {
      productName: surface.branding.productName,
      workspaceName: surface.branding.workspaceName,
      titleSuffix: surface.branding.titleSuffix,
      loginPath: surface.branding.loginPath,
      defaultLanding: surface.branding.defaultLanding,
      primaryNav: surface.shell.primaryNav.map((item) => ({
        id: item.id,
        href: item.href,
        label: item.label,
      })),
      accountNav: surface.shell.accountNav.map((item) => ({
        id: item.id,
        href: item.href,
        label: item.label,
      })),
      instanceNav: surface.shell.instanceNav.map((item) => ({
        id: item.id,
        href: item.href,
        label: item.label,
      })),
    },
    activeProfile,
    profiles,
    profileScope,
    activeSkillPack,
    activeSkillPacks: packs,
    provider: activeProvider,
    providers: llm.list(),
    scoutAvailable,
    security,
  };

  if (mode === 'hosted') {
    if (req.hostedUser) {
      const profile = await getUserProfile(req.hostedUser.id);
      const scout = await import('../billing/tenant-scout.js').then((m) =>
        m.getTenantScoutCredentials(req.hostedUser!.id, req.hostedUser!.email),
      );
      body.hosted = {
        user: {
          id: req.hostedUser.id,
          email: req.hostedUser.email,
          tier: req.hostedUser.tier,
          scoutActive: Boolean(scout),
          org: profile?.org ?? null,
        },
      };
    } else {
      body.hosted = { user: null };
    }
  }

  return body;
}

async function hydrateHostedUser(req: Request): Promise<void> {
  if (resolveProductMode(req.hostname) !== 'hosted' || req.hostedUser || !req.session?.hostedAccountId) {
    return;
  }
  const profile = await getUserProfile(req.session.hostedAccountId);
  if (!profile) return;
  req.hostedUser = {
    id: req.session.hostedAccountId,
    email: profile.email,
    tier: profile.tier,
  };
}

export function mountWebContextRoute(app: Express): void {
  app.get('/api/web/context', async (req: Request, res: Response) => {
    await hydrateHostedUser(req);
    res.json(await buildWebContext(req));
  });

  app.post('/api/web/context/profile', express.json(), async (req: Request, res: Response) => {
    await hydrateHostedUser(req);
    if (resolveProductMode(req.hostname) !== 'private') {
      res.status(403).json({ error: 'Profile switching is only available in the private shell.' });
      return;
    }

    const requested = String(req.body?.profile ?? '').trim();
    if (!requested) {
      res.status(400).json({ error: 'profile is required' });
      return;
    }

    try {
      const profile = activateProfile(requested);
      res.json({
        ok: true,
        activeProfile: profile.name,
        profileScope: {
          carinaHome: profile.dir,
          operatorSession: profile.name,
          sessionPrefix: profile.name === 'default' ? '' : `${profile.name}:`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to switch profile';
      res.status(400).json({ error: message });
    }
  });
}
