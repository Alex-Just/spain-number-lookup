import { SOURCE_IDS } from '../constants.ts';
import { formatCount } from '../format.ts';
import type { SourceResult, SourceReview } from '../types.ts';
import { fetchText, safeLookup, type FetchLike } from './http.ts';
import type { SourceAdapter } from './types.ts';

const SOURCE_NAME = 'Tellows';
const MIN_USEFUL_SCORE = 1;
const MAX_USEFUL_SCORE = 9;
const MAX_REVIEWS = 5;

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

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  uuml: 'ü',
  iexcl: '¡',
  iquest: '¿',
  laquo: '«',
  raquo: '»',
  lrm: '',
  rlm: '',
};

function fromCodePoint(value: number): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : '';
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? match);
}

function cleanText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/[\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type TellowsHtml = {
  label?: string;
  reviews: SourceReview[];
};

function parseReviewBlock(block: string): SourceReview | null {
  const leadHtml = /<p[^>]*class="[^"]*\blead\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1] ?? '';
  const textHtml = /<p[^>]*class="[^"]*\bmb-0\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1] ?? '';
  const metaHtml =
    /<div[^>]*class="[^"]*\bcomment-meta\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block)?.[1] ?? '';

  const lead = cleanText(leadHtml);
  const text = cleanText(textHtml) || lead;
  if (text === '') {
    return null;
  }

  const score = /\brealscore\s+realscore([1-9])\b/i.exec(block)?.[1];
  const authorHtml = /<i[^>]*>([\s\S]*?)<\/i>\s*report[oó]/i.exec(block)?.[1];
  const classification = /como\s+([^,.;]+?)(?:\s+con el n[úu]mero|$)/i.exec(lead)?.[1]?.trim();
  const meta = cleanText(metaHtml);
  const date = meta.split(/\s+v[ií]a\s+/i)[0]?.trim();

  return {
    text,
    ...(authorHtml ? { author: cleanText(authorHtml) } : {}),
    ...(date ? { date } : {}),
    ...(score ? { score: Number(score) } : {}),
    ...(classification ? { classification } : {}),
  };
}

/** Reads the caller name and first page of community reports from the number page. */
export function parseTellowsHtml(body: string): TellowsHtml {
  const callerMatch = /<span[^>]*class="[^"]*\bcallerId\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(
    body,
  );
  const label = callerMatch?.[1] ? cleanLabel(cleanText(callerMatch[1])) : undefined;

  const reviews: SourceReview[] = [];
  const listStart = body.search(/<ol[^>]*\bid="singlecomments"[^>]*>/i);
  if (listStart !== -1) {
    const listOpenEnd = body.indexOf('>', listStart) + 1;
    const listEnd = body.toLowerCase().indexOf('</ol>', listOpenEnd);
    const list = listEnd === -1 ? body.slice(listOpenEnd) : body.slice(listOpenEnd, listEnd);
    for (const block of list.split(/<li\b/i).slice(1)) {
      if (reviews.length >= MAX_REVIEWS) {
        break;
      }
      const review = parseReviewBlock(block);
      if (review) {
        reviews.push(review);
      }
    }
  }

  return { ...(label ? { label } : {}), reviews };
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

function mergeTellowsHtml(base: SourceResult, html: TellowsHtml | null): SourceResult {
  if (html === null) {
    return base;
  }

  const merged: SourceResult = {
    ...base,
    ...(html.label ? { label: html.label } : {}),
    ...(html.reviews.length > 0 ? { reviews: html.reviews } : {}),
  };

  if (base.status === 'found') {
    return merged;
  }

  // The JSON endpoint can block while the human page still names the caller.
  if (html.label || html.reviews.length > 0) {
    return { ...merged, status: 'found' };
  }
  return base;
}

async function loadTellowsHtml(
  national9: string,
  signal: AbortSignal,
  fetchImpl: FetchLike,
): Promise<TellowsHtml | null> {
  try {
    const { status, body } = await fetchText(buildTellowsUrl(national9), signal, fetchImpl);
    if (status < 200 || status >= 300) {
      return null;
    }
    return parseTellowsHtml(body);
  } catch {
    return null;
  }
}

export function createTellowsAdapter(fetchImpl: FetchLike = fetch): SourceAdapter {
  return {
    id: SOURCE_IDS.TELLOWS,
    name: SOURCE_NAME,
    buildUrl: buildTellowsUrl,
    lookup: async (national9, signal) => {
      const [base, html] = await Promise.all([
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
        ),
        loadTellowsHtml(national9, signal, fetchImpl),
      ]);

      return {
        ...mergeTellowsHtml(base, html),
        // Deep link stays on the human page, not the JSON endpoint.
        url: buildTellowsUrl(national9),
      };
    },
  };
}

export const tellowsAdapter = createTellowsAdapter();
