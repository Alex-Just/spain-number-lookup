import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTellowsJson } from '../src/sources/tellows.ts';

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'fixtures/tellows.json'),
  'utf8',
);

describe('parseTellowsJson', () => {
  it('reads score from tellows JSON body', () => {
    const parsed = parseTellowsJson(fixture);
    expect(parsed.score).toBe(5);
    expect(parsed.status).toBe('found');
  });

  it('tolerates trailing partner noise after JSON', () => {
    const parsed = parseTellowsJson(`${fixture.trim()}Partner Data not correct`);
    expect(parsed.score).toBe(5);
    expect(parsed.status).toBe('found');
  });

  it('exposes the comment count as a structured field', () => {
    const parsed = parseTellowsJson(
      JSON.stringify({ tellows: { score: '6', comments: '2', searches: '9' } }),
    );
    expect(parsed.comments).toBe(2);
  });

  it('defaults comments to zero when the field is missing', () => {
    const parsed = parseTellowsJson(JSON.stringify({ tellows: { score: '6' } }));
    expect(parsed.comments).toBe(0);
  });
});
