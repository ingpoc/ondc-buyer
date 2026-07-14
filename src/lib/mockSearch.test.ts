import { describe, expect, it } from 'vitest';
import { resolveMockBuyerEndpoint } from './mockSearch';

describe('mock buyer search', () => {
  it('returns apples under default grocery category + apple query', () => {
    const result = resolveMockBuyerEndpoint('/api/search?category=grocery&q=apple') as {
      items: Array<{ id: string }>;
      totalCount: number;
    };
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.items.some((item) => item.id === 'fresh-apples-1kg')).toBe(true);
  });

  it('returns empty for unknown product query', () => {
    const result = resolveMockBuyerEndpoint('/api/search?category=grocery&q=xyznope') as {
      totalCount: number;
    };
    expect(result.totalCount).toBe(0);
  });

  it('returns milk under grocery category', () => {
    const result = resolveMockBuyerEndpoint('/api/search?category=grocery&q=milk') as {
      items: Array<{ id: string; price: { value: string } }>;
      totalCount: number;
    };
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.items.some((item) => item.id === 'toned-milk-1l')).toBe(true);
    expect(result.items.every((item) => Number(item.price.value) < 100)).toBe(true);
  });
});
