import { useState, FormEvent } from 'react';
import { SPACING, TYPOGRAPHY, DRAMS, GRID } from '@ondc-sdk/shared/design-system';
import { DramsInput, DramsDropdown, DramsButton } from '@ondc-sdk/shared/design-system';

const CATEGORY_OPTIONS = [
  { value: 'grocery', label: 'Grocery' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'electronics', label: 'Electronics' },
] as const;

const FORM_STYLE = {
  display: 'grid',
  gridTemplateColumns: '240px 1fr auto',
  gap: GRID.gap.lg,
  alignItems: 'center',
};

const LABEL_STYLE = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)' as const,
  whiteSpace: 'nowrap' as const,
  borderWidth: '0',
};

export interface SearchBarProps {
  onSearch: (category: string, query: string) => void;
  defaultCategory?: string;
  defaultQuery?: string;
}

export function SearchBar({
  onSearch,
  defaultCategory = 'grocery',
  defaultQuery = '',
}: SearchBarProps): JSX.Element {
  const [category, setCategory] = useState(defaultCategory);
  const [query, setQuery] = useState(defaultQuery);

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    onSearch(category, query);
  }

  return (
    <form onSubmit={handleSubmit} style={FORM_STYLE}>
      <label htmlFor="category-dropdown" style={LABEL_STYLE}>
        Category
      </label>
      <DramsDropdown
        id="category-dropdown"
        options={CATEGORY_OPTIONS}
        value={category}
        onChange={setCategory}
        placeholder="Select category"
      />

      <label htmlFor="search-input" style={LABEL_STYLE}>
        Search products
      </label>
      <DramsInput
        id="search-input"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
      />

      <DramsButton type="submit">
        Search
      </DramsButton>
    </form>
  );
}
