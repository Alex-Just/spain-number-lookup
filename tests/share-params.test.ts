import { describe, expect, it } from 'vitest';
import { combineShareParams } from '../src/share-params.ts';

describe('combineShareParams', () => {
  it('joins text and url so Truecaller URL survives split share payloads', () => {
    expect(
      combineShareParams({
        text: 'sent using Truecaller',
        url: 'https://truecaller.com/search/es/34400300429',
      }),
    ).toBe(
      'sent using Truecaller\nhttps://truecaller.com/search/es/34400300429',
    );
  });

  it('returns number alone when present', () => {
    expect(combineShareParams({ number: '400300429' })).toBe('400300429');
  });
});
