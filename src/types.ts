export type Confidence = 'high' | 'medium' | 'low' | 'none';

export type SourceStatus = 'found' | 'empty' | 'failed' | 'blocked';

export type SourceReview = {
  text: string;
  author?: string;
  date?: string;
  score?: number;
  classification?: string;
};

export type SourceResult = {
  id: string;
  name: string;
  status: SourceStatus;
  label?: string;
  detail?: string;
  score?: number;
  comments?: number;
  reviews?: SourceReview[];
  url: string;
};

export type LookupSummary = {
  headline: string;
  confidence: Confidence;
  sourceId?: string;
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
