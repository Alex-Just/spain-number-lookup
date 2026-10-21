export type ShareParamFields = {
  number?: string | null;
  text?: string | null;
  title?: string | null;
  url?: string | null;
};

/**
 * Merge Android / Web Share Target fields so a Truecaller URL in `url`
 * is not dropped when `text` is only boilerplate.
 */
export function combineShareParams(fields: ShareParamFields): string {
  const number = fields.number?.trim() ?? '';
  if (number !== '') {
    return number;
  }

  const parts = [fields.text, fields.title, fields.url]
    .map((value) => value?.trim() ?? '')
    .filter((value) => value !== '');

  return [...new Set(parts)].join('\n');
}
