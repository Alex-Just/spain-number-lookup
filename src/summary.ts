import { SOURCE_IDS, SUMMARY_NO_MATCHES_HEADLINE } from './constants.ts';
import { formatCount } from './format.ts';
import type { LookupSummary, SourceResult } from './types.ts';

function byId(sources: SourceResult[], id: string): SourceResult | undefined {
  return sources.find((source) => source.id === id);
}

/** A directory name or score alone is not a community report; comments are. */
function tellowsHasCommunitySignal(tellows: SourceResult | undefined): boolean {
  return (tellows?.comments ?? 0) > 0 || (tellows?.reviews?.length ?? 0) > 0;
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
      sourceId: SOURCE_IDS.LISTASPAM,
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
    if (tellows.comments !== undefined) {
      parts.push(formatCount(tellows.comments, 'comment', 'comments'));
    }
    return {
      headline: `Tellows: ${parts.join(' · ')}`,
      confidence: 'medium',
      sourceId: SOURCE_IDS.TELLOWS,
      notes,
    };
  }

  // A named owner is a better "who" lead than the carrier assignment below.
  if (tellows?.status === 'found' && tellows.label) {
    const parts = [tellows.label];
    if (tellows.score !== undefined) {
      parts.push(`score ${tellows.score}`);
    }
    return {
      headline: `Tellows: ${parts.join(' · ')}`,
      confidence: 'low',
      sourceId: SOURCE_IDS.TELLOWS,
      notes,
    };
  }

  if (teledigo?.status === 'found' && teledigo.detail) {
    return {
      headline: teledigo.detail,
      confidence: 'low',
      sourceId: SOURCE_IDS.TELEDIGO,
      notes,
    };
  }

  const found = sources.filter((source) => {
    if (source.status !== 'found') {
      return false;
    }
    // Score-only Tellows is too weak to headline "who called".
    if (source.id === SOURCE_IDS.TELLOWS) {
      return Boolean(source.label) || tellowsHasCommunitySignal(source);
    }
    return true;
  });
  if (found.length > 0) {
    const first = found[0];
    let text = 'Match found';
    if (first?.label) {
      text = `${first.name}: ${first.label}`;
    } else if (first?.detail) {
      text = first.detail;
    } else if (first?.name) {
      text = first.name;
    }
    return {
      headline: text,
      confidence: 'low',
      sourceId: first?.id,
      notes,
    };
  }

  return {
    headline: SUMMARY_NO_MATCHES_HEADLINE,
    confidence: 'none',
    notes,
  };
}
