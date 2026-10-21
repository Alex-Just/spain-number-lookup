import { SOURCE_IDS } from '../constants.ts';
import { baseResult, type FetchLike } from './http.ts';
import type { SourceAdapter } from './types.ts';

const SOURCE_NAME = 'Truecaller';

export function buildTruecallerUrl(national9: string): string {
  return `https://www.truecaller.com/search/es/${national9}`;
}

/** Truecaller web is login-walled; v1 deep-links only. */
export function createTruecallerAdapter(_fetchImpl: FetchLike = fetch): SourceAdapter {
  return {
    id: SOURCE_IDS.TRUECALLER,
    name: SOURCE_NAME,
    buildUrl: buildTruecallerUrl,
    lookup: async (national9, _signal) =>
      baseResult(SOURCE_IDS.TRUECALLER, SOURCE_NAME, buildTruecallerUrl(national9), 'empty', {
        detail: 'Open in browser (login wall)',
      }),
  };
}

export const truecallerAdapter = createTruecallerAdapter();
