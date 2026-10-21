import { describe, expect, it, vi } from 'vitest';
import { runLookup } from '../src/lookup.ts';
import { createListaSpamAdapter } from '../src/sources/listaspam.ts';
import { createResponderONoAdapter } from '../src/sources/responderono.ts';

describe('source HTTP status mapping', () => {
  it('maps ListaSpam 403 to blocked and keeps deep link while lookup succeeds', async () => {
    const fetchImpl = vi.fn(async () => new Response('forbidden', { status: 403 }));
    const result = await runLookup('400300429', {
      adapters: [createListaSpamAdapter(fetchImpl)],
    });

    expect(result).not.toHaveProperty('error');
    if ('error' in result) {
      return;
    }
    expect(result.sources[0]?.status).toBe('blocked');
    expect(result.sources[0]?.url).toContain('listaspam.com');
    expect(result.summary.confidence).toBe('none');
  });

  it('maps ResponderONo 404 to empty not failed', async () => {
    const fetchImpl = vi.fn(async () => new Response('missing', { status: 404 }));
    const result = await runLookup('400300429', {
      adapters: [createResponderONoAdapter(fetchImpl)],
    });

    expect(result).not.toHaveProperty('error');
    if ('error' in result) {
      return;
    }
    expect(result.sources[0]?.status).toBe('empty');
  });
});
