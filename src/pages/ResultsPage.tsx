import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FilterSidebar, type SearchFilters } from '../components/FilterSidebar';
import { ResultGrid } from '../components/ResultGrid';
import { SearchBar } from '../components/SearchBar';
import { useCart, useSearch } from '../hooks';
import type { UCPItem } from '../types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Spinner } from '../components/ui/spinner';

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

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{hint}</CardContent>
    </Card>
  );
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
    [filters.maxPrice, filters.minRating, filters.sortBy],
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
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <Spinner className="size-6" />
        <div className="text-sm text-muted-foreground">
          Pulling the latest offers for your selected category.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-md">
        <CardHeader className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Results
          </div>
          <CardTitle className="text-2xl">Unable to load results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate('/search')}>
              Back to search
            </Button>
            <Button type="button" className="rounded-full" onClick={() => void execute()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Results
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Browse {resultLabel}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Refine the search, compare offers, and move the best candidate into cart without
              leaving the buyer shell.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full">
              {items.length} matches
            </Badge>
            <Badge variant={activeFilterCount ? 'default' : 'outline'} className="rounded-full">
              {activeFilterCount ? `${activeFilterCount} active filters` : 'Default filters'}
            </Badge>
          </div>
        </div>
      </section>

      <Card className="border-border/70 bg-card/95 shadow-md">
        <CardContent className="py-6">
          <SearchBar
            compact
            onSearch={handleSearch}
            defaultCategory={category}
            defaultQuery={query}
          />
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <FilterSidebar filters={filters} onChange={setFilters} />

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Matches" value={items.length} hint={`Current query: ${resultLabel}`} />
            <StatCard label="Category" value={category} hint="Use the compact bar above to pivot into another lane." />
            <StatCard
              label="Filter load"
              value={activeFilterCount}
              hint={activeFilterCount ? 'Results are being narrowed by active constraints.' : 'Relevance sorting only.'}
            />
          </div>

          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Offer grid
                </div>
                <CardTitle className="text-2xl">
                  {items.length ? 'Compare the strongest candidates' : 'Nothing surfaced yet'}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {items.length
                    ? 'Open product detail for deeper inspection or add the item directly to cart.'
                    : 'Try broadening the query or clearing filters to pull more offers into view.'}
                </p>
              </div>
              {activeFilterCount ? (
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setFilters({})}>
                  Clear filters
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <ResultGrid
                items={items}
                onItemClick={handleItemClick}
                onAddToCart={handleAddToCart}
                loading={loading}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
