import { SOURCE_IDS } from '../constants.ts';
import { formatCount } from '../format.ts';
import type { SourceResult } from '../types.ts';
import { safeLookup, type FetchLike } from './http.ts';
import type { SourceAdapter } from './types.ts';

const SOURCE_NAME = 'ListaSpam';

/** Common ListaSpam category chips / headings seen on number pages. */
const LABEL_PATTERNS = [
  /Llamadas comerciales/i,
  /Telemarketing/i,
  /Estafa/i,
  /Spam/i,
  /Cobro de deudas/i,
  /Encuesta/i,
] as const;

export function buildListaSpamUrl(national9: string): string {
  return `https://www.listaspam.com/busca.php?Telefono=${national9}`;
}

export function parseListaSpamHtml(body: string): Partial<SourceResult> | null {
  for (const pattern of LABEL_PATTERNS) {
    const match = pattern.exec(body);
    if (match?.[0]) {
      return {
        status: 'found',
        label: match[0],
      };
    }
  }

  const searches = /BÚSQUEDAS[\s\S]*?(\d{1,6})/i.exec(body);
  if (searches?.[1] && Number(searches[1]) > 0) {
    return {
      status: 'found',
      detail: `${formatCount(Number(searches[1]), 'search', 'searches')} on ListaSpam`,
    };
  }

  return null;
}

export function createListaSpamAdapter(fetchImpl: FetchLike = fetch): SourceAdapter {
  return {
    id: SOURCE_IDS.LISTASPAM,
    name: SOURCE_NAME,
    buildUrl: buildListaSpamUrl,
    lookup: (national9, signal) =>
      safeLookup(
        SOURCE_IDS.LISTASPAM,
        SOURCE_NAME,
        buildListaSpamUrl(national9),
        signal,
        parseListaSpamHtml,
        fetchImpl,
      ),
  };
}

export const listaspamAdapter = createListaSpamAdapter();
