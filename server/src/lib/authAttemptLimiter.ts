export interface AuthAttemptLimiterOptions {
  maxAttempts?: number;
  windowMs?: number;
  maxEntries?: number;
  maxUntrackedAttempts?: number;
  now?: () => number;
}

interface AttemptEntry {
  count: number;
  expiresAt: number;
}

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 2_000;
const DEFAULT_MAX_UNTRACKED_ATTEMPTS = 30;

/** A bounded process-local guard against repeated credential work for one normalized name. */
export class AuthAttemptLimiter {
  private readonly attempts = new Map<string, AttemptEntry>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly maxUntrackedAttempts: number;
  private readonly now: () => number;
  private untrackedCount = 0;
  private untrackedWindowEnd = 0;

  public constructor(options: AuthAttemptLimiterOptions = {}) {
    this.maxAttempts = positiveInteger(options.maxAttempts, DEFAULT_MAX_ATTEMPTS);
    this.windowMs = positiveInteger(options.windowMs, DEFAULT_WINDOW_MS);
    this.maxEntries = positiveInteger(options.maxEntries, DEFAULT_MAX_ENTRIES);
    this.maxUntrackedAttempts = positiveInteger(options.maxUntrackedAttempts, DEFAULT_MAX_UNTRACKED_ATTEMPTS);
    this.now = options.now ?? Date.now;
  }

  public get size(): number {
    this.prune(this.now());
    return this.attempts.size;
  }

  /** Records an eligible attempt without displacing active names when the cache is full. */
  public allow(normalizedName: string): boolean {
    const currentTime = this.now();
    this.prune(currentTime);
    const existing = this.attempts.get(normalizedName);
    if (existing) {
      if (existing.count >= this.maxAttempts) return false;
      existing.count += 1;
      return true;
    }
    // At capacity the cache deliberately keeps exhausted names resident rather than
    // evicting them, so an untracked name cannot be denied on their behalf — evicting
    // would hand an attacker a way to reset a blocked counter, and denying would let
    // one turn a full cache into a global lockout. Untracked attempts are instead
    // drawn from a small shared budget, so saturating the cache degrades brute-force
    // protection to a bounded rate rather than removing it entirely.
    if (this.attempts.size >= this.maxEntries) return this.allowUntracked(currentTime);
    this.attempts.set(normalizedName, { count: 1, expiresAt: currentTime + this.windowMs });
    return true;
  }

  private allowUntracked(currentTime: number): boolean {
    if (currentTime >= this.untrackedWindowEnd) {
      this.untrackedCount = 0;
      this.untrackedWindowEnd = currentTime + this.windowMs;
    }
    if (this.untrackedCount >= this.maxUntrackedAttempts) return false;
    this.untrackedCount += 1;
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
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export const credentialAttemptLimiter = new AuthAttemptLimiter();
