import crypto from 'crypto';
import { credentialStore } from '../../credentials/credential-store.js';
import { logSelfModEvent } from '../../security/self-mod-logger.js';

export const TOOL_GEN_SECRET_KEY = 'TOOL_GEN_SECRET';

const AUTH_WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000;
const MIN_PASSPHRASE_LENGTH = 12;

interface AuthSession {
  authenticated: boolean;
  authenticatedAt: number;
  purpose: 'generate' | 'persist' | 'approve';
  toolName?: string;
}

interface LockoutState {
  failedAttempts: number;
  lockedUntil: number | null;
}

let currentSession: AuthSession | null = null;
let lockoutState: LockoutState = { failedAttempts: 0, lockedUntil: null };

export async function isToolGenerationEnabled(): Promise<boolean> {
  const secret = await credentialStore.get(TOOL_GEN_SECRET_KEY);
  return secret !== null && secret.length >= MIN_PASSPHRASE_LENGTH;
}

export async function setAuthorizationPassphrase(plaintext: string): Promise<{ success: boolean; error?: string }> {
  if (plaintext.length < MIN_PASSPHRASE_LENGTH) {
    return { success: false, error: `Passphrase must be ${MIN_PASSPHRASE_LENGTH}+ characters.` };
  }
  if (!/[A-Z]/.test(plaintext)) {
    return { success: false, error: 'Passphrase must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(plaintext)) {
    return { success: false, error: 'Passphrase must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(plaintext)) {
    return { success: false, error: 'Passphrase must contain at least one digit.' };
  }

  const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
  await credentialStore.set('auth-gate', TOOL_GEN_SECRET_KEY, hash);
  currentSession = null;

  return { success: true };
}

export async function rotatePassphrase(
  currentPlaintext: string,
  newPlaintext: string,
): Promise<{ success: boolean; error?: string }> {
  const verified = await verifyPassphrase(currentPlaintext);
  if (!verified) {
    return { success: false, error: 'Current passphrase is incorrect.' };
  }
  return setAuthorizationPassphrase(newPlaintext);
}

async function verifyPassphrase(plaintext: string): Promise<boolean> {
  const storedHash = await credentialStore.get(TOOL_GEN_SECRET_KEY);
  if (!storedHash) return false;

  const providedHash = crypto.createHash('sha256').update(plaintext).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(storedHash));
}

function isLockedOut(): boolean {
  if (lockoutState.lockedUntil === null) return false;
  if (Date.now() > lockoutState.lockedUntil) {
    lockoutState = { failedAttempts: 0, lockedUntil: null };
    return false;
  }
  return true;
}

function recordFailedAttempt(): void {
  lockoutState.failedAttempts++;
  if (lockoutState.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    lockoutState.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
}

function resetFailedAttempts(): void {
  lockoutState = { failedAttempts: 0, lockedUntil: null };
}

export interface AuthResult {
  authorized: boolean;
  error?: string;
  lockedOut?: boolean;
  lockedUntil?: string;
  attemptsRemaining?: number;
}

export async function authorizeGeneration(plaintext: string): Promise<AuthResult> {
  const enabled = await isToolGenerationEnabled();
  if (!enabled) {
    return {
      authorized: false,
      error: 'Tool generation is not configured. Set an authorization passphrase first.',
    };
  }

  if (isLockedOut()) {
    return {
      authorized: false,
      lockedOut: true,
      lockedUntil: new Date(lockoutState.lockedUntil!).toISOString(),
      error: `Too many failed attempts. Locked until ${new Date(lockoutState.lockedUntil!).toISOString()}.`,
    };
  }

  const verified = await verifyPassphrase(plaintext);
  if (!verified) {
    recordFailedAttempt();
    const remaining = MAX_FAILED_ATTEMPTS - lockoutState.failedAttempts;
    const nowLockedOut = isLockedOut();

    if (nowLockedOut) {
      void logSelfModEvent('TOOL_GEN_AUTH_LOCKOUT', {
        locked_until: new Date(lockoutState.lockedUntil!).toISOString(),
        failed_attempts: lockoutState.failedAttempts,
      });
    } else {
      void logSelfModEvent('TOOL_GEN_AUTH_FAILED', {
        attempts_remaining: Math.max(0, remaining),
      });
    }

    return {
      authorized: false,
      lockedOut: nowLockedOut,
      lockedUntil: nowLockedOut ? new Date(lockoutState.lockedUntil!).toISOString() : undefined,
      attemptsRemaining: Math.max(0, remaining),
      error: nowLockedOut
        ? `Too many failed attempts. Locked until ${new Date(lockoutState.lockedUntil!).toISOString()}.`
        : `Incorrect passphrase. ${Math.max(0, remaining)} attempt(s) remaining before lockout.`,
    };
  }

  resetFailedAttempts();
  currentSession = { authenticated: true, authenticatedAt: Date.now(), purpose: 'generate' };

  return { authorized: true };
}

export async function authorizePersistence(plaintext: string, toolName: string): Promise<AuthResult> {
  if (!currentSession || !currentSession.authenticated) {
    return {
      authorized: false,
      error: 'No active generation session. You must authorize tool generation first.',
    };
  }

  if (currentSession.purpose !== 'generate') {
    return {
      authorized: false,
      error: 'Current session is not for generation. Start a new tool generation request.',
    };
  }

  const elapsed = Date.now() - currentSession.authenticatedAt;
  if (elapsed > AUTH_WINDOW_MS) {
    currentSession = null;
    return {
      authorized: false,
      error: `Authorization window expired (${AUTH_WINDOW_MS / 60000} minutes). Start over.`,
    };
  }

  if (isLockedOut()) {
    return {
      authorized: false,
      lockedOut: true,
      lockedUntil: new Date(lockoutState.lockedUntil!).toISOString(),
      error: 'Too many failed attempts. Account locked.',
    };
  }

  const verified = await verifyPassphrase(plaintext);
  if (!verified) {
    recordFailedAttempt();
    currentSession = null;
    const remaining = MAX_FAILED_ATTEMPTS - lockoutState.failedAttempts;
    return {
      authorized: false,
      attemptsRemaining: Math.max(0, remaining),
      error: `Incorrect passphrase. Generation session cancelled. ${Math.max(0, remaining)} attempt(s) remaining.`,
    };
  }

  resetFailedAttempts();
  currentSession = { authenticated: true, authenticatedAt: Date.now(), purpose: 'persist', toolName };

  return { authorized: true };
}

export async function authorizeApproval(plaintext: string, toolName: string): Promise<AuthResult> {
  if (isLockedOut()) {
    return {
      authorized: false,
      lockedOut: true,
      lockedUntil: new Date(lockoutState.lockedUntil!).toISOString(),
      error: 'Too many failed attempts. Account locked.',
    };
  }

  const verified = await verifyPassphrase(plaintext);
  if (!verified) {
    recordFailedAttempt();
    const remaining = MAX_FAILED_ATTEMPTS - lockoutState.failedAttempts;
    return {
      authorized: false,
      attemptsRemaining: Math.max(0, remaining),
      error: `Incorrect passphrase. ${Math.max(0, remaining)} attempt(s) remaining.`,
    };
  }

  resetFailedAttempts();
  currentSession = { authenticated: true, authenticatedAt: Date.now(), purpose: 'approve', toolName };

  return { authorized: true };
}

export function hasActiveSession(purpose?: 'generate' | 'persist' | 'approve'): boolean {
  if (!currentSession || !currentSession.authenticated) return false;

  const elapsed = Date.now() - currentSession.authenticatedAt;
  if (elapsed > AUTH_WINDOW_MS) {
    currentSession = null;
    return false;
  }

  if (purpose && currentSession.purpose !== purpose) return false;

  return true;
}

export function clearSession(): void {
  currentSession = null;
}

export function getLockoutStatus(): { lockedOut: boolean; lockedUntil?: string; attemptsRemaining: number } {
  if (isLockedOut()) {
    return {
      lockedOut: true,
      lockedUntil: new Date(lockoutState.lockedUntil!).toISOString(),
      attemptsRemaining: 0,
    };
  }
  return {
    lockedOut: false,
    attemptsRemaining: MAX_FAILED_ATTEMPTS - lockoutState.failedAttempts,
  };
}
