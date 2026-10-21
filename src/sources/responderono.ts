import { SOURCE_IDS } from '../constants.ts';
import type { SourceResult } from '../types.ts';
import { safeLookup, type FetchLike } from './http.ts';
import type { SourceAdapter } from './types.ts';

const SOURCE_NAME = 'ResponderONo';
const RATING =
  /(NEGATIVA|POSITIVA|NEUTRAL|NEGATIVE|POSITIVE)/i;

export function buildResponderONoUrl(national9: string): string {
  return `https://www.responderono.es/numero-de-telefono/${national9}`;
}

export function parseResponderONoHtml(body: string): Partial<SourceResult> | null {
  const rating = RATING.exec(body);
  if (!rating?.[1]) {
    // Page exists but no clear rating text — still treat as empty signal.
    if (/Evaluaciones/i.test(body) || /número de teléfono/i.test(body)) {
      return { status: 'empty' };
    }
    return null;
  }
  return {
    status: 'found',
    label: rating[1].toUpperCase(),
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
