import { useEffect, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Button } from './ui/button';
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from './ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from './ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export const CATEGORY_OPTIONS = [
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

function normalizeQuery(value?: string): string {
  const raw = String(value ?? '').trim();
  return raw === 'undefined' ? '' : raw;
}

export function SearchBar({
  onSearch,
  defaultCategory = 'grocery',
  defaultQuery = '',
  compact = false,
}: SearchBarProps): JSX.Element {
  const [category, setCategory] = useState(defaultCategory);
  const [query, setQuery] = useState(() => normalizeQuery(defaultQuery));
  const categoryFieldId = compact ? 'search-category-compact' : 'search-category';
  const queryFieldId = compact ? 'search-query-compact' : 'search-query';

  useEffect(() => {
    setCategory(defaultCategory);
  }, [defaultCategory]);

  useEffect(() => {
    setQuery(normalizeQuery(defaultQuery));
  }, [defaultQuery]);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    onSearch(category, normalizeQuery(query));
  }

  const searchGroupClassName = compact ? undefined : 'h-12 rounded-[1.6rem] bg-background';
  const searchInputClassName = compact
    ? undefined
    : 'h-12 text-[15px] md:text-[15px] placeholder:text-[15px]';
  const categoryTriggerClassName = compact ? undefined : 'h-12 text-[15px] md:text-[15px]';

  return (
    <form onSubmit={handleSubmit} className={compact ? 'space-y-4' : 'space-y-5'}>
      <FieldGroup className="gap-4">
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
          <Field>
            <FieldLabel htmlFor={categoryFieldId}>Category</FieldLabel>
            <FieldContent>
              <Select name="category" value={category} onValueChange={setCategory}>
                <SelectTrigger id={categoryFieldId} className={categoryTriggerClassName}>
                  <SelectValue placeholder="Choose a lane" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor={queryFieldId}>Search</FieldLabel>
            <FieldContent>
              <InputGroup className={searchGroupClassName}>
                <InputGroupAddon>
                  <InputGroupText>
                    <Search className="size-4" />
                  </InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id={queryFieldId}
                  name="query"
                  value={query ?? ''}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rice, meals, staples…"
                  className={searchInputClassName}
                />
              </InputGroup>
            </FieldContent>
          </Field>

          <Button
            type="submit"
            size="lg"
            aria-label="Search catalog"
            className="w-full rounded-full lg:w-auto lg:min-w-40"
          >
            Search
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
