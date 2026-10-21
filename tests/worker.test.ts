import { describe, expect, it, vi } from 'vitest';
import { MAX_LOOKUP_BODY_BYTES } from '../src/constants.ts';
import { RateLimiter } from '../src/rate-limit.ts';
import type { LookupResult } from '../src/types.ts';
import { createWorker, type Env } from '../src/worker.ts';

const env = {
  ASSETS: {
    fetch: async () => new Response('asset', { status: 200 }),
  },
} as unknown as Env;

function resultFor(raw: string): LookupResult {
  return {
    numberE164: '+34600000000',
    numberNational: raw,
    summary: { headline: 'stub', confidence: 'none', notes: [] },
    sources: [],
  };
}

function makeWorker() {
  const calls: string[] = [];
  const worker = createWorker({
    limiter: new RateLimiter({ maxRequests: 1000 }),
    lookup: async (raw) => {
      calls.push(raw);
      return resultFor(raw);
    },
  });
  return { worker, calls };
}

function request(path: string, init?: RequestInit): Request {
  return new Request(`https://app.test${path}`, init);
}

describe('GET /api/lookup', () => {
  it('returns the lookup result and passes the number query param', async () => {
    const { worker, calls } = makeWorker();

    const response = await worker.fetch(request('/api/lookup?number=600000000'), env);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as LookupResult;
    expect(body.numberE164).toBe('+34600000000');
    expect(calls).toEqual(['600000000']);
  });
});

describe('POST /api/lookup', () => {
  it('accepts a JSON number and matches the GET path', async () => {
    const { worker, calls } = makeWorker();

    const response = await worker.fetch(
      request('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ number: '600000000' }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual(['600000000']);
  });

  it('merges share text and url server-side', async () => {
    const { worker, calls } = makeWorker();

    const response = await worker.fetch(
      request('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: 'sent using Truecaller',
          url: 'https://truecaller.com/search/es/34400300429',
        }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      'sent using Truecaller\nhttps://truecaller.com/search/es/34400300429',
    ]);
  });

  it('accepts a URL-encoded share form', async () => {
    const { worker, calls } = makeWorker();
    const form = new URLSearchParams({ text: 'Missed call', number: '600000000' });

    const response = await worker.fetch(
      request('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual(['600000000']);
  });
});

describe('POST /api/lookup malformed bodies', () => {
  it('rejects malformed JSON with a 400 JSON error', async () => {
    const { worker, calls } = makeWorker();

    const response = await worker.fetch(
      request('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"number":',
      }),
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid request body' });
    expect(calls).toEqual([]);
  });

  it('rejects a JSON null body with a 400 JSON error', async () => {
    const { worker, calls } = makeWorker();

    const response = await worker.fetch(
      request('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'null',
      }),
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid request body' });
    expect(calls).toEqual([]);
  });

  it('rejects an empty JSON body with a 400 JSON error', async () => {
    const { worker, calls } = makeWorker();

    const response = await worker.fetch(
      request('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '',
      }),
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid request body' });
    expect(calls).toEqual([]);
  });

  it('rejects malformed multipart bodies with a 400 JSON error', async () => {
    const { worker, calls } = makeWorker();

    const response = await worker.fetch(
      request('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=missing' },
        body: 'not a multipart body',
      }),
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid request body' });
    expect(calls).toEqual([]);
  });

  it('accepts a multipart share form', async () => {
    const { worker, calls } = makeWorker();
    const form = new FormData();
    form.set('text', 'Missed call');
    form.set('url', 'https://truecaller.com/search/es/34400300429');

    const response = await worker.fetch(
      request('/api/lookup', { method: 'POST', body: form }),
      env,
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      'Missed call\nhttps://truecaller.com/search/es/34400300429',
    ]);
  });
});

describe('request body limit', () => {
  it('rejects a body larger than the limit with a 413 JSON error', async () => {
    const { worker, calls } = makeWorker();

    const response = await worker.fetch(
      request('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'x'.repeat(MAX_LOOKUP_BODY_BYTES + 1),
      }),
      env,
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Request body too large' });
    expect(calls).toEqual([]);
  });

  it('rejects an oversized streamed body with no Content-Length', async () => {
    const { worker, calls } = makeWorker();
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"text":"'));
        controller.enqueue(encoder.encode('x'.repeat(MAX_LOOKUP_BODY_BYTES)));
        controller.enqueue(encoder.encode('"}'));
        controller.close();
      },
    });

    const streamed = new Request('https://app.test/api/lookup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stream,
      duplex: 'half',
    } as RequestInit);

    const response = await worker.fetch(streamed, env);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Request body too large' });
    expect(calls).toEqual([]);
  });
});

describe('failures and limits', () => {
  it('returns a JSON 500 when the lookup throws', async () => {
    const worker = createWorker({
      limiter: new RateLimiter({ maxRequests: 1000 }),
      lookup: async () => {
        throw new Error('boom');
      },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await worker.fetch(request('/api/lookup?number=600000000'), env);

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Unexpected error' });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns 429 once the rate limit is exhausted', async () => {
    const worker = createWorker({
      limiter: new RateLimiter({ maxRequests: 1 }),
      lookup: async (raw) => resultFor(raw),
    });

    const first = await worker.fetch(request('/api/lookup?number=600000000'), env);
    const second = await worker.fetch(request('/api/lookup?number=600000000'), env);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(await second.json()).toEqual({
      error: 'Too many lookups. Try again shortly.',
    });
  });
});

describe('routing', () => {
  it('rejects unsupported methods with 405', async () => {
    const { worker } = makeWorker();

    const response = await worker.fetch(request('/api/lookup', { method: 'DELETE' }), env);

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'Method not allowed' });
  });

  it('serves non-API paths from the assets binding', async () => {
    const assets = vi.fn(async () => new Response('asset', { status: 200 }));
    const worker = createWorker({
      limiter: new RateLimiter({ maxRequests: 1000 }),
      lookup: async (raw) => resultFor(raw),
    });

    const response = await worker.fetch(
      request('/'),
      { ASSETS: { fetch: assets } } as unknown as Env,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('asset');
    expect(assets).toHaveBeenCalledTimes(1);
  });
});
