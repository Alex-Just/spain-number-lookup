import {
  SPAIN_COUNTRY_CODE,
  SPAIN_NATIONAL_FIRST_DIGIT_MAX,
  SPAIN_NATIONAL_FIRST_DIGIT_MIN,
  SPAIN_NATIONAL_LENGTH,
} from './constants.ts';

export type NormalizedSpainNumber = {
  numberE164: string;
  numberNational: string;
};

const TRUECALLER_ES_PATH =
  /(?:truecaller\.com\/search\/es\/)(\d{9,15})/i;
const TEL_URI = /tel:([+\d().\-\s]+)/i;
const LOOSE_PLUS_CANDIDATE = /\+?\d[\d\s().-]{7,20}\d/g;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function isValidSpainNational(national: string): boolean {
  if (national.length !== SPAIN_NATIONAL_LENGTH) {
    return false;
  }
  const first = Number(national[0]);
  return (
    first >= SPAIN_NATIONAL_FIRST_DIGIT_MIN &&
    first <= SPAIN_NATIONAL_FIRST_DIGIT_MAX
  );
}

function toNormalized(national: string): NormalizedSpainNumber | null {
  if (!isValidSpainNational(national)) {
    return null;
  }
  return {
    numberE164: `+${SPAIN_COUNTRY_CODE}${national}`,
    numberNational: national,
  };
}

function nationalFromDigits(digits: string): string | null {
  if (digits.startsWith(SPAIN_COUNTRY_CODE) && digits.length === SPAIN_COUNTRY_CODE.length + SPAIN_NATIONAL_LENGTH) {
    return digits.slice(SPAIN_COUNTRY_CODE.length);
  }
  if (digits.length === SPAIN_NATIONAL_LENGTH) {
    return digits;
  }
  return null;
}

function firstValidFromMatches(matches: Iterable<string>): NormalizedSpainNumber | null {
  for (const match of matches) {
    const national = nationalFromDigits(digitsOnly(match));
    if (national === null) {
      continue;
    }
    const normalized = toNormalized(national);
    if (normalized !== null) {
      return normalized;
    }
  }
  return null;
}

/**
 * Extract one Spain number from share/paste text.
 * Prefer a Truecaller (or similar) /search/es/{digits} URL when present.
 */
export function extractSpainNumber(raw: string): NormalizedSpainNumber | null {
  const fromTruecaller = TRUECALLER_ES_PATH.exec(raw);
  if (fromTruecaller?.[1]) {
    const national = nationalFromDigits(fromTruecaller[1]);
    if (national !== null) {
      const normalized = toNormalized(national);
      if (normalized !== null) {
        return normalized;
      }
    }
  }

  const tel = TEL_URI.exec(raw);
  if (tel?.[1]) {
    const fromTel = firstValidFromMatches([tel[1]]);
    if (fromTel !== null) {
      return fromTel;
    }
  }

  const loose = raw.match(LOOSE_PLUS_CANDIDATE) ?? [];
  return firstValidFromMatches(loose);
}
