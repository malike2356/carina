export interface TokenBucketSnapshot {
  capacity: number;
  tokens: number;
  refillRate: number;
  updatedAt: number;
}

export class TokenBucket {
  constructor(
    readonly capacity: number,
    readonly refillRate: number,
    private tokens = capacity,
    private updatedAt = Date.now(),
  ) {}

  static fromSnapshot(snapshot: TokenBucketSnapshot): TokenBucket {
    return new TokenBucket(
      snapshot.capacity,
      snapshot.refillRate,
      snapshot.tokens,
      snapshot.updatedAt,
    );
  }

  consume(count = 1, now = Date.now()): boolean {
    this.refill(now);
    if (this.tokens < count) return false;
    this.tokens -= count;
    return true;
  }

  remaining(now = Date.now()): number {
    this.refill(now);
    return Math.floor(this.tokens);
  }

  retryAfterSeconds(count = 1, now = Date.now()): number {
    this.refill(now);
    if (this.tokens >= count) return 0;
    return Math.ceil((count - this.tokens) / this.refillRate);
  }

  toSnapshot(): TokenBucketSnapshot {
    return {
      capacity: this.capacity,
      tokens: this.tokens,
      refillRate: this.refillRate,
      updatedAt: this.updatedAt,
    };
  }

  private refill(now: number): void {
    if (now <= this.updatedAt) return;
    const elapsedSeconds = (now - this.updatedAt) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillRate);
    this.updatedAt = now;
  }
}
