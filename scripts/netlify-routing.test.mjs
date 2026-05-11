import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const netlifyToml = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8');

function indexOfRedirect(fromPath) {
  return netlifyToml.indexOf(`from = "${fromPath}"`);
}

describe('netlify routing order', () => {
  it('routes fallback API proxy before the SPA catch-all', () => {
    expect(indexOfRedirect('/api/*')).toBeGreaterThan(-1);
    expect(indexOfRedirect('/*')).toBeGreaterThan(-1);
    expect(indexOfRedirect('/api/*')).toBeLessThan(indexOfRedirect('/*'));
  });

  it('routes protected checkout before the fallback API proxy', () => {
    expect(indexOfRedirect('/api/checkout')).toBeGreaterThan(-1);
    expect(indexOfRedirect('/api/checkout')).toBeLessThan(indexOfRedirect('/api/*'));
  });
});
