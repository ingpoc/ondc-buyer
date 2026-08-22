import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));

function rewriteIndex(source) {
  return vercel.rewrites.findIndex((rule) => rule.source === source);
}

function rewriteFor(source) {
  return vercel.rewrites.find((rule) => rule.source === source);
}

describe('Vercel API routing', () => {
  it('proxies every /api path to gateway before the SPA shell', () => {
    const api = rewriteIndex('/api/:path*');
    const spa = rewriteIndex('/(.*)');
    expect(api).toBeGreaterThan(-1);
    expect(spa).toBeGreaterThan(-1);
    expect(api).toBeLessThan(spa);
    expect(rewriteFor('/api/:path*').destination).toBe(
      'https://gateway.aadharcha.in/api/:path*',
    );
  });

  it('does not leave commerce, cart, or payments on the Vite HTML fallback', () => {
    const destination = rewriteFor('/api/:path*').destination;
    expect(destination).toContain('gateway.aadharcha.in/api/');
    expect(destination).not.toBe('/index.html');
    for (const path of [
      '/api/cart/buyer',
      '/api/commerce/v1/payments/config',
      '/api/commerce/v1/buyer',
      '/api/demo-commerce/buyer/search',
    ]) {
      expect(path.startsWith('/api/')).toBe(true);
    }
  });
});
