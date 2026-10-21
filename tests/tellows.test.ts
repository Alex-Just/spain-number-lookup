import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createTellowsAdapter,
  parseTellowsHtml,
  parseTellowsJson,
} from '../src/sources/tellows.ts';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = readFileSync(join(fixtures, 'tellows.json'), 'utf8');
const htmlFixture = readFileSync(join(fixtures, 'tellows-917220650.html'), 'utf8');

describe('parseTellowsJson', () => {
  it('reads score from tellows JSON body', () => {
    const parsed = parseTellowsJson(fixture);
    expect(parsed.score).toBe(5);
    expect(parsed.status).toBe('found');
  });

  it('tolerates trailing partner noise after JSON', () => {
    const parsed = parseTellowsJson(`${fixture.trim()}Partner Data not correct`);
    expect(parsed.score).toBe(5);
    expect(parsed.status).toBe('found');
  });

  it('exposes the comment count as a structured field', () => {
    const parsed = parseTellowsJson(
      JSON.stringify({ tellows: { score: '6', comments: '2', searches: '9' } }),
    );
    expect(parsed.comments).toBe(2);
  });

  it('defaults comments to zero when the field is missing', () => {
    const parsed = parseTellowsJson(JSON.stringify({ tellows: { score: '6' } }));
    expect(parsed.comments).toBe(0);
  });

  it('uses the business name as the label', () => {
    const parsed = parseTellowsJson(
      JSON.stringify({
        tellows: {
          score: '7',
          comments: '2',
          numberDetails: { name: 'Lucía Llanos Fisioterapia', category: '' },
          callerTypes: { caller: [{ name: 'Desconocido', count: '2' }] },
        },
      }),
    );

    expect(parsed.label).toBe('Lucía Llanos Fisioterapia');
  });

  it('falls back to a category when there is no name', () => {
    const parsed = parseTellowsJson(
      JSON.stringify({
        tellows: {
          score: '7',
          comments: '2',
          numberDetails: { name: '', category: 'Telemarketing' },
        },
      }),
    );

    expect(parsed.label).toBe('Telemarketing');
  });

  it('ignores the generic Desconocido caller label', () => {
    const parsed = parseTellowsJson(
      JSON.stringify({
        tellows: {
          score: '5',
          comments: '0',
          numberDetails: { name: 'Desconocido', category: '' },
          callerTypes: { caller: [{ name: 'Desconocido', count: '2' }] },
        },
      }),
    );

    expect(parsed.label).toBeUndefined();
  });

  it('keeps caller classifications in detail instead of the label', () => {
    const parsed = parseTellowsJson(
      JSON.stringify({
        tellows: {
          score: '8',
          comments: '1',
          searches: '4',
          numberDetails: { name: '', category: '' },
          callerTypes: {
            caller: [
              { name: 'Concurso', count: '1' },
              { name: 'Estafa', count: '1' },
            ],
          },
        },
      }),
    );

    expect(parsed.label).toBeUndefined();
    expect(parsed.detail).toContain('Concurso (1)');
    expect(parsed.detail).toContain('Estafa (1)');
  });

  it('ignores non-string names without losing the row', () => {
    const parsed = parseTellowsJson(
      JSON.stringify({
        tellows: {
          score: '6',
          comments: '1',
          numberDetails: { name: 123 },
          callerTypes: { caller: [{ name: 'Estafa', count: '1' }] },
        },
      }),
    );

    expect(parsed.status).toBe('found');
    expect(parsed.label).toBeUndefined();
    expect(parsed.detail).toContain('Estafa (1)');
  });

  it('does not duplicate the score in detail', () => {
    const parsed = parseTellowsJson(fixture);
    expect(parsed.detail).not.toContain('score');
  });

  it('uses singular counts for one comment and one search', () => {
    const parsed = parseTellowsJson(
      JSON.stringify({ tellows: { score: '6', comments: '1', searches: '1' } }),
    );

    expect(parsed.detail).toBe('1 comment · 1 search');
  });

  it('normalizes whitespace and caps long labels', () => {
    const messy = parseTellowsJson(
      JSON.stringify({
        tellows: {
          score: '6',
          comments: '1',
          numberDetails: { name: '  Estanco   Madrid\n344  ' },
        },
      }),
    );
    expect(messy.label).toBe('Estanco Madrid 344');

    const capped = parseTellowsJson(
      JSON.stringify({
        tellows: {
          score: '6',
          comments: '1',
          numberDetails: { name: 'A'.repeat(200) },
        },
      }),
    );
    expect(capped.label).toHaveLength(80);
    expect(capped.label?.endsWith('…')).toBe(true);
  });
});

describe('parseTellowsHtml', () => {
  it('extracts the caller id and recent reports', () => {
    const parsed = parseTellowsHtml(htmlFixture);

    expect(parsed.label).toBe('Correos. Envios Just Fab');
    expect(parsed.reviews).toHaveLength(2);
    expect(parsed.reviews[0]).toMatchObject({
      score: 9,
      classification: 'Acoso telefónico',
      text: 'se hacen pasar por correos',
    });
    expect(parsed.reviews[0]?.author).toBeUndefined();
    expect(parsed.reviews[0]?.date).toContain('9/8/24');
    expect(parsed.reviews[1]).toMatchObject({
      author: 'Javier',
      score: 5,
      classification: 'Número fiable',
      text: 'grupo Correos',
    });
  });

  it('returns only the caller id when there are no comments', () => {
    const parsed = parseTellowsHtml(
      '<span class="callerId">Acme</span><ol id="singlecomments"></ol>',
    );

    expect(parsed).toEqual({ label: 'Acme', reviews: [] });
  });
});

describe('tellows adapter', () => {
  it('merges the JSON score with the HTML caller id and reviews', async () => {
    const json = JSON.stringify({
      tellows: { score: '7', comments: '5', searches: '1581' },
    });
    const adapter = createTellowsAdapter(async (url) =>
      url.includes('json=1')
        ? new Response(json, { status: 200 })
        : new Response(htmlFixture, { status: 200 }),
    );

    const result = await adapter.lookup('917220650', new AbortController().signal);

    expect(result.status).toBe('found');
    expect(result.label).toBe('Correos. Envios Just Fab');
    expect(result.comments).toBe(5);
    expect(result.reviews).toHaveLength(2);
    expect(result.detail).toContain('5 comments');
    expect(result.url).toContain('/num/917220650');
  });

  it('keeps the JSON result when the HTML page fails', async () => {
    const json = JSON.stringify({
      tellows: { score: '7', comments: '5', searches: '1581' },
    });
    const adapter = createTellowsAdapter(async (url) =>
      url.includes('json=1')
        ? new Response(json, { status: 200 })
        : new Response('blocked', { status: 403 }),
    );

    const result = await adapter.lookup('917220650', new AbortController().signal);

    expect(result.status).toBe('found');
    expect(result.label).toBeUndefined();
    expect(result.reviews).toBeUndefined();
  });
});
