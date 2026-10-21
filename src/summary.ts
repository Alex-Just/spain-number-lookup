import { SOURCE_IDS, SUMMARY_NO_MATCHES_HEADLINE } from './constants.ts';
import type { LookupSummary, SourceResult } from './types.ts';

function byId(sources: SourceResult[], id: string): SourceResult | undefined {
  return sources.find((source) => source.id === id);
}

export function buildSummary(sources: SourceResult[]): LookupSummary {
  const notes: string[] = [];
  const listaspam = byId(sources, SOURCE_IDS.LISTASPAM);
  const tellows = byId(sources, SOURCE_IDS.TELLOWS);
  const teledigo = byId(sources, SOURCE_IDS.TELEDIGO);

  if (listaspam?.status === 'found' && listaspam.label) {
    if (teledigo?.status === 'found' && teledigo.detail) {
      notes.push(teledigo.detail);
    }
    return {
      headline: `ListaSpam: ${listaspam.label}`,
      confidence: 'medium',
      notes,
    };
  }

  const tellowsHasCommunitySignal =
    Boolean(tellows?.label) ||
    (typeof tellows?.detail === 'string' && /\b[1-9]\d*\s+comments\b/i.test(tellows.detail));

  if (tellows?.status === 'found' && tellowsHasCommunitySignal) {
    const parts: string[] = [];
    if (tellows.label) {
      parts.push(tellows.label);
    }
    if (tellows.score !== undefined) {
      parts.push(`score ${tellows.score}`);
    }
    return {
      headline: `Tellows: ${parts.join(' · ')}`,
      confidence: 'medium',
      notes,
    };
  }

  if (teledigo?.status === 'found' && teledigo.detail) {
    return {
      headline: teledigo.detail,
      confidence: 'low',
      notes,
    };
  }

  const found = sources.filter((source) => {
    if (source.status !== 'found') {
      return false;
    }
    // Score-only Tellows is too weak to headline "who called".
    if (source.id === SOURCE_IDS.TELLOWS) {
      return Boolean(source.label) ||
        (typeof source.detail === 'string' && /\b[1-9]\d*\s+comments\b/i.test(source.detail));
    }
    return true;
  });
  if (found.length > 0) {
    const first = found[0];
    const text = first?.label ?? first?.detail ?? first?.name ?? 'Match found';
    return {
      headline: text,
      confidence: 'low',
      notes,
    };
  }

  return {
    headline: SUMMARY_NO_MATCHES_HEADLINE,
    confidence: 'none',
    notes,
  };
}
