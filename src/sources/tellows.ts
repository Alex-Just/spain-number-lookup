import { SOURCE_IDS } from '../constants.ts';
import { formatCount } from '../format.ts';
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
    numberDetails?: {
      name?: unknown;
      category?: unknown;
    };
    callerTypes?: {
      caller?: Array<{ name?: unknown; count?: string | number }>;
    };
  };
};

const GENERIC_LABELS = new Set(['desconocido', 'unknown']);
const MAX_LABEL_LENGTH = 80;

function cleanLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized === '' || GENERIC_LABELS.has(normalized.toLowerCase())) {
    return undefined;
  }
  if (normalized.length <= MAX_LABEL_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`;
}

/** Owner name or category; callerTypes are classifications, not identities. */
function extractLabel(tellows: TellowsPayload['tellows']): string | undefined {
  return (
    cleanLabel(tellows?.numberDetails?.name) ?? cleanLabel(tellows?.numberDetails?.category)
  );
}

/** Keep every community classification, with its count, in the source detail. */
function extractClassifications(tellows: TellowsPayload['tellows']): string[] {
  const callers = tellows?.callerTypes?.caller;
  if (!Array.isArray(callers)) {
    return [];
  }
  const seen = new Set<string>();
  const classifications: string[] = [];
  for (const caller of callers) {
    const name = cleanLabel(caller?.name);
    if (name === undefined) {
      continue;
    }
    const count = Number(caller?.count);
    const text = Number.isFinite(count) && count > 0 ? `${name} (${count})` : name;
    if (seen.has(text)) {
      continue;
    }
    seen.add(text);
    classifications.push(text);
  }
  return classifications;
}

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
  const commentsRaw = Number(data.tellows?.comments ?? 0);
  const comments = Number.isFinite(commentsRaw) ? commentsRaw : 0;
  const searches = Number(data.tellows?.searches ?? 0);

  if (!Number.isFinite(score) || score < MIN_USEFUL_SCORE || score > MAX_USEFUL_SCORE) {
    return { status: 'empty' };
  }

  const detailParts: string[] = [formatCount(comments, 'comment', 'comments')];
  if (Number.isFinite(searches)) {
    detailParts.push(formatCount(searches, 'search', 'searches'));
  }
  detailParts.push(...extractClassifications(data.tellows));

  const label = extractLabel(data.tellows);

  // Score alone is still a found row; summary only elevates when comments exist.
  return {
    status: 'found',
    score,
    comments,
    ...(label === undefined ? {} : { label }),
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
