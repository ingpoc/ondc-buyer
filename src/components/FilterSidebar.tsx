import { Badge, Button, Card, Input, DramsDropdown } from '@portfolio-ui';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price', label: 'Price' },
  { value: 'rating', label: 'Rating' },
  { value: 'distance', label: 'Distance' },
] as const;

export interface SearchFilters {
  maxPrice?: number;
  minRating?: number;
  sortBy?: string;
  location?: string;
}

export interface FilterSidebarProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}

function activeFilterCount(filters: SearchFilters) {
  return [
    filters.maxPrice !== undefined,
    filters.minRating !== undefined,
    Boolean(filters.location),
    Boolean(filters.sortBy && filters.sortBy !== 'relevance'),
  ].filter(Boolean).length;
}

export function FilterSidebar({ filters, onChange }: FilterSidebarProps): JSX.Element {
  const count = activeFilterCount(filters);

  function handleChange(key: keyof SearchFilters, value: unknown): void {
    onChange({ ...filters, [key]: value });
  }

  function formatValue(value: number | undefined): string {
    return value?.toString() ?? '';
  }

  return (
    <Card className="space-y-6 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
            Refine
          </div>
          <h3 className="text-xl font-bold tracking-[-0.03em] text-[var(--ui-text)]">
            Search filters
          </h3>
          <p className="text-sm text-[var(--ui-text-secondary)]">
            Tighten the result set before you compare offers.
          </p>
        </div>
        <Badge tone={count ? 'warning' : 'neutral'}>
          {count ? `${count} active` : 'Base view'}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="max-price"
            className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]"
          >
            Max price
          </label>
          <Input
            id="max-price"
            type="number"
            min="0"
            step="0.01"
            value={formatValue(filters.maxPrice)}
            onChange={(event) =>
              handleChange('maxPrice', event.target.value ? Number(event.target.value) : undefined)
            }
            placeholder="Any"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="min-rating"
            className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]"
          >
            Min rating
          </label>
          <Input
            id="min-rating"
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={formatValue(filters.minRating)}
            onChange={(event) =>
              handleChange('minRating', event.target.value ? Number(event.target.value) : undefined)
            }
            placeholder="Any"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="sort-by"
            className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]"
          >
            Sort by
          </label>
          <DramsDropdown
            id="sort-by"
            options={SORT_OPTIONS}
            value={filters.sortBy ?? 'relevance'}
            onChange={(value) => handleChange('sortBy', value)}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="location"
            className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]"
          >
            Delivery area
          </label>
          <Input
            id="location"
            type="text"
            value={filters.location ?? ''}
            onChange={(event) => handleChange('location', event.target.value || undefined)}
            placeholder="City or PIN code"
          />
        </div>
      </div>

      <Button type="button" variant="ghost" fullWidth onClick={() => onChange({})}>
        Reset filters
      </Button>
    </Card>
  );
}
