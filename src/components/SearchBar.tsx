import { useEffect, useState, type FormEvent } from 'react';
import { Badge, Button, Input, DramsDropdown } from '@portfolio-ui';

const CATEGORY_OPTIONS = [
  { value: 'grocery', label: 'Grocery' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'electronics', label: 'Electronics' },
] as const;

export interface SearchBarProps {
  onSearch: (category: string, query: string) => void;
  defaultCategory?: string;
  defaultQuery?: string;
  compact?: boolean;
}

export function SearchBar({
  onSearch,
  defaultCategory = 'grocery',
  defaultQuery = '',
  compact = false,
}: SearchBarProps): JSX.Element {
  const [category, setCategory] = useState(defaultCategory);
  const [query, setQuery] = useState(defaultQuery);

  useEffect(() => {
    setCategory(defaultCategory);
  }, [defaultCategory]);

  useEffect(() => {
    setQuery(defaultQuery);
  }, [defaultQuery]);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    onSearch(category, query.trim());
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? 'space-y-4' : 'space-y-6'}>
      {!compact ? (
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">Intent-first search</Badge>
          <Badge tone="neutral">Verified commerce</Badge>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
        <div className="space-y-2">
          <label
            htmlFor="category-dropdown"
            className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]"
          >
            Category
          </label>
          <DramsDropdown
            id="category-dropdown"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={setCategory}
            placeholder="Select category"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="search-input"
            className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]"
          >
            Search
          </label>
          <Input
            id="search-input"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Fresh fruit, ready meals, office staples..."
          />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
            Action
          </span>
          <Button type="submit" size="lg" fullWidth className="lg:w-auto">
            Search network
          </Button>
        </div>
      </div>

      {!compact ? (
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((option) => {
            const active = option.value === category;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setCategory(option.value)}
                className={
                  active
                    ? 'rounded-[var(--ui-radius-pill)] bg-[rgba(234,106,42,0.12)] px-4 py-2 text-sm font-semibold text-[var(--ui-primary-strong)]'
                    : 'rounded-[var(--ui-radius-pill)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ui-text-secondary)] transition-colors duration-150 hover:text-[var(--ui-text)]'
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </form>
  );
}
