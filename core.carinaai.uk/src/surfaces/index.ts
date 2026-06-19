import type { Request } from 'express';
import { pairedDeviceFromRequest } from '../infrastructure/control-auth.js';

/** Client surfaces Carina ships today (not full channel adapters). */
export const CLIENT_SURFACES = ['cli', 'tui', 'web', 'mobile', 'acp', 'desktop'] as const;

export type ClientSurface = (typeof CLIENT_SURFACES)[number];

export type SurfaceSessionInput = {
  deviceId?: string;
  profile?: string;
  clientSessionId?: string;
  hostedUserId?: string;
};

export function operatorSessionEnabled(): boolean {
  return process.env.CARINA_OPERATOR_SESSION === 'true';
}

/**
 * Redis/memory map key for gateway session allocation.
 * Operator mode shares one session across all surfaces for the same agent.
 */
export function buildSurfaceSessionMapKey(
  agentId: string,
  surface: string,
  externalUserId: string,
): string {
  if (operatorSessionEnabled()) {
    return `carina:agent:${agentId}:gateway:operator`;
  }
  return `carina:agent:${agentId}:gateway:${surface}:${externalUserId}`;
}

export function resolveSurfaceExternalUserId(
  surface: ClientSurface,
  input: SurfaceSessionInput = {},
): string {
  if (surface === 'mobile' && input.deviceId) {
    return `mobile:${input.deviceId}`;
  }
  if (surface === 'cli') {
    return input.profile?.trim() || 'local';
  }
  if (surface === 'tui') {
    return input.profile?.trim() || 'tui-operator';
  }
  if (surface === 'web') {
    if (input.hostedUserId) {
      const client = input.clientSessionId?.trim() || 'default';
      return `hosted:${input.hostedUserId}:${client}`;
    }
    return input.clientSessionId?.trim() || 'default';
  }
  if (surface === 'acp') {
    return input.clientSessionId?.trim() || 'acp-default';
  }
  if (surface === 'desktop') {
    return input.profile?.trim() || 'desktop-operator';
  }
  if (input.hostedUserId) {
    const client = input.clientSessionId?.trim() || 'default';
    return `hosted:${input.hostedUserId}:${client}`;
  }
  return input.clientSessionId?.trim() || 'default';
}

/** Resolve web/mobile external user id from an HTTP request. */
export function resolveRequestExternalUserId(req: Request): string {
  if (req.headers) {
    const device = pairedDeviceFromRequest(req);
    if (device) {
      return resolveSurfaceExternalUserId('mobile', { deviceId: device.id });
    }
  }

  const clientSessionId = String(req.body?.sessionId ?? req.query?.sessionId ?? 'default');
  if (req.hostedUser) {
    return resolveSurfaceExternalUserId('web', {
      hostedUserId: req.hostedUser.id,
      clientSessionId,
    });
  }
  return resolveSurfaceExternalUserId('web', { clientSessionId });
}

export type SurfaceAdoptionDecision = {
  surface: string;
  adopt: 'now' | 'later' | 'defer';
  rationale: string;
  entrypoint: string;
};

/** Written product decision for prompt 18 (surfaces to adopt now vs later). */
export const SURFACE_ADOPTION_DECISIONS: SurfaceAdoptionDecision[] = [
  {
    surface: 'CLI (`carina`)',
    adopt: 'now',
    rationale: 'Primary operator surface; gateway-backed sessions and first-run onboarding already ship.',
    entrypoint: 'npm install -g carina-agent && carina',
  },
  {
    surface: 'Operator TUI (`carina tui`)',
    adopt: 'now',
    rationale: 'Direct terminal control for sessions, tasks, processes, and chat without a browser.',
    entrypoint: 'carina tui  (carina tui --simple when no full TTY)',
  },
  {
    surface: 'Web workspace (PWA)',
    adopt: 'now',
    rationale: 'Full workspace UI with chat, packs, memory, and mobile-responsive chrome.',
    entrypoint: 'carina web / Docker standalone on :3000',
  },
  {
    surface: 'Mobile companion (paired PWA)',
    adopt: 'now',
    rationale: 'Lightweight paired chat on phone with voice input; reuses gateway sessions via device token.',
    entrypoint: 'Desktop: carina pair  |  Phone: /mobile?token=...',
  },
  {
    surface: 'Native desktop (Electron/Tauri/macOS)',
    adopt: 'defer',
    rationale: 'High build cost; web PWA + CLI/TUI cover daily use until demand justifies a native shell.',
    entrypoint: 'Revisit when offline-first desktop integrations are required',
  },
  {
    surface: 'Native mobile apps (iOS/Android)',
    adopt: 'later',
    rationale: 'Pairing API and /mobile PWA are sufficient for v1; native apps when push/sensors need deep OS hooks.',
    entrypoint: 'carina pair + /mobile now; App Store path tracked separately',
  },
];
