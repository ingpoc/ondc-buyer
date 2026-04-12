import { useEffect, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Badge } from './ui/badge';
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

export function SearchBar({
  onSearch,
  defaultCategory = 'grocery',
  defaultQuery = '',
  compact = false,
}: SearchBarProps): JSX.Element {
  const [category, setCategory] = useState(defaultCategory);
  const [query, setQuery] = useState(defaultQuery);
  const categoryFieldId = compact ? 'search-category-compact' : 'search-category';
  const queryFieldId = compact ? 'search-query-compact' : 'search-query';

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

  const searchGroupClassName = compact ? undefined : 'h-12 rounded-[1.6rem] bg-background';
  const searchInputClassName = compact
    ? undefined
    : 'h-12 text-[15px] md:text-[15px] placeholder:text-[15px]';
  const categoryTriggerClassName = compact ? undefined : 'h-12 text-[15px] md:text-[15px]';

  return (
    <form onSubmit={handleSubmit} className={compact ? 'space-y-4' : 'space-y-6'}>
      {!compact ? (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">
            Intent-first search
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Verified commerce
          </Badge>
        </div>
      ) : null}

      <FieldGroup className="gap-4">
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
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
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Fresh fruit, ready meals, office staples..."
                  className={searchInputClassName}
                />
              </InputGroup>
            </FieldContent>
          </Field>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Start broad, then narrow to the strongest verified option before checkout.
          </p>
          <Button type="submit" size="lg" className="w-full rounded-full sm:w-auto sm:min-w-44">
            Search network
          </Button>
        </div>
      </FieldGroup>

      {!compact ? (
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((option) => {
            const active = option.value === category;
            return (
              <Button
                key={option.value}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                className="rounded-full"
                onClick={() => setCategory(option.value)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      ) : null}
    </form>
  );
}
