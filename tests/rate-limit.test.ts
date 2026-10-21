import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/rate-limit.ts';

describe('RateLimiter', () => {
  it('allows up to max requests then blocks within the window', () => {
    const limiter = new RateLimiter({
      windowMs: 60_000,
      maxRequests: 3,
      now: () => 1_000,
    });

    expect(limiter.check('1.1.1.1')).toBe(true);
    expect(limiter.check('1.1.1.1')).toBe(true);
    expect(limiter.check('1.1.1.1')).toBe(true);
    expect(limiter.check('1.1.1.1')).toBe(false);
  });

  it('tracks IPs independently', () => {
    const limiter = new RateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      now: () => 1_000,
    });

    expect(limiter.check('1.1.1.1')).toBe(true);
    expect(limiter.check('2.2.2.2')).toBe(true);
    expect(limiter.check('1.1.1.1')).toBe(false);
  });
});
