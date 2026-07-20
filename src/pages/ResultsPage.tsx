import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FilterSidebar, type SearchFilters } from '../components/FilterSidebar';
import { ResultGrid } from '../components/ResultGrid';
import { SearchBar } from '../components/SearchBar';
import { useCart, useSearch, useSubject } from '../hooks';
import {
  deliveryAreaLabel,
  loadSavedDeliveryArea,
  saveDeliveryAreaFromAddress,
  saveDeliveryAreaLabel,
} from '../lib/deliveryPreferences';
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
    Boolean(filters.preferenceTerms?.length),
  ].filter(Boolean).length;
}

function numericParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function filtersFromSearchParams(params: URLSearchParams): SearchFilters {
  return {
    maxPrice: numericParam(params, 'max_price'),
    minRating: numericParam(params, 'min_rating'),
    location: params.get('delivery_area')?.trim() || undefined,
    preferenceTerms: (params.get('preference') || '')
      .split(',')
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean),
  };
}

export function searchParamsWithFilters(
  current: URLSearchParams,
  filters: SearchFilters,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const setOrDelete = (key: string, value: string | undefined) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  setOrDelete('max_price', filters.maxPrice == null ? undefined : String(filters.maxPrice));
  setOrDelete('min_rating', filters.minRating == null ? undefined : String(filters.minRating));
  setOrDelete('delivery_area', filters.location?.trim());
  setOrDelete('preference', filters.preferenceTerms?.filter(Boolean).join(','));
  return next;
}

function itemPrice(item: UCPItem): number {
  return Number(item.price?.value ?? item.price?.amount ?? Number.POSITIVE_INFINITY);
}

