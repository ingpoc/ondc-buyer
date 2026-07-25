import { Package, ShoppingCart, Store } from 'lucide-react';
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
import { sellerDisplayName, unitPriceLabel } from '../lib/displayText';

export interface ResultGridProps {
  items: UCPItem[];
  onItemClick?: (item: UCPItem) => void;
  onAddToCart?: (item: UCPItem) => void;
  loading?: boolean;
  deliveryArea?: string;
}

function formatPrice(item: UCPItem) {
  return `${item.price?.currency || 'INR'} ${item.price?.value ?? item.price?.amount ?? '0'}`;
}

export function ResultGrid({
  items,
  onItemClick,
  onAddToCart,
  loading,
  deliveryArea,
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
              className="relative block w-full overflow-hidden"
              onClick={() => onItemClick?.(item)}
            >
              <img
                src={item.images[0].url}
                alt={item.name ?? item.descriptor?.name ?? 'Product'}
                className="h-32 w-full object-cover"
              />
              {item.imageCaption ? (
                <span className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm">
                  {item.imageCaption}
                </span>
              ) : null}
            </button>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-50 to-orange-100 text-amber-950">
              <Package className="size-8" />
              <span className="text-xs font-medium">Product image not supplied</span>
            </div>
          )}

          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full">
                {item.category || 'General'}
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                {item.rating?.value
                  ? `${item.rating.value.toFixed(1)}★`
                  : sellerDisplayName(item.provider?.name, item._provider)}
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
            <div className="quant text-2xl font-semibold tracking-tight">{formatPrice(item)}</div>
            <dl className="space-y-1 text-sm text-muted-foreground">
              <div>
                <dt className="inline font-medium text-foreground">Seller: </dt>
                <dd className="inline">{sellerDisplayName(item.provider?.name, item._provider)}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground">Unit price: </dt>
                <dd className="inline">
                  {unitPriceLabel(
                    item.name ?? item.descriptor?.name,
                    item.price?.value ?? item.price?.amount,
                    item.price?.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground">Delivery: </dt>
                <dd className="inline">{item.deliveryEstimate || 'Estimate not supplied'}</dd>
              </div>
              {deliveryArea ? (
                <div>
                  <dt className="inline font-medium text-foreground">Service area: </dt>
                  <dd className="inline">Delivers to {deliveryArea}</dd>
                </div>
              ) : null}
              <div>
                <dt className="inline font-medium text-foreground">Availability: </dt>
                <dd className="inline">
                  {typeof item.quantity === 'number' ? `${item.quantity} in stock` : 'Not supplied'}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground">Returns: </dt>
                <dd className="inline">{item.returnPolicy || 'Terms not supplied'}</dd>
              </div>
            </dl>
          </CardContent>

          <CardFooter className="gap-3 border-t border-border/70 pt-5">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-full"
              aria-label={`View details for ${item.name ?? item.descriptor?.name ?? 'product'}`}
              onClick={() => onItemClick?.(item)}
            >
              View details
            </Button>
            {onAddToCart ? (
              <Button
                type="button"
                className="rounded-full"
                aria-label={
                  item.quantity === 0
                    ? `${item.name ?? item.descriptor?.name ?? 'Product'} is out of stock`
                    : `Add ${item.name ?? item.descriptor?.name ?? 'product'} to cart`
                }
                onClick={() => onAddToCart(item)}
                disabled={item.quantity === 0}
              >
                <ShoppingCart className="size-4" />
                {item.quantity === 0 ? 'Out of stock' : 'Add'}
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
