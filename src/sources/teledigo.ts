import { SOURCE_IDS } from '../constants.ts';
import type { SourceResult } from '../types.ts';
import { safeLookup, type FetchLike } from './http.ts';
import type { SourceAdapter } from './types.ts';

const SOURCE_NAME = 'Teledigo';
const ASSIGNED_TO =
  /asignado a\s+(.+?)\s+en fecha/i;

export function buildTeledigoUrl(national9: string): string {
  return `https://www.teledigo.com/${national9}`;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseTeledigoHtml(body: string): Partial<SourceResult> | null {
  const match = ASSIGNED_TO.exec(body);
  if (!match?.[1]) {
    return null;
  }
  const operator = stripHtml(match[1]);
  if (operator === '') {
    return null;
  }
  return {
    status: 'found',
    detail: `Assigned to ${operator}`,
  };
}

export function createTeledigoAdapter(fetchImpl: FetchLike = fetch): SourceAdapter {
  return {
    id: SOURCE_IDS.TELEDIGO,
    name: SOURCE_NAME,
    buildUrl: buildTeledigoUrl,
    lookup: (national9, signal) =>
      safeLookup(
        SOURCE_IDS.TELEDIGO,
        SOURCE_NAME,
        buildTeledigoUrl(national9),
        signal,
        parseTeledigoHtml,
        fetchImpl,
      ),
  };
}

export const teledigoAdapter = createTeledigoAdapter();
