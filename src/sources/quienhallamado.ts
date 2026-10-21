import { SOURCE_IDS } from '../constants.ts';
import type { SourceResult } from '../types.ts';
import { safeLookup, type FetchLike } from './http.ts';
import type { SourceAdapter } from './types.ts';

const SOURCE_NAME = 'QuienHaLlamado';

export function buildQuienHaLlamadoUrl(national9: string): string {
  return `https://www.quienhallamado.es/${national9}`;
}

export function parseQuienHaLlamadoHtml(body: string): Partial<SourceResult> | null {
  const votes = /(\d+)\s+out of\s+100/i.exec(body);
  if (votes?.[1]) {
    return {
      status: 'found',
      detail: `Community seriousness ${votes[1]}%`,
    };
  }
  if (/Actuales entradas/i.test(body) && /Denuncie ahora/i.test(body)) {
    return { status: 'empty' };
  }
  return null;
}

export function createQuienHaLlamadoAdapter(fetchImpl: FetchLike = fetch): SourceAdapter {
  return {
    id: SOURCE_IDS.QUIENHALLAMADO,
    name: SOURCE_NAME,
    buildUrl: buildQuienHaLlamadoUrl,
    lookup: (national9, signal) =>
      safeLookup(
        SOURCE_IDS.QUIENHALLAMADO,
        SOURCE_NAME,
        buildQuienHaLlamadoUrl(national9),
        signal,
        parseQuienHaLlamadoHtml,
        fetchImpl,
      ),
  };
}

export const quienhallamadoAdapter = createQuienHaLlamadoAdapter();
