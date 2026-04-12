import { ShoppingCart, Store } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from './ui/empty';
import { Spinner } from './ui/spinner';
import type { UCPItem } from '../types';

export interface ResultGridProps {
  items: UCPItem[];
  onItemClick?: (item: UCPItem) => void;
  onAddToCart?: (item: UCPItem) => void;
  loading?: boolean;
}

function formatPrice(item: UCPItem) {
  return `${item.price?.currency || 'INR'} ${item.price?.value ?? item.price?.amount ?? '0'}`;
}

export function ResultGrid({
  items,
  onItemClick,
  onAddToCart,
  loading,
}: ResultGridProps): JSX.Element {
  if (loading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <Spinner className="size-5" />
        <span>Searching for products...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Empty className="border-border/70 bg-card/70">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Store className="size-5" />
          </EmptyMedia>
          <EmptyTitle>No results found</EmptyTitle>
          <EmptyDescription>
            Try broadening the query or clearing filters to surface more offers.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card
          key={item.id}
          className="overflow-hidden border-border/70 bg-card/90 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
        >
          {item.images?.[0]?.url ? (
            <button
              type="button"
              className="block w-full overflow-hidden"
              onClick={() => onItemClick?.(item)}
            >
              <img
                src={item.images[0].url}
                alt={item.name ?? item.descriptor?.name ?? 'Product'}
                className="h-52 w-full object-cover"
              />
            </button>
          ) : (
            <div className="flex h-52 items-center justify-center bg-muted">
              <Store className="size-8 text-muted-foreground" />
            </div>
          )}

          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full">
                {item.category || 'General'}
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                {item.rating?.value ? `${item.rating.value.toFixed(1)}★` : item._provider || 'Verified seller'}
              </Badge>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg leading-tight">
                <button type="button" className="text-left hover:text-primary" onClick={() => onItemClick?.(item)}>
                  {item.name ?? item.descriptor?.name ?? 'Product'}
                </button>
              </CardTitle>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {item.description || item.descriptor?.short_desc || 'Open the listing for full product detail.'}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="text-2xl font-semibold tracking-tight">{formatPrice(item)}</div>
            <div className="text-sm text-muted-foreground">
              Seller: {item.provider?.name || item._provider || 'Unknown provider'}
            </div>
          </CardContent>

          <CardFooter className="gap-3 border-t border-border/70 pt-5">
            <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={() => onItemClick?.(item)}>
              View details
            </Button>
            {onAddToCart ? (
              <Button
                type="button"
                className="rounded-full"
                onClick={() => onAddToCart(item)}
              >
                <ShoppingCart className="size-4" />
                Add
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
