import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart, useSubject, useTrustState } from '../hooks';
import { CartItem, CartSummary } from '../components/CartComponents';
import { TrustNotice } from '../components/TrustStatus';
import { effectiveElevatedTrustState, elevatedTrustSatisfied } from '../lib/trust';
import { clearCheckoutOutcome } from '../lib/checkoutOutcome';
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
  const { walletAddress, principalId } = useSubject();
  const trust = useTrustState(walletAddress);
  const elevatedOk = elevatedTrustSatisfied(trust.state, principalId);
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
    clearCheckoutOutcome();
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
      <div className="space-y-6">
        <h1 className="sr-only">Shopping cart</h1>
        <Empty className="border-border/70 bg-card/90">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingBag className="size-5" />
            </EmptyMedia>
            <EmptyTitle>Your cart is empty</EmptyTitle>
            <EmptyDescription>
              Add an offer to compare its seller, delivery, return terms, and final checkout total.
            </EmptyDescription>
          </EmptyHeader>
          <Button type="button" className="rounded-full" onClick={() => navigate('/search')}>
            Start shopping
          </Button>
        </Empty>
      </div>
    );
  }

  const currency = session.items[0]?.item.price?.currency || 'INR';
  const itemLabel = itemCount === 1 ? 'item' : 'items';

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Shopping cart</h1>
        <p className="text-base text-muted-foreground">
          {itemCount} {itemLabel} ready for trust-aware checkout.
        </p>
      </section>

      {!elevatedOk && !trust.loading ? (
        <TrustNotice
          state={effectiveElevatedTrustState(trust.state, principalId)}
          loading={trust.loading}
          error={trust.error}
          reason={trust.reason}
        />
      ) : null}

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
