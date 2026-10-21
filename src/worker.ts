import {
  INVALID_NUMBER_ERROR,
  RATE_LIMITED_ERROR,
} from './constants.ts';
import { runLookup } from './lookup.ts';
import { RateLimiter } from './rate-limit.ts';
import { combineShareParams } from './share-params.ts';

export type Env = {
  ASSETS: Fetcher;
};

const limiter = new RateLimiter();

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
} as const;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

async function readLookupInput(request: Request, url: URL): Promise<string | null> {
  const fromQuery = combineShareParams({
    number: url.searchParams.get('number'),
    text: url.searchParams.get('text'),
    title: url.searchParams.get('title'),
    url: url.searchParams.get('url'),
  });
  if (fromQuery !== '') {
    return fromQuery;
  }

  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = (await request.json()) as {
        number?: unknown;
        text?: unknown;
        title?: unknown;
        url?: unknown;
      };
      const combined = combineShareParams({
        number: typeof payload.number === 'string' ? payload.number : null,
        text: typeof payload.text === 'string' ? payload.text : null,
        title: typeof payload.title === 'string' ? payload.title : null,
        url: typeof payload.url === 'string' ? payload.url : null,
      });
      if (combined !== '') {
        return combined;
      }
    }
    if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const form = await request.formData();
      const combined = combineShareParams({
        number: typeof form.get('number') === 'string' ? String(form.get('number')) : null,
        text: typeof form.get('text') === 'string' ? String(form.get('text')) : null,
        title: typeof form.get('title') === 'string' ? String(form.get('title')) : null,
        url: typeof form.get('url') === 'string' ? String(form.get('url')) : null,
      });
      if (combined !== '') {
        return combined;
      }
    }
  }

  return null;
}

async function handleLookup(request: Request, url: URL): Promise<Response> {
  if (!limiter.check(clientIp(request))) {
    return jsonResponse({ error: RATE_LIMITED_ERROR }, 429);
  }

  const raw = await readLookupInput(request, url);
  if (raw === null) {
    return jsonResponse({ error: INVALID_NUMBER_ERROR }, 400);
  }

  const result = await runLookup(raw);
  if ('error' in result) {
    return jsonResponse(result, 400);
  }
  return jsonResponse(result, 200);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/lookup') {
      if (request.method !== 'GET' && request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
      }
      return handleLookup(request, url);
    }

    return env.ASSETS.fetch(request);
  },
};
