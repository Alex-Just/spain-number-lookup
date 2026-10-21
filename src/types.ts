export type Confidence = 'high' | 'medium' | 'low' | 'none';

export type SourceStatus = 'found' | 'empty' | 'failed' | 'blocked';

export type SourceResult = {
  id: string;
  name: string;
  status: SourceStatus;
  label?: string;
  detail?: string;
  score?: number;
  url: string;
};

export type LookupSummary = {
  headline: string;
  confidence: Confidence;
  notes: string[];
};

export type LookupResult = {
  numberE164: string;
  numberNational: string;
  summary: LookupSummary;
  sources: SourceResult[];
};

export type LookupError = {
  error: string;
};
