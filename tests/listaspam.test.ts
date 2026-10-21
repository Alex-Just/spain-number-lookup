import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createListaSpamAdapter,
  parseListaSpamHtml,
} from '../src/sources/listaspam.ts';

const fixture = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    'fixtures/listaspam-917220650.html',
  ),
  'utf8',
);

describe('parseListaSpamHtml', () => {
  it('extracts the owner, counts, classifications, and reports', () => {
    const parsed = parseListaSpamHtml(fixture);

    expect(parsed?.status).toBe('found');
    expect(parsed?.label).toBe('Correos Express');
    expect(parsed?.comments).toBe(359);
    expect(parsed?.detail).toContain('359 comments');
    expect(parsed?.detail).toContain('193185 searches');
    expect(parsed?.detail).toContain('Presunta estafa (28)');
    expect(parsed?.reviews).toHaveLength(2);
    expect(parsed?.reviews?.[0]).toMatchObject({
      author: 'Anónimo',
      date: '2026-10-21',
      rating: 'Seguro',
      text: expect.stringContaining('Es correos expres'),
    });
    expect(parsed?.reviews?.[1]).toMatchObject({
      author: 'Anónimo',
      date: '2026-10-15',
    });
  });

  it('does not use comment text as the label', () => {
    const parsed = parseListaSpamHtml(fixture);
    expect(parsed?.label).toBe('Correos Express');
  });

  it('uses a singular search count', () => {
    const parsed = parseListaSpamHtml(
      '<section class="number_data_box"><div class="n_search"><label>BÚSQUEDAS</label><span class="result">1</span></div></section>',
    );

    expect(parsed?.detail).toBe('1 search');
  });

  it('marks a Cloudflare challenge as blocked', () => {
    expect(
      parseListaSpamHtml('<html><title>Just a moment...</title></html>'),
    ).toEqual({ status: 'blocked' });
  });

  it('returns null for an unrelated page', () => {
    expect(parseListaSpamHtml('<html><body>hello</body></html>')).toBeNull();
  });
});

describe('listaSpam adapter', () => {
  it('falls back to the translate proxy when the direct page is blocked', async () => {
    const calls: string[] = [];
    const adapter = createListaSpamAdapter(async (url) => {
      calls.push(url);
      if (url.includes('translate.goog')) {
        return new Response(fixture, { status: 200 });
      }
      return new Response('blocked', { status: 403 });
    });

    const result = await adapter.lookup('917220650', new AbortController().signal);

    expect(result.status).toBe('found');
    expect(result.label).toBe('Correos Express');
    expect(result.comments).toBe(359);
    expect(result.reviews).toHaveLength(2);
    expect(result.url).toContain('listaspam.com');
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('translate.goog');
  });

  it('keeps the blocked result when the proxy also fails', async () => {
    const adapter = createListaSpamAdapter(
      async () => new Response('nope', { status: 403 }),
    );

    const result = await adapter.lookup('917220650', new AbortController().signal);

    expect(result.status).toBe('blocked');
    expect(result.reviews).toBeUndefined();
  });

  it('does not use the proxy when the direct page works', async () => {
    const calls: string[] = [];
    const adapter = createListaSpamAdapter(async (url) => {
      calls.push(url);
      return new Response(fixture, { status: 200 });
    });

    const result = await adapter.lookup('917220650', new AbortController().signal);

    expect(result.status).toBe('found');
    expect(result.label).toBe('Correos Express');
    expect(calls).toHaveLength(1);
  });
});
