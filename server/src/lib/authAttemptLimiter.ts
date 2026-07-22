export interface AuthAttemptLimiterOptions {
  maxAttempts?: number;
  windowMs?: number;
  maxEntries?: number;
  now?: () => number;
}

interface AttemptEntry {
  count: number;
  expiresAt: number;
}

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 2_000;

/** A bounded process-local guard against repeated credential work for one normalized name. */
export class AuthAttemptLimiter {
  private readonly attempts = new Map<string, AttemptEntry>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  public constructor(options: AuthAttemptLimiterOptions = {}) {
    this.maxAttempts = positiveInteger(options.maxAttempts, DEFAULT_MAX_ATTEMPTS);
    this.windowMs = positiveInteger(options.windowMs, DEFAULT_WINDOW_MS);
    this.maxEntries = positiveInteger(options.maxEntries, DEFAULT_MAX_ENTRIES);
    this.now = options.now ?? Date.now;
  }

  public get size(): number {
    this.prune(this.now());
    return this.attempts.size;
  }

  /** Records an eligible attempt and returns false only when its current window is exhausted. */
  public allow(normalizedName: string): boolean {
    const currentTime = this.now();
    this.prune(currentTime);
    const existing = this.attempts.get(normalizedName);
    if (existing) {
      if (existing.count >= this.maxAttempts) return false;
      existing.count += 1;
      return true;
    }
    this.evictIfFull();
    this.attempts.set(normalizedName, { count: 1, expiresAt: currentTime + this.windowMs });
    return true;
  }

  /** A successful credential check should not leave a stale failure window behind. */
  public clear(normalizedName: string): void {
    this.attempts.delete(normalizedName);
  }

  private prune(currentTime: number): void {
    for (const [name, entry] of this.attempts) {
      if (entry.expiresAt <= currentTime) this.attempts.delete(name);
    }
  }

  private evictIfFull(): void {
    if (this.attempts.size < this.maxEntries) return;
    const oldest = this.attempts.keys().next().value;
    if (oldest !== undefined) this.attempts.delete(oldest);
  }
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export const credentialAttemptLimiter = new AuthAttemptLimiter();
