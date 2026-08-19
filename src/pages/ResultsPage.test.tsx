import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  applyBuyerSearchFilters,
  filtersFromSearchParams,
  ResultsPage,
  searchParamsWithFilters,
} from './ResultsPage';

vi.mock('../hooks', () => ({
  useCart: () => ({ addToCart: vi.fn() }),
  useAuth: () => ({ isAuthenticated: true }),
  useSubject: () => ({ subjectId: 'principal:buyer:test', principalId: 'principal:buyer:test' }),
  useSearch: () => ({
    data: { items: [], totalCount: 0 },
    loading: false,
    error: null,
    execute: vi.fn(),
  }),
}));

describe('ResultsPage zero-result recovery', () => {
  it('offers an immediate browse action without presenting an unrelated product as a match', () => {
    render(
      <MemoryRouter initialEntries={['/results?category=grocery&q=rice']}>
        <ResultsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('No exact matches for “rice”')).toBeInTheDocument();
    expect(screen.getByText('Adjust the search or filters to find an available offer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse available groceries' })).toBeInTheDocument();
  });
});

describe('customer search filters', () => {
  it('parses Samantha filters from the visible results URL', () => {
    expect(
      filtersFromSearchParams(
        new URLSearchParams('max_price=200&delivery_area=Pune&preference=organic,unpolished'),
      ),
    ).toMatchObject({
      maxPrice: 200,
      location: 'Pune',
      preferenceTerms: ['organic', 'unpolished'],
    });
  });

  it('applies serviceability and relevant terms without hiding all offers for an unsupported term', () => {
    const source = [
      {
        id: 'dal-1',
        name: 'Unpolished Toor Dal',
        description: 'Everyday unpolished dal',
        price: { currency: 'INR', value: '149' },
        images: [],
        deliveryAreas: ['Pune', '411001'],
      },
    ];

    expect(
      applyBuyerSearchFilters(source, { location: 'Pune', preferenceTerms: ['unpolished'] }).items,
    ).toHaveLength(1);
    const unsupported = applyBuyerSearchFilters(source, {
      location: 'Pune',
      preferenceTerms: ['organic'],
    });
    expect(unsupported.items).toHaveLength(1);
    expect(unsupported.unappliedPreferenceTerms).toEqual(['organic']);
  });

  it('keeps unrestricted catalog items when a saved delivery area is set', () => {
    const source = [
      {
        id: 'tv-1',
        name: 'Catalog Marker Horizon LED TV 32',
        price: { currency: 'INR', value: '12999' },
        images: [],
        deliveryAreas: [],
      },
      {
        id: 'oil-1',
        name: 'Groundnut Oil 1L',
        price: { currency: 'INR', value: '320' },
        images: [],
        deliveryAreas: ['Mumbai'],
      },
    ];
    const kept = applyBuyerSearchFilters(source, { location: 'Pune' }).items;
    expect(kept.map((item) => item.id)).toEqual(['tv-1']);
  });

  it('removes cleared Samantha preferences from the visible URL', () => {
    const params = searchParamsWithFilters(
      new URLSearchParams('category=grocery&q=toor+dal&delivery_area=Pune&preference=unpolished'),
      { location: 'Pune', preferenceTerms: [] },
    );
    expect(params.get('q')).toBe('toor dal');
    expect(params.get('delivery_area')).toBe('Pune');
    expect(params.has('preference')).toBe(false);
  });
});
