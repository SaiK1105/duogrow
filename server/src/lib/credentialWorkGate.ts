export interface CredentialWorkGateOptions {
  maxConcurrent?: number;
  maxQueued?: number;
}

const DEFAULT_MAX_CONCURRENT = 4;
const DEFAULT_MAX_QUEUED = 32;

/** Marks work refused because the gate was already saturated. */
export const CREDENTIAL_WORK_REJECTED = Symbol("credential-work-rejected");
export type CredentialWorkResult<T> = T | typeof CREDENTIAL_WORK_REJECTED;

/**
 * Bounds how much key-derivation work unauthenticated requests can queue at once.
 *
 * A per-name attempt limiter cannot throttle a flood of distinct names, so without
 * this gate an unauthenticated caller could force one scrypt derivation per request
 * and exhaust a small single-instance host. Concurrency is capped so derivations do
 * not contend, and the wait queue is capped so excess callers are refused quickly
 * instead of accumulating pending work.
 */
export class CredentialWorkGate {
  private readonly maxConcurrent: number;
  private readonly maxQueued: number;
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  public constructor(options: CredentialWorkGateOptions = {}) {
    this.maxConcurrent = positiveInteger(options.maxConcurrent, DEFAULT_MAX_CONCURRENT);
    this.maxQueued = positiveInteger(options.maxQueued, DEFAULT_MAX_QUEUED);
  }

  public get pending(): number {
    return this.active + this.waiting.length;
  }

  /** Runs `task` under the gate, or returns the rejection marker when saturated. */
  public async run<T>(task: () => Promise<T>): Promise<CredentialWorkResult<T>> {
    if (this.active >= this.maxConcurrent) {
      if (this.waiting.length >= this.maxQueued) return CREDENTIAL_WORK_REJECTED;
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export const credentialWorkGate = new CredentialWorkGate();
