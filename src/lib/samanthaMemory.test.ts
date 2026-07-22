import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptySamanthaMemory,
  loadSamanthaMemoryMerged,
  relevantSearchPreferences,
  saveSamanthaMemory,
} from './samanthaMemory';

describe('Samantha memory principal isolation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not merge another principal memory into a new principal or guest', () => {
    saveSamanthaMemory('principal:auth0:a', {
      ...emptySamanthaMemory(),
      preferences: ['Deliver to Indiranagar'],
    });

    expect(loadSamanthaMemoryMerged('principal:auth0:a').preferences).toEqual([
      'Deliver to Indiranagar',
    ]);
    expect(loadSamanthaMemoryMerged('principal:auth0:b').preferences).toEqual([]);
    expect(loadSamanthaMemoryMerged(null).preferences).toEqual([]);
  });

  it('does not persist guest memory', () => {
    saveSamanthaMemory(null, {
      ...emptySamanthaMemory(),
      notes: ['private'],
    });
    expect(localStorage.length).toBe(0);
  });

  it('notifies an open settings view after authenticated memory changes', () => {
    const listener = vi.fn();
    window.addEventListener('buyer-samantha-memory-changed', listener);

    saveSamanthaMemory('principal:demo:buyer', {
      ...emptySamanthaMemory(),
      preferences: ['Use unpolished groceries'],
    });

    expect(listener).toHaveBeenCalledOnce();
    expect(loadSamanthaMemoryMerged('principal:demo:buyer').preferences).toEqual([
      'Use unpolished groceries',
    ]);
    window.removeEventListener('buyer-samantha-memory-changed', listener);
  });
});

describe('query-relevant Samantha preferences', () => {
  it('applies matching product preferences and global shopping constraints only', () => {
    const filters = relevantSearchPreferences(
      {
        likes: ['Organic unpolished toor dal', 'Jazz music'],
        dislikes: [],
        preferences: ['Keep groceries under INR 200', 'Deliver to Pune'],
        notes: [],
        updatedAt: '2026-07-17T00:00:00Z',
      },
      'toor dal',
    );

    expect(filters).toMatchObject({
      maxPrice: 200,
      deliveryArea: 'Pune',
      preferenceTerms: ['organic', 'unpolished'],
    });
    expect(filters.appliedLabels).not.toContain('Jazz music');
  });

  it('does not apply an unrelated product like', () => {
    const filters = relevantSearchPreferences(
      {
        likes: ['Organic coffee'],
        dislikes: [],
        preferences: [],
        notes: [],
        updatedAt: '2026-07-17T00:00:00Z',
      },
      'toor dal',
    );

    expect(filters.preferenceTerms).toEqual([]);
    expect(filters.appliedLabels).toEqual([]);
  });

  it('applies a grocery-wide qualifier to an item where the qualifier is meaningful', () => {
    const filters = relevantSearchPreferences(
      {
        likes: [],
        dislikes: [],
        preferences: ['I prefer unpolished groceries', 'Deliver to Pune'],
        notes: [],
        updatedAt: '2026-07-17T00:00:00Z',
      },
      'toor dal',
    );

    expect(filters.preferenceTerms).toEqual(['unpolished']);
    expect(filters.appliedLabels).toContain('Prefer unpolished');
  });
});
