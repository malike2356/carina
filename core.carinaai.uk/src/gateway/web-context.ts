import type { Express, Request, Response } from 'express';
import { config } from '../config/index.js';
import { llm } from '../brain/llm.js';
import { scoutServiceUrl } from '../billing/tenant-scout.js';
import { isHostedRequest } from './hosted-domain.js';

export type WebContextResponse = {
  mode: 'operator' | 'hosted';
  activeSkillPack: string | null;
  activeSkillPacks: string[];
  provider: string;
  providers: string[];
  scoutAvailable: boolean;
  hosted?: {
    user: {
      id: string;
      email: string;
      tier: string;
      scoutActive: boolean;
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

  const packs = config.carina.activePacks;
  const activeSkillPack = config.carina.activePack || packs[0] || null;
  const scoutAvailable = Boolean(config.labyrinth.apiKey && scoutServiceUrl());
  const mode: WebContextResponse['mode'] = isHostedRequest(req.hostname) ? 'hosted' : 'operator';

  const body: WebContextResponse = {
    mode,
    activeSkillPack,
    activeSkillPacks: packs,
    provider: activeProvider,
    providers: llm.list(),
    scoutAvailable,
  };

  if (mode === 'hosted') {
    if (req.hostedUser) {
      const scout = await import('../billing/tenant-scout.js').then((m) =>
        m.getTenantScoutCredentials(req.hostedUser!.id, req.hostedUser!.email),
      );
      body.hosted = {
        user: {
          id: req.hostedUser.id,
          email: req.hostedUser.email,
          tier: req.hostedUser.tier,
          scoutActive: Boolean(scout),
        },
      };
    } else {
      body.hosted = { user: null };
    }
  }

  return body;
}

export function mountWebContextRoute(app: Express): void {
  app.get('/api/web/context', async (req: Request, res: Response) => {
    res.json(await buildWebContext(req));
  });
}
