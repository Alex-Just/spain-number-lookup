import type { SourceResult } from '../types.ts';

export type SourceAdapter = {
  id: string;
  name: string;
  buildUrl: (national9: string) => string;
  lookup: (national9: string, signal: AbortSignal) => Promise<SourceResult>;
};
