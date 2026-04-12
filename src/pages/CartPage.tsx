import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../hooks';
import { CartItem, CartSummary } from '../components/CartComponents';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../components/ui/empty';
import { Spinner } from '../components/ui/spinner';

export function CartPage(): JSX.Element {
  const navigate = useNavigate();
  const {
    session,
    loading,
    error,
    removeFromCart,
    updateQuantity,
    clearError,
    itemCount,
    subtotal,
  } = useCart();

  function handleCheckout(): void {
    navigate('/checkout');
  }

  if (loading && !session) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <Spinner className="size-6" />
        <div className="text-sm text-muted-foreground">Loading cart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-md">
        <CardContent className="space-y-4 py-8 text-center">
          <div className="text-lg font-semibold">Cart error</div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" className="rounded-full" onClick={clearError}>
            Dismiss
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!session || itemCount === 0) {
    return (
      <Empty className="border-border/70 bg-card/90">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingBag className="size-5" />
          </EmptyMedia>
          <EmptyTitle>Your cart is empty</EmptyTitle>
          <EmptyDescription>
            Add some items to get started with the buyer checkout flow.
          </EmptyDescription>
        </EmptyHeader>
        <Button type="button" className="rounded-full" onClick={() => navigate('/search')}>
          Start shopping
        </Button>
      </Empty>
    );
  }

  const currency = session.items[0]?.item.price?.currency || 'INR';
  const itemLabel = itemCount === 1 ? 'item' : 'items';

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Cart
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Shopping cart</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {itemCount} {itemLabel} ready for trust-aware checkout.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {session.items.map((item: any) => (
            <CartItem
              key={item.item.id}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
              disabled={loading}
            />
          ))}
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <CartSummary
            subtotal={subtotal}
            currency={currency}
            onCheckout={handleCheckout}
            checkoutDisabled={loading || itemCount === 0}
          />
          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Need more items?</CardTitle>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => navigate('/search')}>
                Continue shopping
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
