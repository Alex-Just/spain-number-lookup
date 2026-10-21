import type { SourceResult, SourceStatus } from '../types.ts';

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

const DEFAULT_USER_AGENT =
  'SpainNumberLookup/1.0 (+https://github.com/Alex-Just/spain-number-lookup)';

export async function fetchText(
  url: string,
  signal: AbortSignal,
  fetchImpl: FetchLike = fetch,
): Promise<{ status: number; body: string }> {
  const response = await fetchImpl(url, {
    signal,
    headers: {
      'user-agent': DEFAULT_USER_AGENT,
      accept: 'text/html,application/json,*/*',
    },
    redirect: 'follow',
  });
  const body = await response.text();
  return { status: response.status, body };
}

export function statusFromHttp(httpStatus: number): SourceStatus {
  if (httpStatus === 403 || httpStatus === 401) {
    return 'blocked';
  }
  if (httpStatus === 404) {
    return 'empty';
  }
  if (httpStatus >= 200 && httpStatus < 300) {
    return 'found';
  }
  return 'failed';
}

export function baseResult(
  id: string,
  name: string,
  url: string,
  status: SourceStatus,
  extra: Partial<SourceResult> = {},
): SourceResult {
  return { id, name, url, status, ...extra };
}

export async function safeLookup(
  id: string,
  name: string,
  url: string,
  signal: AbortSignal,
  parseOk: (body: string) => Partial<SourceResult> | null,
  fetchImpl: FetchLike = fetch,
): Promise<SourceResult> {
  try {
    const { status, body } = await fetchText(url, signal, fetchImpl);
    if (status === 403 || status === 401) {
      return baseResult(id, name, url, 'blocked');
    }
    if (status === 404) {
      return baseResult(id, name, url, 'empty');
    }
    if (status < 200 || status >= 300) {
      return baseResult(id, name, url, 'failed', {
        detail: `HTTP ${status}`,
      });
    }
    const parsed = parseOk(body);
    if (parsed === null) {
      return baseResult(id, name, url, 'empty');
    }
    return baseResult(id, name, url, parsed.status ?? 'found', parsed);
  } catch (error) {
    if (signal.aborted) {
      return baseResult(id, name, url, 'failed', { detail: 'Timed out' });
    }
    const message = error instanceof Error ? error.message : 'Request failed';
    return baseResult(id, name, url, 'failed', { detail: message });
  }
}
