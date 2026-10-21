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

  it('uses Tellows when ListaSpam has no label and comments exist', () => {
    const summary = buildSummary([
      source({ id: SOURCE_IDS.LISTASPAM, name: 'ListaSpam', status: 'empty' }),
      source({
        id: SOURCE_IDS.TELLOWS,
        name: 'Tellows',
        status: 'found',
        score: 7,
        comments: 2,
        label: 'Telemarketing',
        detail: '2 comments',
      }),
    ]);

    expect(summary.headline).toMatch(/Tellows|Telemarketing|7/);
    expect(summary.headline).toContain('2 comments');
    expect(summary.confidence).toBe('medium');
  });

  it('headlines a named Tellows caller when comments exist', () => {
    const summary = buildSummary([
      source({
        id: SOURCE_IDS.TELLOWS,
        name: 'Tellows',
        status: 'found',
        score: 7,
        comments: 2,
        label: 'Lucía Llanos Fisioterapia',
        detail: '2 comments · 38 searches',
      }),
    ]);

    expect(summary.confidence).toBe('medium');
    expect(summary.headline).toContain('Lucía Llanos Fisioterapia');
    expect(summary.headline).toContain('2 comments');
  });

  it('does not headline a zero-comment Tellows name when it is the only found source', () => {
    const summary = buildSummary([
      source({
        id: SOURCE_IDS.TELLOWS,
        name: 'Tellows',
        status: 'found',
        score: 2,
        comments: 0,
        label: 'PETRA PARRAGA BAESA',
        detail: '0 comments · 1 search',
      }),
    ]);

    expect(summary.confidence).toBe('none');
    expect(summary.headline.toLowerCase()).toMatch(/no useful matches/);
    expect(summary.headline).not.toContain('PETRA');
  });

  it('attributes another source instead of the zero-comment Tellows name', () => {
    const summary = buildSummary([
      source({
        id: SOURCE_IDS.TELLOWS,
        name: 'Tellows',
        status: 'found',
        score: 2,
        comments: 0,
        label: 'PETRA PARRAGA BAESA',
      }),
      source({
        id: SOURCE_IDS.RESPONDERONO,
        name: 'ResponderONo',
        status: 'found',
        label: 'NEGATIVA',
      }),
    ]);

    expect(summary.confidence).toBe('low');
    expect(summary.headline).toBe('ResponderONo: NEGATIVA');
    expect(summary.headline).not.toContain('PETRA');
  });

  it('uses Tellows comment count as the community signal without a label', () => {
    const summary = buildSummary([
      source({ id: SOURCE_IDS.LISTASPAM, name: 'ListaSpam', status: 'empty' }),
      source({
        id: SOURCE_IDS.TELLOWS,
        name: 'Tellows',
        status: 'found',
        score: 7,
        comments: 2,
        detail: '2 comments · 3 searches',
      }),
    ]);

    expect(summary.confidence).toBe('medium');
    expect(summary.headline).toContain('Tellows');
  });

  it('treats a single comment as enough community signal', () => {
    const summary = buildSummary([
      source({
        id: SOURCE_IDS.TELLOWS,
        name: 'Tellows',
        status: 'found',
        score: 6,
        comments: 1,
        detail: '1 comment',
      }),
    ]);

    expect(summary.confidence).toBe('medium');
    expect(summary.headline).toContain('1 comment');
    expect(summary.headline).not.toContain('1 comments');
  });

  it('ignores display-only detail when structured comments are absent', () => {
    const summary = buildSummary([
      source({
        id: SOURCE_IDS.TELLOWS,
        name: 'Tellows',
        status: 'found',
        score: 7,
        detail: '2 comments',
      }),
    ]);

    expect(summary.confidence).toBe('none');
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

  it('does not headline score-only Tellows when it is the only found source', () => {
    const summary = buildSummary([
      source({
        id: SOURCE_IDS.TELLOWS,
        name: 'Tellows',
        status: 'found',
        score: 5,
        detail: '0 comments · 1 search',
      }),
    ]);

    expect(summary.confidence).toBe('none');
    expect(summary.headline.toLowerCase()).toMatch(/no useful matches/);
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
