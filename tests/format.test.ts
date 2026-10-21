import { describe, expect, it } from 'vitest';
import { formatCount } from '../src/format.ts';

describe('formatCount', () => {
  it('uses plural for zero', () => {
    expect(formatCount(0, 'comment', 'comments')).toBe('0 comments');
  });

  it('uses singular for one', () => {
    expect(formatCount(1, 'comment', 'comments')).toBe('1 comment');
  });

  it('uses plural for two', () => {
    expect(formatCount(2, 'comment', 'comments')).toBe('2 comments');
  });
});
