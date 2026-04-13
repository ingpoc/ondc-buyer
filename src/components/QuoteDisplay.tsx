import type { UCPQuote } from '../types';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';

const BREAKUP_TITLES: Record<string, string> = {
  item: 'Items',
  delivery: 'Delivery',
  tax: 'Tax',
  discount: 'Discount',
  fee: 'Fees',
  other: 'Other',
};

export interface QuoteDisplayProps {
  quote: UCPQuote;
  currency: string;
}

function formatPrice(price?: { value?: string | number; amount?: string | number }): string {
  const value = price?.value ?? price?.amount ?? '0';
  return typeof value === 'number' ? value.toFixed(2) : String(value);
}

function parseDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return duration;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;

  if (hours > 0 && minutes > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return duration;
}

export function QuoteDisplay({ quote, currency }: QuoteDisplayProps): JSX.Element {
  const groupedBreakup = quote.breakup?.reduce<Record<string, typeof quote.breakup>>((acc, item) => {
    const type = item.type || 'other';
    acc[type] = [...(acc[type] || []), item];
    return acc;
  }, {});

  const hasDiscount = Boolean(Number(quote.discount?.value ?? quote.discount?.amount ?? 0) > 0);

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Quote
            </div>
            <CardTitle className="text-xl">Order summary</CardTitle>
          </div>
          {quote.ttl ? (
            <Badge variant="outline" className="rounded-full">
              Valid for {parseDuration(quote.ttl)}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {groupedBreakup ? Object.entries(groupedBreakup).map(([type, items]) => (
          <div key={type} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {BREAKUP_TITLES[type] || type}
            </div>
            {items.map((item, index) => (
              <div key={`${type}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  {item.quantity && item.quantity > 1 ? `${item.title} × ${item.quantity}` : item.title}
                </span>
                <span className="font-medium">
                  {currency} {formatPrice(item.price)}
                </span>
              </div>
            ))}
          </div>
        )) : null}

        <Separator />

        <div className="space-y-2 text-sm">
          {quote.subtotal ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{currency} {formatPrice(quote.subtotal)}</span>
            </div>
          ) : null}
          {quote.deliveryCost ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Delivery</span>
              <span>{currency} {formatPrice(quote.deliveryCost)}</span>
            </div>
          ) : null}
          {quote.tax ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Tax</span>
              <span>{currency} {formatPrice(quote.tax)}</span>
            </div>
          ) : null}
          {hasDiscount ? (
            <div className="flex items-center justify-between gap-3 text-primary">
              <span>Discount</span>
              <span>-{currency} {formatPrice(quote.discount)}</span>
            </div>
          ) : null}
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3 text-lg font-semibold tracking-tight">
          <span>Total</span>
          <span>
            {currency} {formatPrice(quote.total)}
          </span>
        </div>

        {hasDiscount ? (
          <div className="rounded-3xl bg-primary/10 px-4 py-3 text-sm text-primary">
            You save {currency} {formatPrice(quote.discount)} on this order.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
