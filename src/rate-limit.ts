import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from './constants.ts';

type RateLimiterOptions = {
  windowMs?: number;
  maxRequests?: number;
  now?: () => number;
};

/**
 * Simple in-memory sliding window limiter for a single Worker isolate.
 * Enough for personal free-tier abuse dampening; not a global distributed quota.
 */
export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly now: () => number;
  private readonly hits = new Map<string, number[]>();

  constructor(options: RateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
    this.maxRequests = options.maxRequests ?? RATE_LIMIT_MAX_REQUESTS;
    this.now = options.now ?? Date.now;
  }

  check(ip: string): boolean {
    const current = this.now();
    const windowStart = current - this.windowMs;
    const prior = this.hits.get(ip) ?? [];
    const recent = prior.filter((timestamp) => timestamp > windowStart);

    if (recent.length >= this.maxRequests) {
      this.hits.set(ip, recent);
      return false;
    }

    recent.push(current);
    this.hits.set(ip, recent);
    return true;
  }
}
