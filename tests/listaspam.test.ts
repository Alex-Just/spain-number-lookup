import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseListaSpamHtml } from '../src/sources/listaspam.ts';

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'fixtures/listaspam.html'),
  'utf8',
);

describe('parseListaSpamHtml', () => {
  it('extracts commercial-call label', () => {
    const parsed = parseListaSpamHtml(fixture);
    expect(parsed.status).toBe('found');
    expect(parsed.label).toBe('Llamadas comerciales');
  });

  it('uses a singular search count', () => {
    const parsed = parseListaSpamHtml('<p>BÚSQUEDAS</p><span>1</span>');
    expect(parsed).toEqual({
      status: 'found',
      detail: '1 search on ListaSpam',
    });
  });
});
