import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTeledigoHtml } from '../src/sources/teledigo.ts';

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'fixtures/teledigo.html'),
  'utf8',
);

describe('parseTeledigoHtml', () => {
  it('extracts operator assignment', () => {
    const parsed = parseTeledigoHtml(fixture);
    expect(parsed.status).toBe('found');
    expect(parsed.detail).toMatch(/AIRE NETWORKS/);
  });
});
