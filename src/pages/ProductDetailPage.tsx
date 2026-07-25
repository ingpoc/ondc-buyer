import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ShoppingCart, Star, Store } from 'lucide-react';
import { useApi, useCart } from '../hooks';
import { sellerDisplayName, unitPriceLabel } from '../lib/displayText';
import type { UCPItem } from '../types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { Spinner } from '../components/ui/spinner';

function renderRating(rating?: number) {
  if (!rating) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
      <Star className="size-4 fill-current text-primary" />
      {rating.toFixed(1)}
    </div>
  );
}

export function ProductDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error, execute } = useApi<UCPItem>(`/api/catalog/products/${id}`);
  const { addToCart } = useCart();
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    void execute();
  }, [execute]);

  async function handleAddToCart(): Promise<void> {
    if (!data || data.quantity === 0) return;

    setAddingToCart(true);
    setCartMessage('');

    try {
      await addToCart(data as any, quantity);
      setCartMessage(`${quantity} ${quantity === 1 ? 'item' : 'items'} added to cart.`);
    } catch {
      setCartMessage('Failed to add to cart.');
    } finally {
      setAddingToCart(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <Spinner className="size-6" />
        <div className="text-sm text-muted-foreground">Loading product details...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-md">
        <CardContent className="space-y-4 py-8">
          <div className="text-lg font-semibold">Unable to load product detail</div>
          <p className="text-sm text-muted-foreground">{error || 'Product not found.'}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" className="rounded-full" onClick={() => void execute()}>
              Retry
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate(-1)}>
              <ChevronLeft className="size-4" />
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const title = data.name ?? data.descriptor?.name ?? 'Product';
  const outOfStock = data.quantity === 0;
  const price = `${data.price?.currency} ${data.price?.value ?? data.price?.amount ?? '0'}`;
  const sellerName = sellerDisplayName(data.provider?.name, data._provider);
  const specs = [
    ['Category', data.category || 'General'],
    ['Seller', sellerName],
    ['Unit price', unitPriceLabel(title, data.price?.value ?? data.price?.amount, data.price?.currency)],
    ['Delivery', data.deliveryEstimate || 'Estimate not supplied; confirm before ordering'],
    ['Service areas', data.deliveryAreas?.length ? data.deliveryAreas.join(', ') : 'Confirm with the seller'],
    ['Returns and refunds', data.returnPolicy || 'Terms not supplied; review before ordering'],
    ['Stock', data.quantity != null ? `${data.quantity} available` : 'In stock'],
  ];

  return (
    <div className="space-y-8">
      <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate(-1)}>
        <ChevronLeft className="size-4" />
        Back
      </Button>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="overflow-hidden border-border/70 bg-card/95 shadow-md">
          {data.images?.[0]?.url ? (
            <figure>
              <img src={data.images[0].url} alt={title} className="h-[420px] w-full object-cover" />
              {data.imageCaption ? (
                <figcaption className="border-t border-border/70 bg-muted/60 px-4 py-2 text-sm text-muted-foreground">
                  {data.imageCaption}
                </figcaption>
              ) : null}
            </figure>
          ) : (
            <div className="flex h-[420px] items-center justify-center bg-muted">
              <Store className="size-10 text-muted-foreground" />
            </div>
          )}
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-md">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full">
                {data.category || 'General'}
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                {sellerDisplayName(data.provider?.name, data._provider)}
              </Badge>
            </div>
            <div className="space-y-3">
              <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">{title}</h1>
              <p className="text-base leading-7 text-muted-foreground">
                {data.description || data.descriptor?.short_desc || 'Open the listing to review full product context before checkout.'}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-3xl font-semibold tracking-tight text-primary">{price}</div>
              {renderRating(data.rating?.value)}
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              {specs.map(([label, value]) => (
                <div key={label} className="rounded-3xl bg-muted/70 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {label}
                  </div>
                  <div className="mt-2 text-sm font-medium">{value}</div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Buyer note
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Review the seller, delivery, return, quantity, and unit-price details before adding
                this offer. Checkout shows the exact AgentGuard limit and any required approval.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-3 text-sm font-medium" htmlFor="product-quantity">
                Quantity
                <Input
                  id="product-quantity"
                  type="number"
                  min={1}
                  max={data.quantity && data.quantity > 0 ? data.quantity : undefined}
                  value={quantity}
                  disabled={outOfStock}
                  onChange={(event) => {
                    const next = Math.max(1, Number(event.target.value) || 1);
                    setQuantity(data.quantity && data.quantity > 0 ? Math.min(next, data.quantity) : next);
                  }}
                  className="quant w-24"
                />
              </label>
              <Button
                type="button"
                className="rounded-full sm:min-w-44"
                onClick={() => void handleAddToCart()}
                onKeyDown={(event) => {
                  if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    void handleAddToCart();
                  }
                }}
                disabled={addingToCart || outOfStock}
              >
                <ShoppingCart className="size-4" />
                {outOfStock ? 'Out of stock' : addingToCart ? 'Adding...' : 'Add to cart'}
              </Button>
              {cartMessage ? (
                <div className="flex flex-wrap items-center gap-3" role="status" aria-live="polite">
                  <span className="text-sm font-medium text-foreground">{cartMessage}</span>
                  {cartMessage.endsWith('added to cart.') ? (
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate('/cart')}>
                      View cart
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
