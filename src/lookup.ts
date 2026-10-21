import {
  INVALID_NUMBER_ERROR,
  LOOKUP_OVERALL_TIMEOUT_MS,
  SOURCE_TIMEOUT_MS,
} from './constants.ts';
import { extractSpainNumber } from './normalize.ts';
import { adapters as defaultAdapters } from './sources/index.ts';
import type { SourceAdapter } from './sources/types.ts';
import { buildSummary } from './summary.ts';
import type {
  LookupError,
  LookupResult,
  SourceResult,
  SourceStatus,
} from './types.ts';

const SOURCE_STATUS_RANK: Record<SourceStatus, number> = {
  found: 0,
  blocked: 1,
  failed: 2,
  empty: 3,
};

export type RunLookupOptions = {
  adapters?: SourceAdapter[];
  overallTimeoutMs?: number;
  sourceTimeoutMs?: number;
};

function withTimeoutSignal(
  parent: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onParentAbort = () => controller.abort();
  parent?.addEventListener('abort', onParentAbort, { once: true });

  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onParentAbort);
    },
  };
}

async function runAdapter(
  adapter: SourceAdapter,
  national9: string,
  parentSignal: AbortSignal,
  sourceTimeoutMs: number,
): Promise<SourceResult> {
  const { signal, cancel } = withTimeoutSignal(parentSignal, sourceTimeoutMs);
  try {
    return await adapter.lookup(national9, signal);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Adapter failed';
    return {
      id: adapter.id,
      name: adapter.name,
      url: adapter.buildUrl(national9),
      status: 'failed',
      detail,
    };
  } finally {
    cancel();
  }
}

export async function runLookup(
  rawInput: string,
  options: RunLookupOptions = {},
): Promise<LookupResult | LookupError> {
  const normalized = extractSpainNumber(rawInput);
  if (normalized === null) {
    return { error: INVALID_NUMBER_ERROR };
  }

  const adapters = options.adapters ?? defaultAdapters;
  const overallTimeoutMs = options.overallTimeoutMs ?? LOOKUP_OVERALL_TIMEOUT_MS;
  const sourceTimeoutMs = options.sourceTimeoutMs ?? SOURCE_TIMEOUT_MS;

  const overall = withTimeoutSignal(undefined, overallTimeoutMs);
  try {
    const settled = await Promise.all(
      adapters.map((adapter) =>
        runAdapter(adapter, normalized.numberNational, overall.signal, sourceTimeoutMs),
      ),
    );

    const summary = buildSummary(settled);
    const sources = settled
      .map((source, index) => ({ source, index }))
      .sort((a, b) => {
        const rank =
          SOURCE_STATUS_RANK[a.source.status] - SOURCE_STATUS_RANK[b.source.status];
        return rank !== 0 ? rank : a.index - b.index;
      })
      .map(({ source }) => source);

    return {
      numberE164: normalized.numberE164,
      numberNational: normalized.numberNational,
      summary,
      sources,
    };
  } finally {
    overall.cancel();
  }
}
