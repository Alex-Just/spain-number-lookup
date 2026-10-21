import { SOURCE_IDS } from '../constants.ts';
import type { SourceResult } from '../types.ts';
import { safeLookup, type FetchLike } from './http.ts';
import type { SourceAdapter } from './types.ts';

const SOURCE_NAME = 'Tellows';
const MIN_USEFUL_SCORE = 1;
const MAX_USEFUL_SCORE = 9;

type TellowsPayload = {
  tellows?: {
    score?: string | number;
    comments?: string | number;
    searches?: string | number;
  };
};

export function buildTellowsUrl(national9: string): string {
  return `https://www.tellows.es/num/${national9}`;
}

function buildTellowsJsonUrl(national9: string): string {
  return `https://www.tellows.es/basic/num/+34${national9}?json=1`;
}

function extractJsonObject(body: string): string {
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return body;
  }
  return body.slice(start, end + 1);
}

export function parseTellowsJson(body: string): Partial<SourceResult> {
  const data = JSON.parse(extractJsonObject(body)) as TellowsPayload;
  const scoreRaw = data.tellows?.score;
  const score =
    typeof scoreRaw === 'number' ? scoreRaw : Number.parseInt(String(scoreRaw ?? ''), 10);
  const comments = Number(data.tellows?.comments ?? 0);
  const searches = Number(data.tellows?.searches ?? 0);

  if (!Number.isFinite(score) || score < MIN_USEFUL_SCORE || score > MAX_USEFUL_SCORE) {
    return { status: 'empty' };
  }

  const detailParts: string[] = [`score ${score}`];
  if (Number.isFinite(comments)) {
    detailParts.push(`${comments} comments`);
  }
  if (Number.isFinite(searches)) {
    detailParts.push(`${searches} searches`);
  }

  // Score alone is still a found row; summary only elevates when comments/label exist.
  return {
    status: 'found',
    score,
    detail: detailParts.join(' · '),
  };
}

export function createTellowsAdapter(fetchImpl: FetchLike = fetch): SourceAdapter {
  return {
    id: SOURCE_IDS.TELLOWS,
    name: SOURCE_NAME,
    buildUrl: buildTellowsUrl,
    lookup: async (national9, signal) =>
      safeLookup(
        SOURCE_IDS.TELLOWS,
        SOURCE_NAME,
        buildTellowsJsonUrl(national9),
        signal,
        (body) => {
          try {
            return parseTellowsJson(body);
          } catch {
            return null;
          }
        },
        fetchImpl,
      ).then((result) => ({
        ...result,
        // Deep link stays on the human page, not the JSON endpoint.
        url: buildTellowsUrl(national9),
      })),
  };
}

export const tellowsAdapter = createTellowsAdapter();
