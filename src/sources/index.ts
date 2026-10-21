import type { FetchLike } from './http.ts';
import { createListaSpamAdapter } from './listaspam.ts';
import { createOpenSpamAdapter } from './openspam.ts';
import { createQuienHaLlamadoAdapter } from './quienhallamado.ts';
import { createResponderONoAdapter } from './responderono.ts';
import { createTeledigoAdapter } from './teledigo.ts';
import { createTellowsAdapter } from './tellows.ts';
import { createTruecallerAdapter } from './truecaller.ts';
import type { SourceAdapter } from './types.ts';

export function createAdapters(fetchImpl: FetchLike = fetch): SourceAdapter[] {
  return [
    createListaSpamAdapter(fetchImpl),
    createTellowsAdapter(fetchImpl),
    createTeledigoAdapter(fetchImpl),
    createResponderONoAdapter(fetchImpl),
    createOpenSpamAdapter(fetchImpl),
    createQuienHaLlamadoAdapter(fetchImpl),
    createTruecallerAdapter(fetchImpl),
  ];
}

export const adapters = createAdapters();
