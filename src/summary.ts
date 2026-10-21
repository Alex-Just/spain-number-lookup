import { SOURCE_IDS, SUMMARY_NO_MATCHES_HEADLINE } from './constants.ts';
import { formatCount } from './format.ts';
import type { LookupSummary, SourceResult } from './types.ts';

function byId(sources: SourceResult[], id: string): SourceResult | undefined {
  return sources.find((source) => source.id === id);
}

/** A directory name or score alone is not a community report; comments are. */
function tellowsHasCommunitySignal(tellows: SourceResult | undefined): boolean {
  return (tellows?.comments ?? 0) > 0;
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
    parts.push(formatCount(tellows.comments ?? 0, 'comment', 'comments'));
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
    // Tellows without comments is too weak to headline "who called".
    if (source.id === SOURCE_IDS.TELLOWS) {
      return tellowsHasCommunitySignal(source);
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
      notes,
    };
  }

  return {
    headline: SUMMARY_NO_MATCHES_HEADLINE,
    confidence: 'none',
    notes,
  };
}
