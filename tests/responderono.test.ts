import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseResponderONoHtml } from '../src/sources/responderono.ts';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const emptyPage = readFileSync(join(fixtures, 'responderono-empty.html'), 'utf8');
const ratedPage = readFileSync(join(fixtures, 'responderono-rated.html'), 'utf8');

describe('parseResponderONoHtml', () => {
  it('returns empty when the page has no rating summary', () => {
    expect(parseResponderONoHtml(emptyPage)).toEqual({ status: 'empty' });
  });

  it('reads the rating and summary from the meta description', () => {
    expect(parseResponderONoHtml(ratedPage)).toEqual({
      status: 'found',
      label: 'NEGATIVA',
      detail: 'Llamada de estafa',
    });
  });

  it('does not treat CSS class names or form labels as a rating', () => {
    expect(parseResponderONoHtml(emptyPage)?.status).not.toBe('found');
  });
});
