import {
  BODY_TOO_LARGE_ERROR,
  INTERNAL_ERROR,
  INVALID_BODY_ERROR,
  INVALID_NUMBER_ERROR,
  MAX_LOOKUP_BODY_BYTES,
  RATE_LIMITED_ERROR,
} from './constants.ts';
import { runLookup } from './lookup.ts';
import { RateLimiter } from './rate-limit.ts';
import { combineShareParams } from './share-params.ts';
import type { LookupError, LookupResult } from './types.ts';

export type Env = {
  ASSETS: Fetcher;
};

export type LookupFn = (raw: string) => Promise<LookupResult | LookupError>;

export type WorkerDeps = {
  lookup?: LookupFn;
  limiter?: RateLimiter;
};

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

type InputError = { ok: false; status: number; error: string };

type ReadInputResult = { ok: true; value: string } | InputError;

function invalidBody(): InputError {
  return { ok: false, status: 400, error: INVALID_BODY_ERROR };
}

function invalidNumber(): InputError {
  return { ok: false, status: 400, error: INVALID_NUMBER_ERROR };
}

function bodyTooLarge(): InputError {
  return { ok: false, status: 413, error: BODY_TOO_LARGE_ERROR };
}

function shareFieldsFrom(record: Record<string, unknown>) {
  const field = (value: unknown) => (typeof value === 'string' ? value : null);
  return {
    number: field(record.number),
    text: field(record.text),
    title: field(record.title),
    url: field(record.url),
  };
}

function shareFieldsFromForm(form: FormData) {
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : null;
  };
  return {
    number: field('number'),
    text: field('text'),
    title: field('title'),
    url: field('url'),
  };
}

type BodyReadResult = { ok: true; bytes: Uint8Array } | InputError;

async function readBody(request: Request): Promise<BodyReadResult> {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0) {
      return invalidBody();
    }
    if (length > MAX_LOOKUP_BODY_BYTES) {
      return bodyTooLarge();
    }
  }

  const stream = request.body;
  if (stream === null) {
    return { ok: true, bytes: new Uint8Array(0) };
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_LOOKUP_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return bodyTooLarge();
      }
      chunks.push(value);
    }
  } catch {
    return invalidBody();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes: body };
}

async function readLookupInput(request: Request, url: URL): Promise<ReadInputResult> {
  const fromQuery = combineShareParams({
    number: url.searchParams.get('number'),
    text: url.searchParams.get('text'),
    title: url.searchParams.get('title'),
    url: url.searchParams.get('url'),
  });
  if (fromQuery !== '') {
    return { ok: true, value: fromQuery };
  }

  if (request.method !== 'POST') {
    return invalidNumber();
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await readBody(request);
    if (!body.ok) {
      return body;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(body.bytes));
    } catch {
      return invalidBody();
    }
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return invalidBody();
    }
    const combined = combineShareParams(shareFieldsFrom(payload as Record<string, unknown>));
    return combined === '' ? invalidNumber() : { ok: true, value: combined };
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const body = await readBody(request);
    if (!body.ok) {
      return body;
    }
    let form: FormData;
    try {
      form = await new Request('https://lookup.invalid/', {
        method: 'POST',
        headers: { 'content-type': contentType },
        body: body.bytes,
      }).formData();
    } catch {
      return invalidBody();
    }
    const combined = combineShareParams(shareFieldsFromForm(form));
    return combined === '' ? invalidNumber() : { ok: true, value: combined };
  }

  return invalidNumber();
}

async function handleLookup(
  request: Request,
  url: URL,
  lookup: LookupFn,
  limiter: RateLimiter,
): Promise<Response> {
  if (!limiter.check(clientIp(request))) {
    return jsonResponse({ error: RATE_LIMITED_ERROR }, 429);
  }

  const input = await readLookupInput(request, url);
  if (!input.ok) {
    return jsonResponse({ error: input.error }, input.status);
  }

  const result = await lookup(input.value);
  if ('error' in result) {
    return jsonResponse(result, 400);
  }
  return jsonResponse(result, 200);
}

export function createWorker(deps: WorkerDeps = {}) {
  const limiter = deps.limiter ?? new RateLimiter();
  const lookup = deps.lookup ?? runLookup;

  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);

      if (url.pathname === '/api/lookup') {
        if (request.method !== 'GET' && request.method !== 'POST') {
          return jsonResponse({ error: 'Method not allowed' }, 405);
        }
        try {
          return await handleLookup(request, url, lookup, limiter);
        } catch (error) {
          console.error('Lookup request failed', error);
          return jsonResponse({ error: INTERNAL_ERROR }, 500);
        }
      }

      return env.ASSETS.fetch(request);
    },
  };
}

export default createWorker();