function normal(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function applyBuyerSearchFilters(
  sourceItems: UCPItem[],
  filters: SearchFilters,
): { items: UCPItem[]; unappliedPreferenceTerms: string[] } {
  let items = sourceItems.filter((item) => {
    if (filters.maxPrice !== undefined && itemPrice(item) > filters.maxPrice) return false;
    if (filters.minRating !== undefined) {
      if (item.rating?.value == null || item.rating.value < filters.minRating) return false;
    }
    if (filters.location) {
      const requested = normal(filters.location).split(/\s+/).filter((token) => token.length > 2);
      const supplied = (item.deliveryAreas ?? []).map(normal);
      // Empty deliveryAreas = unrestricted / not declared — do not hide published
      // Seller SKUs just because Samantha filled a saved checkout area.
      if (
        supplied.length &&
        requested.length &&
        !requested.some((token) => supplied.some((area) => area.includes(token)))
      ) {
        return false;
      }
    }
    return true;
  });

  const terms = (filters.preferenceTerms ?? []).map(normal).filter(Boolean);
  const preferred = terms.length
    ? items.filter((item) => {
        const haystack = normal([
          item.name,
          item.descriptor?.name,
          item.description,
          item.descriptor?.short_desc,
          item.category,
        ].filter(Boolean).join(' '));
        return terms.every((term) => haystack.includes(term));
      })
    : [];
  const unappliedPreferenceTerms = terms.length && !preferred.length ? terms : [];
  if (preferred.length) items = preferred;

  if (filters.sortBy === 'price') items = [...items].sort((a, b) => itemPrice(a) - itemPrice(b));
  if (filters.sortBy === 'rating') {
    items = [...items].sort((a, b) => Number(b.rating?.value ?? -1) - Number(a.rating?.value ?? -1));
  }
  return { items, unappliedPreferenceTerms };
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
  const rawQuery = searchParams.get('q') ?? '';
  const query = rawQuery === 'undefined' ? '' : rawQuery;
  const ondcTxn = searchParams.get('ondc_txn') ?? '';
  const { addToCart, session } = useCart();
  const { subjectId, principalId } = useSubject();
  const preferenceOwner = subjectId || principalId;
  const paramsKey = searchParams.toString();
  const [filters, setFilters] = useState<SearchFilters>(() =>
    filtersFromSearchParams(new URLSearchParams(paramsKey)),
  );
  const [cartNotice, setCartNotice] = useState<string | null>(null);

  const activeFilterCount = countActiveFilters(filters);
  const resultLabel = query || category;
  const preferences = useMemo(
    () => ({
      priceRange: filters.maxPrice ? { max: filters.maxPrice } : undefined,
      minRating: filters.minRating,
      sortBy: filters.sortBy as any,
      preferenceTerms: filters.preferenceTerms,
    }),
    [filters.maxPrice, filters.minRating, filters.preferenceTerms, filters.sortBy],
  );

  const { data, loading, error, execute } = useSearch(category, {
    query: query || undefined,
    preferences,
    location: filters.location ? { label: filters.location } : undefined,
    ondcTxn: ondcTxn || undefined,
  });
  const autoRetryRef = useRef(0);
  const [autoRetryNote, setAutoRetryNote] = useState<string | null>(null);

  useEffect(() => {
    autoRetryRef.current = 0;
    setAutoRetryNote(null);
    void execute();
  }, [execute]);

  useEffect(() => {
    const fromUrl = filtersFromSearchParams(new URLSearchParams(paramsKey));
    setFilters((current) => ({
      ...current,
      maxPrice: fromUrl.maxPrice ?? current.maxPrice,
      minRating: fromUrl.minRating ?? current.minRating,
      location: fromUrl.location || current.location,
      preferenceTerms: fromUrl.preferenceTerms,
    }));
  }, [paramsKey]);

  useEffect(() => {
    if (!preferenceOwner) return;
    const fromSession = deliveryAreaLabel({
      city: session?.buyer?.city,
      state: session?.buyer?.state,
      postalCode: session?.buyer?.pincode,
    });
    if (fromSession) {
      saveDeliveryAreaFromAddress(preferenceOwner, {
        city: session?.buyer?.city,
        state: session?.buyer?.state,
        postalCode: session?.buyer?.pincode,
      });
    }
    const saved = loadSavedDeliveryArea(preferenceOwner)?.label;
    const area = fromSession || saved;
    if (area) {
      setFilters((current) => (current.location ? current : { ...current, location: area }));
    }
  }, [preferenceOwner, session?.buyer?.city, session?.buyer?.pincode, session?.buyer?.state]);

  useEffect(() => {
    if (preferenceOwner && filters.location) {
      saveDeliveryAreaLabel(preferenceOwner, filters.location);
    }
  }, [filters.location, preferenceOwner]);

  function handleFiltersChange(next: SearchFilters): void {
    setFilters(next);
    if (next.location && preferenceOwner) saveDeliveryAreaLabel(preferenceOwner, next.location);
    navigate(`/results?${searchParamsWithFilters(searchParams, next).toString()}`, { replace: true });
  }

  // Free GW cold start / Failed to fetch: auto-retry a few times before permanent error UI.
  useEffect(() => {
    if (!error || loading || data) return;
    const transient = /Failed to fetch|waking|503|unavailable|dispatch failed/i.test(error);
    if (!transient || autoRetryRef.current >= 3) return;
    const attempt = ++autoRetryRef.current;
    setAutoRetryNote(`Gateway may be waking — retry ${attempt}/3…`);
    const t = window.setTimeout(() => {
      void execute();
    }, 2000 * attempt);
    return () => window.clearTimeout(t);
  }, [error, loading, data, execute]);

  function handleSearch(nextCategory: string, nextQuery: string): void {
    const normalized = String(nextQuery ?? '').trim();
    navigate(`/results?category=${nextCategory}&q=${encodeURIComponent(normalized)}`);
  }

  function handleItemClick(item: UCPItem): void {
    navigate(`/product/${item.id}`);
  }

  async function handleAddToCart(item: UCPItem): Promise<void> {
    try {
      await addToCart(item as any);
      const title = item.name ?? item.descriptor?.name ?? 'Item';
      setCartNotice(`${title} added to cart.`);
    } catch (err) {
      console.error('Failed to add to cart:', err);
      setCartNotice('Unable to add this item. Please try again.');
    }
  }

  const rawItems = (data as SearchResponse | null)?.items ?? [];
  const filtered = useMemo(() => applyBuyerSearchFilters(rawItems, filters), [filters, rawItems]);
  const items = filtered.items;

  if ((loading && !data) || (error && autoRetryRef.current < 3 && !data)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <Spinner className="size-6" />
        <div className="text-sm text-muted-foreground">
          {autoRetryNote || 'Pulling the latest offers for your selected category.'}
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
            <Button
              type="button"
              className="rounded-full"
              onClick={() => {
                autoRetryRef.current = 0;
                setAutoRetryNote(null);
                void execute();
              }}
            >
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Browse {resultLabel}
            </h1>
            <p className="max-w-[55ch] text-base leading-relaxed text-muted-foreground">
              {items.length > 1
                ? 'Refine search, compare offers, and move the best candidate into cart.'
                : items.length === 1
                  ? 'Review this offer, seller, delivery, and return terms before adding it to cart.'
                  : 'Adjust the search or filters to find an available offer.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full">
              {items.length} {items.length === 1 ? 'match' : 'matches'}
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
        <FilterSidebar filters={filters} onChange={handleFiltersChange} />

        <div className="space-y-6">
          {cartNotice ? (
            <Card className="border-primary/30 bg-primary/5 shadow-none" role="status" aria-live="polite">
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium">{cartNotice}</p>
                {cartNotice.endsWith('added to cart.') ? (
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate('/cart')}>
                    View cart
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Offer grid
                </div>
                <CardTitle className="text-2xl">
                  {items.length > 1
                    ? 'Compare the strongest candidates'
                    : items.length === 1
                      ? 'Review the available offer'
                    : query
                      ? `No exact matches for “${query}”`
                      : 'Nothing surfaced yet'}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {items.length
                    ? items.length === 1
                      ? 'Only one verified seller offer is currently available. Review its terms before adding it to cart.'
                      : 'Open product detail for deeper inspection or add an item directly to cart.'
                    : query
                      ? 'Browse the groceries currently available or try another search.'
                      : 'Try another category or clear filters to pull more offers into view.'}
                </p>
                {filtered.unappliedPreferenceTerms.length ? (
                  <p className="text-sm text-amber-700" role="status">
                    No current offer matched {filtered.unappliedPreferenceTerms.join(', ')}. Showing other offers that meet your remaining filters.
                  </p>
                ) : null}
                {!items.length && query ? (
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => handleSearch(category, '')}>
                    Browse available groceries
                  </Button>
                ) : null}
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
                deliveryArea={filters.location}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Matches" value={items.length} hint={`Current query: ${resultLabel}`} />
            <StatCard label="Category" value={category} hint="Use the compact bar above to pivot into another lane." />
            <StatCard
              label="Filter load"
              value={activeFilterCount}
              hint={activeFilterCount ? 'Results are being narrowed by active constraints.' : 'Relevance sorting only.'}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
