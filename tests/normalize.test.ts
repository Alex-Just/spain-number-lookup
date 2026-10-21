import { describe, expect, it } from 'vitest';
import { extractSpainNumber } from '../src/normalize.ts';

describe('extractSpainNumber', () => {
  it('extracts from Truecaller share text preferring URL digits', () => {
    const raw =
      '+34400300429\nhttps://truecaller.com/search/es/34400300429\nsent using Truecaller';
    expect(extractSpainNumber(raw)).toEqual({
      numberE164: '+34400300429',
      numberNational: '400300429',
    });
  });

  it('accepts 400 prefix with spaces', () => {
    expect(extractSpainNumber('400 30 04 29')).toEqual({
      numberE164: '+34400300429',
      numberNational: '400300429',
    });
  });

  it('accepts tel URI', () => {
    expect(extractSpainNumber('tel:+34-400-300-429')).toEqual({
      numberE164: '+34400300429',
      numberNational: '400300429',
    });
  });

  it('rejects too short', () => {
    expect(extractSpainNumber('12345')).toBeNull();
  });

  it('rejects non-Spain first digit below 4', () => {
    expect(extractSpainNumber('300300429')).toBeNull();
  });

  it('prefers Truecaller URL digits over a different body number', () => {
    expect(
      extractSpainNumber('612345678\nhttps://truecaller.com/search/es/34400300429'),
    ).toEqual({
      numberE164: '+34400300429',
      numberNational: '400300429',
    });
  });
});
