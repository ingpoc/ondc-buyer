import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  AsyncState,
  Badge,
  Button,
  Card,
  PageLayout,
  Section,
  StatCard,
} from '@portfolio-ui';
import { useSearch, useCart } from '../hooks';
import { SearchBar, FilterSidebar, ResultGrid } from '../components';
import type { UCPItem } from '../types';
import type { SearchFilters } from '../components/FilterSidebar';

interface SearchResponse {
  items: UCPItem[];
  totalCount: number;
}

function countActiveFilters(filters: SearchFilters) {
  return [
    filters.maxPrice !== undefined,
    filters.minRating !== undefined,
    Boolean(filters.location),
    Boolean(filters.sortBy && filters.sortBy !== 'relevance'),
  ].filter(Boolean).length;
}

export function ResultsPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const category = searchParams.get('category') ?? 'grocery';
  const query = searchParams.get('q') ?? '';
  const { addToCart } = useCart();
  const [filters, setFilters] = useState<SearchFilters>({});

  const activeFilterCount = countActiveFilters(filters);
  const resultLabel = query || category;
  const preferences = useMemo(
    () => ({
      priceRange: filters.maxPrice ? { max: filters.maxPrice } : undefined,
      minRating: filters.minRating,
      sortBy: filters.sortBy as any,
    }),
    [filters.maxPrice, filters.minRating, filters.sortBy]
  );

  const { data, loading, error, execute } = useSearch(category, {
    query: query || undefined,
    preferences,
  });

  useEffect(() => {
    void execute();
  }, [execute]);

  function handleSearch(nextCategory: string, nextQuery: string): void {
    navigate(`/results?category=${nextCategory}&q=${encodeURIComponent(nextQuery)}`);
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

  const items = (data as SearchResponse | null)?.items ?? [];

  if (loading && !data) {
    return (
      <PageLayout>
        <AsyncState
          kind="loading"
          title="Searching the network"
          description="Pulling the latest offers for your selected category."
        />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <AsyncState
          kind="error"
          title="Unable to load results"
          description={error}
          action={
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={() => navigate('/search')}>
                Back to search
              </Button>
              <Button type="button" onClick={() => void execute()}>
                Retry
              </Button>
            </div>
          }
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <Section
        eyebrow="Results"
        title={`Browse ${resultLabel}`}
        description="Refine the search, compare offers, and move the best candidate into cart without leaving the shared shell."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">{items.length} matches</Badge>
            <Badge tone={activeFilterCount ? 'warning' : 'neutral'}>
              {activeFilterCount ? `${activeFilterCount} active filters` : 'Default filters'}
            </Badge>
          </div>
        }
      >
        <Card className="p-5 sm:p-6">
          <SearchBar
            compact
            onSearch={handleSearch}
            defaultCategory={category}
            defaultQuery={query}
          />
        </Card>
      </Section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <FilterSidebar filters={filters} onChange={setFilters} />

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Matches"
              value={items.length}
              hint={`Current query: ${resultLabel}`}
              tone="info"
            />
            <StatCard
              label="Category"
              value={category}
              hint="Use the compact bar above to pivot into another lane."
            />
            <StatCard
              label="Filter load"
              value={activeFilterCount}
              hint={activeFilterCount ? 'Results are being narrowed by active constraints.' : 'Relevance sorting only.'}
              tone={activeFilterCount ? 'warning' : 'neutral'}
            />
          </div>

          <Section
            eyebrow="Offer grid"
            title={items.length ? 'Compare the strongest candidates' : 'Nothing surfaced yet'}
            description={
              items.length
                ? 'Open product detail for deeper inspection or add the item directly to cart.'
                : 'Try broadening the query or clearing filters to pull more offers into view.'
            }
            actions={
              activeFilterCount ? (
                <Button type="button" variant="secondary" onClick={() => setFilters({})}>
                  Clear filters
                </Button>
              ) : null
            }
          >
            <ResultGrid
              items={items}
              onItemClick={handleItemClick}
              onAddToCart={handleAddToCart}
              loading={loading}
            />
          </Section>
        </div>
      </div>
    </PageLayout>
  );
}
