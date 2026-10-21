export const SPAIN_COUNTRY_CODE = '34';

/** Spain national numbers are 9 digits; v1 accepts first digit 4–9 (covers special 400… ranges). */
export const SPAIN_NATIONAL_LENGTH = 9;
export const SPAIN_NATIONAL_FIRST_DIGIT_MIN = 4;
export const SPAIN_NATIONAL_FIRST_DIGIT_MAX = 9;

export const LOOKUP_OVERALL_TIMEOUT_MS = 12_000;
export const SOURCE_TIMEOUT_MS = 5_000;

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 30;

export const SOURCE_IDS = {
  LISTASPAM: 'listaspam',
  TELLOWS: 'tellows',
  TELEDIGO: 'teledigo',
  RESPONDERONO: 'responderono',
  OPENSPAM: 'openspam',
  QUIENHALLAMADO: 'quienhallamado',
  TRUECALLER: 'truecaller',
} as const;

export type SourceId = (typeof SOURCE_IDS)[keyof typeof SOURCE_IDS];

export const SOURCE_ORDER: readonly SourceId[] = [
  SOURCE_IDS.LISTASPAM,
  SOURCE_IDS.TELLOWS,
  SOURCE_IDS.TELEDIGO,
  SOURCE_IDS.RESPONDERONO,
  SOURCE_IDS.OPENSPAM,
  SOURCE_IDS.QUIENHALLAMADO,
  SOURCE_IDS.TRUECALLER,
];

export const INVALID_NUMBER_ERROR = 'Invalid Spain phone number';
export const INVALID_BODY_ERROR = 'Invalid request body';
export const BODY_TOO_LARGE_ERROR = 'Request body too large';
export const RATE_LIMITED_ERROR = 'Too many lookups. Try again shortly.';
export const INTERNAL_ERROR = 'Unexpected error';

/** Share payloads are a few hundred bytes; anything larger is abuse. */
export const MAX_LOOKUP_BODY_BYTES = 8 * 1024;

export const SUMMARY_NO_MATCHES_HEADLINE =
  'No useful matches yet — open the source links or try again later.';
