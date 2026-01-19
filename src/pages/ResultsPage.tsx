import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSearch, useCart } from '../hooks';
import { SearchBar, FilterSidebar, ResultGrid } from '../components';
import type { UCPItem } from '../types';
import type { SearchFilters } from '../components/FilterSidebar';
import { PageLayout, PageHeader, DRAMS, SPACING, TYPOGRAPHY, BUTTON, LAYOUT, CARD } from '@ondc-sdk/shared/design-system';

interface SearchResponse {
  items: UCPItem[];
  totalCount: number;
}

const LOADING_STYLE = {
  ...LAYOUT.gridFilters,
  display: 'flex' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: SPACING['3xl'],
  color: DRAMS.textLight,
  ...TYPOGRAPHY.body,
};

const ERROR_STYLE = {
  ...CARD.base,
  backgroundColor: '#fef2f2',
  borderColor: '#fecaca',
  color: '#dc2626',
};

export function ResultsPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const category = searchParams.get('category') ?? 'grocery';
  const query = searchParams.get('q') ?? undefined;
  const { addToCart } = useCart();

  const [filters, setFilters] = useState<SearchFilters>({});

  const { data, loading, error, execute } = useSearch(category, {
    query,
    preferences: {
      priceRange: filters.maxPrice ? { max: filters.maxPrice } : undefined,
      minRating: filters.minRating,
      sortBy: filters.sortBy as any,
    },
  });

  useEffect(() => {
    execute();
  }, [execute, filters, query, category]);

  function handleSearch(cat: string, q: string): void {
    navigate(`/results?category=${cat}&q=${encodeURIComponent(q)}`);
  }

  function handleItemClick(item: UCPItem): void {
    navigate(`/product/${item.id}`);
  }

  async function handleAddToCart(item: UCPItem): Promise<void> {
    try {
      await addToCart(item as any);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    }
  }

  if (loading && !data) {
    return (
      <PageLayout>
        <div style={LOADING_STYLE}>
          Loading results...
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div style={ERROR_STYLE}>
          <p style={{ margin: 0, fontWeight: TYPOGRAPHY.label.fontWeight }}>Error</p>
          <p style={{ margin: `${SPACING.xs} 0 ${SPACING.md} 0` }}>{error}</p>
          <button
            onClick={() => navigate('/')}
            style={BUTTON.secondary}
          >
            Back to Search
          </button>
        </div>
      </PageLayout>
    );
  }

  const items = (data as SearchResponse | null)?.items ?? [];

  return (
    <PageLayout>
      {/* Search Bar Section */}
      <div style={{ marginBottom: SPACING.xl }}>
        <SearchBar
          onSearch={handleSearch}
          defaultCategory={category}
          defaultQuery={query ?? ''}
        />
      </div>

      {/* Results Section using GRID system */}
      <div style={LAYOUT.gridFilters}>
        <FilterSidebar filters={filters} onChange={setFilters} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <PageHeader
            title={`Results for "${query || category}" (${items.length} items)`}
          />
          <ResultGrid
            items={items}
            onItemClick={handleItemClick}
            onAddToCart={handleAddToCart}
            loading={loading}
          />
        </div>
      </div>
    </PageLayout>
  );
}
