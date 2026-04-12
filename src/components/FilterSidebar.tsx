import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

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

function numericValue(value?: number) {
  return value === undefined ? '' : String(value);
}

export function FilterSidebar({ filters, onChange }: FilterSidebarProps): JSX.Element {
  const count = activeFilterCount(filters);

  function handleChange(key: keyof SearchFilters, value: unknown): void {
    onChange({ ...filters, [key]: value });
  }

  return (
    <Card className="gap-5 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Refine
            </div>
            <CardTitle className="text-xl">Search filters</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tighten the result set before you compare offers.
            </p>
          </div>
          <Badge variant={count ? 'default' : 'outline'} className="rounded-full">
            {count ? `${count} active` : 'Base view'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Max price
          </span>
          <Input
            name="maxPrice"
            type="number"
            min="0"
            step="0.01"
            value={numericValue(filters.maxPrice)}
            onChange={(event) =>
              handleChange('maxPrice', event.target.value ? Number(event.target.value) : undefined)
            }
            placeholder="Any"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Min rating
          </span>
          <Input
            name="minRating"
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={numericValue(filters.minRating)}
            onChange={(event) =>
              handleChange('minRating', event.target.value ? Number(event.target.value) : undefined)
            }
            placeholder="Any"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Sort by
          </span>
          <Select
            name="sortBy"
            value={filters.sortBy ?? 'relevance'}
            onValueChange={(value) => handleChange('sortBy', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sort results" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Delivery area
          </span>
          <Input
            name="location"
            type="text"
            value={filters.location ?? ''}
            onChange={(event) => handleChange('location', event.target.value || undefined)}
            placeholder="City or PIN code"
          />
        </label>

        <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => onChange({})}>
          Reset filters
        </Button>
      </CardContent>
    </Card>
  );
}
