import { SOURCE_IDS } from '../constants.ts';
import type { SourceResult } from '../types.ts';
import { safeLookup, type FetchLike } from './http.ts';
import type { SourceAdapter } from './types.ts';

const SOURCE_NAME = 'ResponderONo';
const RATED_AS =
  /m(?:á|&aacute;|&#225;|&#xe1;)s evaluado como\s+(negativa|positiva|neutral)\b([^.<]*)/i;

function metaDescription(html: string): string | null {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const text = tag[0];
    if (!/name\s*=\s*["']description["']/i.test(text)) {
      continue;
    }
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(text);
    if (content?.[1]) {
      return content[1];
    }
  }
  return null;
}

export function buildResponderONoUrl(national9: string): string {
  return `https://www.responderono.es/numero-de-telefono/${national9}`;
}

export function parseResponderONoHtml(body: string): Partial<SourceResult> | null {
  const description = metaDescription(body);
  const rating = description === null ? null : RATED_AS.exec(description);
  const ratingValue = rating?.[1];

  if (ratingValue === undefined) {
    // Page exists but no rating summary; CSS classes and form labels are not ratings.
    if (/Evaluaciones/i.test(body) || /número de teléfono/i.test(body)) {
      return { status: 'empty' };
    }
    return null;
  }

  const summary = rating?.[2]?.trim();
  return {
    status: 'found',
    label: ratingValue.toUpperCase(),
    ...(summary ? { detail: summary } : {}),
  };
}

export function createResponderONoAdapter(fetchImpl: FetchLike = fetch): SourceAdapter {
  return {
    id: SOURCE_IDS.RESPONDERONO,
    name: SOURCE_NAME,
    buildUrl: buildResponderONoUrl,
    lookup: (national9, signal) =>
      safeLookup(
        SOURCE_IDS.RESPONDERONO,
        SOURCE_NAME,
        buildResponderONoUrl(national9),
        signal,
        parseResponderONoHtml,
        fetchImpl,
      ),
  };
}

export const responderonoAdapter = createResponderONoAdapter();
