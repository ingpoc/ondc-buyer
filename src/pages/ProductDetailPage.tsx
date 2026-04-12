import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ShoppingCart, Star, Store } from 'lucide-react';
import { useApi, useCart } from '../hooks';
import type { UCPItem } from '../types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Spinner } from '../components/ui/spinner';

function renderRating(rating?: number) {
  if (!rating) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
      <Star className="size-4 fill-current text-amber-500" />
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

  useEffect(() => {
    void execute();
  }, [execute]);

  async function handleAddToCart(): Promise<void> {
    if (!data) return;

    setAddingToCart(true);
    setCartMessage('');

    try {
      await addToCart(data as any);
      setCartMessage('Added to cart.');
      setTimeout(() => setCartMessage(''), 2000);
    } catch {
      setCartMessage('Failed to add to cart.');
      setTimeout(() => setCartMessage(''), 2000);
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
          <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate(-1)}>
            <ChevronLeft className="size-4" />
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  const title = data.name ?? data.descriptor?.name ?? 'Product';
  const price = `${data.price?.currency} ${data.price?.value ?? data.price?.amount ?? '0'}`;
  const specs = [
    ['Category', data.category || 'General'],
    ['Seller', data.provider?.name || data._provider || 'Unknown seller'],
    ['Stock', 'In stock'],
    ['Route', 'Buyer detail flow'],
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
            <img src={data.images[0].url} alt={title} className="h-[420px] w-full object-cover" />
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
                {data.provider?.name || data._provider || 'Verified seller'}
              </Badge>
            </div>
            <div className="space-y-3">
              <CardTitle className="text-4xl tracking-tight sm:text-5xl">{title}</CardTitle>
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
                Add the strongest candidate to cart, then continue into checkout once AadhaarChain
                trust verification is ready for elevated actions.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                className="rounded-full sm:min-w-44"
                onClick={() => void handleAddToCart()}
                disabled={addingToCart}
              >
                <ShoppingCart className="size-4" />
                {addingToCart ? 'Adding...' : 'Add to cart'}
              </Button>
              {cartMessage ? (
                <div className="text-sm font-medium text-muted-foreground">{cartMessage}</div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
