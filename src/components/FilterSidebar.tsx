import { SPACING, TYPOGRAPHY, DRAMS, CARD } from '@ondc-sdk/shared/design-system';
import { DramsInput, DramsDropdown } from '@ondc-sdk/shared/design-system';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price', label: 'Price' },
  { value: 'rating', label: 'Rating' },
  { value: 'distance', label: 'Distance' },
] as const;

const CONTAINER_STYLE = {
  ...CARD.base,
  padding: SPACING.lg,
  minWidth: '200px',
};

const HEADER_STYLE = {
  ...TYPOGRAPHY.h3,
  color: DRAMS.textDark,
  marginBottom: SPACING.md,
};

const FILTER_SECTION_STYLE = {
  marginBottom: SPACING.md,
};

const LABEL_STYLE = {
  ...TYPOGRAPHY.label,
  display: 'block',
  marginBottom: SPACING.xs,
  color: DRAMS.textDark,
};

export interface SearchFilters {
  maxPrice?: number;
  minRating?: number;
  sortBy?: string;
}

export interface FilterSidebarProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}

export function FilterSidebar({ filters, onChange }: FilterSidebarProps): JSX.Element {
  function handleChange(key: keyof SearchFilters, value: unknown): void {
    onChange({ ...filters, [key]: value });
  }

  function formatValue(value: number | undefined): string {
    return value?.toString() ?? '';
  }

  return (
    <div style={CONTAINER_STYLE}>
      <h3 style={HEADER_STYLE}>Filters</h3>

      <div style={FILTER_SECTION_STYLE}>
        <label htmlFor="max-price" style={LABEL_STYLE}>
          Max Price
        </label>
        <DramsInput
          id="max-price"
          type="number"
          min="0"
          step="0.01"
          value={formatValue(filters.maxPrice)}
          onChange={(e) =>
            handleChange('maxPrice', e.target.value ? Number(e.target.value) : undefined)
          }
          placeholder="Any"
        />
      </div>

      <div style={FILTER_SECTION_STYLE}>
        <label htmlFor="min-rating" style={LABEL_STYLE}>
          Min Rating
        </label>
        <DramsInput
          id="min-rating"
          type="number"
          min="0"
          max="5"
          step="0.1"
          value={formatValue(filters.minRating)}
          onChange={(e) =>
            handleChange('minRating', e.target.value ? Number(e.target.value) : undefined)
          }
          placeholder="Any"
        />
      </div>

      <div style={FILTER_SECTION_STYLE}>
        <label htmlFor="sort-by" style={LABEL_STYLE}>
          Sort By
        </label>
        <DramsDropdown
          id="sort-by"
          options={SORT_OPTIONS}
          value={filters.sortBy ?? 'relevance'}
          onChange={(value) => handleChange('sortBy', value)}
        />
      </div>
    </div>
  );
}
