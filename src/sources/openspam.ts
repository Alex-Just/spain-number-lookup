import { SOURCE_IDS } from '../constants.ts';
import { baseResult, type FetchLike } from './http.ts';
import type { SourceAdapter } from './types.ts';

const SOURCE_NAME = 'OpenSpam';

export function buildOpenSpamUrl(national9: string): string {
  return `https://openspam.es/?q=${national9}`;
}

/**
 * OpenSpam public site is a form-first SPA; v1 deep-links only.
 * Avoid inventing parse results without a stable HTML contract.
 */
export function createOpenSpamAdapter(_fetchImpl: FetchLike = fetch): SourceAdapter {
  return {
    id: SOURCE_IDS.OPENSPAM,
    name: SOURCE_NAME,
    buildUrl: buildOpenSpamUrl,
    lookup: async (national9, _signal) =>
      baseResult(SOURCE_IDS.OPENSPAM, SOURCE_NAME, buildOpenSpamUrl(national9), 'empty', {
        detail: 'Open in browser (no free parse API in v1)',
      }),
  };
}

export const openspamAdapter = createOpenSpamAdapter();
