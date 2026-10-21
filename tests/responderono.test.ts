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

  it('accepts attribute order, single quotes, and uppercase names', () => {
    const html =
      "<meta content='Lee más, más evaluado como negativa Llamada de estafa. Fin' name='DESCRIPTION'>";
    expect(parseResponderONoHtml(html)).toEqual({
      status: 'found',
      label: 'NEGATIVA',
      detail: 'Llamada de estafa',
    });
  });

  it('accepts &aacute; in the rating phrase', () => {
    const html =
      '<meta name="description" content="m&aacute;s evaluado como positiva Centro de llamadas.">';
    expect(parseResponderONoHtml(html)).toEqual({
      status: 'found',
      label: 'POSITIVA',
      detail: 'Centro de llamadas',
    });
  });

  it('accepts numeric entities in the rating phrase', () => {
    const html =
      '<meta name="description" content="m&#225;s evaluado como neutral Número fiable.">';
    expect(parseResponderONoHtml(html)).toEqual({
      status: 'found',
      label: 'NEUTRAL',
      detail: 'Número fiable',
    });
  });

  it('returns empty for a phone page with no meta description', () => {
    expect(
      parseResponderONoHtml('<html><body>número de teléfono</body></html>'),
    ).toEqual({ status: 'empty' });
  });
});
