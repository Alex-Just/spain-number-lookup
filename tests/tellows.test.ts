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
});
