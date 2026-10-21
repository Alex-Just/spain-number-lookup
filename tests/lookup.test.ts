import { describe, expect, it, vi } from 'vitest';
import { runLookup } from '../src/lookup.ts';
import type { SourceAdapter } from '../src/sources/types.ts';
import type { SourceResult } from '../src/types.ts';

function mockAdapter(
  id: string,
  name: string,
  result: Omit<SourceResult, 'id' | 'name' | 'url'>,
): SourceAdapter {
  return {
    id,
    name,
    buildUrl: (n) => `https://example.test/${id}/${n}`,
    lookup: vi.fn(async (national9) => ({
      id,
      name,
      url: `https://example.test/${id}/${national9}`,
      ...result,
    })),
  };
}

describe('runLookup', () => {
  it('returns merged LookupResult from adapters', async () => {
    const adapters = [
      mockAdapter('listaspam', 'ListaSpam', {
        status: 'found',
        label: 'Llamadas comerciales',
      }),
      mockAdapter('teledigo', 'Teledigo', {
        status: 'found',
        detail: 'Assigned to AIRE NETWORKS',
      }),
    ];

    const result = await runLookup('400300429', { adapters });

    expect(result).not.toHaveProperty('error');
    if ('error' in result) {
      return;
    }
    expect(result.numberNational).toBe('400300429');
    expect(result.summary.headline).toContain('Llamadas comerciales');
    expect(result.sources).toHaveLength(2);
  });

  it('returns error for invalid number', async () => {
    const result = await runLookup('123', { adapters: [] });
    expect(result).toEqual({ error: 'Invalid Spain phone number' });
  });
});
