import { SOURCE_IDS, SUMMARY_NO_MATCHES_HEADLINE } from './constants.ts';
import type { LookupSummary, SourceResult } from './types.ts';

function byId(sources: SourceResult[], id: string): SourceResult | undefined {
  return sources.find((source) => source.id === id);
}

/** A Tellows score alone is not a report; it needs a label or real comments. */
function tellowsHasCommunitySignal(tellows: SourceResult | undefined): boolean {
  if (!tellows) {
    return false;
  }
  return Boolean(tellows.label) || (tellows.comments ?? 0) > 0;
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

  if (tellows?.status === 'found' && tellowsHasCommunitySignal(tellows)) {
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
      return tellowsHasCommunitySignal(source);
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
