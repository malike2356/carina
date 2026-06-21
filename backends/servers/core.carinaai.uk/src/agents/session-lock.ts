export class SessionWriteLock {
  private locks = new Map<string, { holder: string; acquiredAt: number; timeout: ReturnType<typeof setTimeout> }>();
  private pendingResolvers = new Map<string, Array<(granted: boolean) => void>>();

  constructor(private timeoutMs = 60_000) {}

  async acquire(sessionId: string, holderId: string): Promise<boolean> {
    const existing = this.locks.get(sessionId);
    if (existing) {
      if (existing.holder === holderId) return true;
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          this.cleanupWaiter(sessionId, resolve);
          resolve(false);
        }, this.timeoutMs);
        const waiters = this.pendingResolvers.get(sessionId) ?? [];
        waiters.push((granted) => {
          clearTimeout(timeout);
          resolve(granted);
        });
        this.pendingResolvers.set(sessionId, waiters);
      });
    }

    this.locks.set(sessionId, {
      holder: holderId,
      acquiredAt: Date.now(),
      timeout: setTimeout(() => this.forceRelease(sessionId), this.timeoutMs),
    });
    return true;
  }

  release(sessionId: string, holderId: string): void {
    const lock = this.locks.get(sessionId);
    if (!lock || lock.holder !== holderId) return;
    clearTimeout(lock.timeout);
    this.locks.delete(sessionId);
    const waiters = this.pendingResolvers.get(sessionId);
    if (waiters?.length) {
      const next = waiters.shift()!;
      this.locks.set(sessionId, {
        holder: holderId,
        acquiredAt: Date.now(),
        timeout: setTimeout(() => this.forceRelease(sessionId), this.timeoutMs),
      });
      next(true);
      if (waiters.length === 0) this.pendingResolvers.delete(sessionId);
    }
  }

  forceRelease(sessionId: string): void {
    const lock = this.locks.get(sessionId);
    if (lock) clearTimeout(lock.timeout);
    this.locks.delete(sessionId);
    const waiters = this.pendingResolvers.get(sessionId);
    if (waiters) {
      for (const resolve of waiters) resolve(true);
      this.pendingResolvers.delete(sessionId);
    }
  }

  isLocked(sessionId: string): boolean {
    return this.locks.has(sessionId);
  }

  private cleanupWaiter(sessionId: string, resolve: (granted: boolean) => void): void {
    const waiters = this.pendingResolvers.get(sessionId);
    if (!waiters) return;
    const idx = waiters.findIndex((fn) => fn === resolve);
    if (idx >= 0) waiters.splice(idx, 1);
    if (waiters.length === 0) this.pendingResolvers.delete(sessionId);
  }
}
