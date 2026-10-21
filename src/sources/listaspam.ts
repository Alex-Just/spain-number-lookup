import { SOURCE_IDS } from '../constants.ts';
import { formatCount } from '../format.ts';
import { htmlToText } from '../html.ts';
import type { SourceResult, SourceReview } from '../types.ts';
import { fetchText, safeLookup, type FetchLike } from './http.ts';
import type { SourceAdapter } from './types.ts';

const SOURCE_NAME = 'ListaSpam';
const MAX_REVIEWS = 5;
const PROXY_ORIGIN = 'https://www-listaspam-com.translate.goog';
const PROXY_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const RATINGS: Record<string, string> = {
  '5': 'Seguro',
  '4': 'Bueno',
  '3': 'Neutral',
  '2': 'Malo',
  '1': 'Peligroso',
};

export function buildListaSpamUrl(national9: string): string {
  return `https://www.listaspam.com/busca.php?Telefono=${national9}`;
}

/** Google's translate proxy fetches from an IP range ListaSpam allows. */
function buildListaSpamProxyUrl(national9: string): string {
  return `${PROXY_ORIGIN}/busca.php?Telefono=${national9}&_x_tr_sl=es&_x_tr_tl=en&_x_tr_hl=en`;
}

function numberFrom(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const digits = value.replace(/[^\d]/g, '');
  if (digits === '') {
    return undefined;
  }
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanOwner(value: string): string | undefined {
  const owner = value.replace(/\s+/g, ' ').trim();
  if (owner === '' || /^(anónimo|anonimo|desconocido)$/i.test(owner)) {
    return undefined;
  }
  return owner.length > 80 ? `${owner.slice(0, 79).trimEnd()}…` : owner;
}

function extractCommentCount(body: string): number | undefined {
  const meta = /<meta[^>]*itemprop=["']commentCount["'][^>]*>/i.exec(body)?.[0];
  if (meta) {
    return numberFrom(/content=["']([^"']+)["']/i.exec(meta)?.[1]);
  }
  const reports =
    /<div[^>]*class="[^"]*\bn_reports\b[^"]*"[\s\S]*?<span[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(
      body,
    )?.[1];
  return numberFrom(reports ? htmlToText(reports) : undefined);
}

function extractSearches(body: string): number | undefined {
  const searches =
    /<div[^>]*class="[^"]*\bn_search\b[^"]*"[\s\S]*?<span[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(
      body,
    )?.[1];
  return numberFrom(searches ? htmlToText(searches) : undefined);
}

function extractClassifications(body: string): string[] {
  const classifications: string[] = [];
  for (const match of body.matchAll(/<strong>([^<]+)<\/strong>\s*\((\d+)\s+veces?\)/gi)) {
    const label = htmlToText(match[1] ?? '');
    const count = Number(match[2]);
    if (label === '' || !Number.isFinite(count)) {
      continue;
    }
    classifications.push(`${label} (${count})`);
    if (classifications.length >= 3) {
      break;
    }
  }
  return classifications;
}

function parseReview(block: string): SourceReview | null {
  const textHtml = /<p[^>]*itemprop=["']text["'][^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1];
  const text = textHtml ? htmlToText(textHtml) : '';
  if (text === '') {
    return null;
  }

  const authorHtml =
    /<div[^>]*class=["'][^"']*\btime\b[^"']*["'][^>]*>[\s\S]*?Por(?:&nbsp;|\s)*<span[^>]*>([\s\S]*?)<\/span>/i.exec(
      block,
    )?.[1];
  const date = /<time[^>]*datetime=["']([^"']+)["']/i.exec(block)?.[1]?.slice(0, 10);
  const ratingCode =
    /<div[^>]*class=["'][^"']*\bphone_rating\b[^"']*result-([1-5])[^"']*["']/i.exec(block)?.[1];
  const rating = ratingCode ? RATINGS[ratingCode] : undefined;
  const locationHtml =
    /<div[^>]*class=["'][^"']*\blocation\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(block)?.[1];
  const location = locationHtml
    ? htmlToText(locationHtml).replace(/^Tipo de llamada:\s*/i, '')
    : '';

  return {
    text,
    ...(authorHtml ? { author: htmlToText(authorHtml) } : {}),
    ...(date ? { date } : {}),
    ...(rating ? { rating } : {}),
    ...(location ? { classification: location } : {}),
  };
}

function extractReviews(body: string): SourceReview[] {
  const list = /<ul[^>]*class=["'][^"']*\bcomments_list\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i.exec(
    body,
  )?.[1];
  if (list === undefined) {
    return [];
  }

  const reviews: SourceReview[] = [];
  const blocks = list.split(
    /<li[^>]*class=["'][^"']*\bcomment-box\b[^"']*["'][^>]*>/i,
  );
  for (const block of blocks.slice(1)) {
    if (reviews.length >= MAX_REVIEWS) {
      break;
    }
    const review = parseReview(block);
    if (review) {
      reviews.push(review);
    }
  }
  return reviews;
}

export function parseListaSpamHtml(body: string): Partial<SourceResult> | null {
  if (/Just a moment|Enable JavaScript and cookies to continue/i.test(body)) {
    return { status: 'blocked' };
  }

  const ownerHtml =
    /<span[^>]*class=["'][^"']*\bphone-owner\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(
      body,
    )?.[1];
  const label = ownerHtml ? cleanOwner(htmlToText(ownerHtml)) : undefined;
  const comments = extractCommentCount(body);
  const searches = extractSearches(body);
  const classifications = extractClassifications(body);
  const reviews = extractReviews(body);

  const detailParts: string[] = [];
  if (comments !== undefined) {
    detailParts.push(formatCount(comments, 'comment', 'comments'));
  }
  if (searches !== undefined) {
    detailParts.push(formatCount(searches, 'search', 'searches'));
  }
  detailParts.push(...classifications);
  const detail = detailParts.join(' · ');

  if (
    label === undefined &&
    comments === undefined &&
    searches === undefined &&
    reviews.length === 0
  ) {
    return null;
  }

  return {
    status: 'found',
    ...(label ? { label } : {}),
    ...(comments !== undefined ? { comments } : {}),
    ...(reviews.length > 0 ? { reviews } : {}),
    ...(detail ? { detail } : {}),
  };
}

async function loadListaSpamProxy(
  national9: string,
  signal: AbortSignal,
  fetchImpl: FetchLike,
): Promise<Partial<SourceResult> | null> {
  try {
    const { status, body } = await fetchText(
      buildListaSpamProxyUrl(national9),
      signal,
      fetchImpl,
      { 'user-agent': PROXY_UA },
    );
    if (status < 200 || status >= 300) {
      console.warn('ListaSpam proxy status', status);
      return null;
    }
    const parsed = parseListaSpamHtml(body);
    if (parsed === null || parsed.status === 'blocked') {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn(
      'ListaSpam proxy failed',
      error instanceof Error ? error.message : 'unknown',
    );
    return null;
  }
}

export function createListaSpamAdapter(fetchImpl: FetchLike = fetch): SourceAdapter {
  return {
    id: SOURCE_IDS.LISTASPAM,
    name: SOURCE_NAME,
    buildUrl: buildListaSpamUrl,
    lookup: async (national9, signal) => {
      const direct = await safeLookup(
        SOURCE_IDS.LISTASPAM,
        SOURCE_NAME,
        buildListaSpamUrl(national9),
        signal,
        parseListaSpamHtml,
        fetchImpl,
      );

      if (direct.status !== 'blocked' && direct.status !== 'failed') {
        return direct;
      }

      const proxied = await loadListaSpamProxy(national9, signal, fetchImpl);
      if (proxied === null) {
        return direct;
      }

      return {
        ...direct,
        ...proxied,
        status: proxied.status ?? 'found',
        url: buildListaSpamUrl(national9),
      };
    },
  };
}

export const listaspamAdapter = createListaSpamAdapter();
