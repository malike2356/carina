/**
 * Carina hosted auth session runtime (server-side session registry).
 */
import { createSessionManager, resolveSessionConfig, revokeOnPasswordChange, revokeOnRoleChange, revokeSession, revokeAllSessions, getRevocationLog, type SessionManager } from './index.js';
import { formatNewLoginMessage } from './device-info.js';

let manager: SessionManager | null = null;
const pendingBanners = new Map<string, string>();

export function getCarinaSessionManager(): SessionManager {
  if (!manager) {
    manager = createSessionManager({
      config: resolveSessionConfig({
        project: 'carina',
        tier: process.env.CARINA_SESSION_TIER || 'business',
      }),
      onNewDeviceLogin: (event, message) => {
        pendingBanners.set(event.userId, message);
        console.info('[session] new device login', {
          userId: event.userId,
          sessionId: event.sessionId,
          message,
        });
        void import('./notify.js').then((m) =>
          m.notifyNewDeviceLoginEmail({
            toEmail: '',
            message,
            userId: event.userId,
          }),
        );
      },
    });
  }
  return manager;
}

export function resetCarinaSessionManagerForTests(): void {
  manager = null;
  pendingBanners.clear();
}

export function consumeNewLoginBanner(userId: string): string | null {
  const msg = pendingBanners.get(userId) ?? null;
  if (msg) pendingBanners.delete(userId);
  return msg;
}

export function peekNewLoginBanner(userId: string): string | null {
  return pendingBanners.get(userId) ?? null;
}

export {
  revokeOnPasswordChange,
  revokeOnRoleChange,
  revokeSession,
  revokeAllSessions,
  getRevocationLog,
  formatNewLoginMessage,
};
