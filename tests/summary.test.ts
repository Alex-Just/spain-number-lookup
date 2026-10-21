import { describe, expect, it } from 'vitest';
import { SOURCE_IDS } from '../src/constants.ts';
import { buildSummary } from '../src/summary.ts';
import type { SourceResult } from '../src/types.ts';

function source(
  partial: Pick<SourceResult, 'id' | 'name' | 'status'> &
    Partial<Omit<SourceResult, 'id' | 'name' | 'status'>>,
): SourceResult {
  return {
    url: `https://example.test/${partial.id}`,
    ...partial,
  };
}

describe('buildSummary', () => {
  it('prefers ListaSpam label over Teledigo operator', () => {
    const summary = buildSummary([
      source({
        id: SOURCE_IDS.LISTASPAM,
        name: 'ListaSpam',
        status: 'found',
        label: 'Llamadas comerciales',
      }),
      source({
        id: SOURCE_IDS.TELEDIGO,
        name: 'Teledigo',
        status: 'found',
        detail: 'Assigned to AIRE NETWORKS',
      }),
    ]);

    expect(summary.headline).toContain('Llamadas comerciales');
    expect(summary.confidence).toBe('medium');
  });

  it('uses Tellows when ListaSpam has no label and comments/label exist', () => {
    const summary = buildSummary([
      source({ id: SOURCE_IDS.LISTASPAM, name: 'ListaSpam', status: 'empty' }),
      source({
        id: SOURCE_IDS.TELLOWS,
        name: 'Tellows',
        status: 'found',
        score: 7,
        label: 'Telemarketing',
        detail: '2 comments',
      }),
    ]);

    expect(summary.headline).toMatch(/Tellows|Telemarketing|7/);
    expect(summary.confidence).toBe('medium');
  });

  it('does not let score-only Tellows drive medium confidence', () => {
    const summary = buildSummary([
      source({
        id: SOURCE_IDS.TELLOWS,
        name: 'Tellows',
        status: 'found',
        score: 5,
        detail: '0 comments',
      }),
      source({
        id: SOURCE_IDS.TELEDIGO,
        name: 'Teledigo',
        status: 'found',
        detail: 'Assigned to AIRE NETWORKS',
      }),
    ]);

    expect(summary.headline).toContain('AIRE NETWORKS');
    expect(summary.confidence).toBe('low');
  });

  it('falls back to Teledigo operator with low confidence', () => {
    const summary = buildSummary([
      source({
        id: SOURCE_IDS.TELEDIGO,
        name: 'Teledigo',
        status: 'found',
        detail: 'Assigned to AIRE NETWORKS DEL MEDITERRÁNEO',
      }),
    ]);

    expect(summary.headline).toContain('AIRE NETWORKS');
    expect(summary.confidence).toBe('low');
  });

  it('returns none when all empty failed or blocked', () => {
    const summary = buildSummary([
      source({ id: SOURCE_IDS.LISTASPAM, name: 'ListaSpam', status: 'blocked' }),
      source({ id: SOURCE_IDS.TELLOWS, name: 'Tellows', status: 'empty' }),
      source({ id: SOURCE_IDS.TELEDIGO, name: 'Teledigo', status: 'failed' }),
    ]);

    expect(summary.confidence).toBe('none');
    expect(summary.headline.toLowerCase()).toMatch(/no useful matches/);
  });
});
