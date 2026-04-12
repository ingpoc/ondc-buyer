import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { BillingForm } from '../components/BillingForm';
import { PaymentSelector } from '../components/PaymentSelector';
import { QuoteDisplay } from '../components/QuoteDisplay';
import { TrustNotice } from '../components/TrustStatus';
import { useCart, useTrustState } from '../hooks';
import { buildCommerceUrl, COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import { createLocalQuote } from '../lib/localCart';
import { createDemoOrder } from '../lib/localOrders';
import type { UCPAddress, UCPQuote } from '../types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../components/ui/field';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { Spinner } from '../components/ui/spinner';

interface DeliveryAddressFormProps {
  address: UCPAddress;
  onChange: (address: UCPAddress) => void;
}

function DeliveryAddressForm({ address, onChange }: DeliveryAddressFormProps) {
  const handleChange = (field: keyof UCPAddress, value: string) => {
    onChange({ ...address, [field]: value });
  };

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Delivery
        </div>
        <CardTitle className="text-xl">Delivery address</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="delivery-line1">Street address *</FieldLabel>
            <Input
              id="delivery-line1"
              required
              value={address.line1 || ''}
              onChange={(event) => handleChange('line1', event.target.value)}
              placeholder="123 Main Street, Apt 4B"
            />
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="delivery-city">City *</FieldLabel>
              <Input
                id="delivery-city"
                required
                value={address.city || ''}
                onChange={(event) => handleChange('city', event.target.value)}
                placeholder="Bangalore"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="delivery-state">State *</FieldLabel>
              <Input
                id="delivery-state"
                required
                value={address.state || ''}
                onChange={(event) => handleChange('state', event.target.value)}
                placeholder="Karnataka"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="delivery-postal-code">Postal code *</FieldLabel>
            <Input
              id="delivery-postal-code"
              required
              value={address.postalCode || ''}
              onChange={(event) => handleChange('postalCode', event.target.value)}
              placeholder="560001"
              pattern="[0-9]{6}"
            />
            <FieldDescription>
              Use a 6-digit PIN code so local quote generation can estimate delivery.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function CartSummary({ currency }: { currency: string }) {
  const { session, subtotal } = useCart();

  if (!session) return null;

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Cart preview
        </div>
        <CardTitle className="text-xl">Current basket</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {session.items.map((item: any) => (
          <div key={item.item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {item.item.descriptor?.name || item.item.id} × {item.quantity}
            </span>
            <span className="font-medium">
              {currency} {(parseFloat(item.item.price?.value || '0') * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}

        <Separator />

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">
            {currency} {subtotal.toFixed(2)}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          Complete the form to estimate delivery, tax, and the final quote.
        </p>
      </CardContent>
    </Card>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { session, loading, error, itemCount, refreshCart } = useCart();
  const trust = useTrustState(publicKey?.toBase58() ?? null);
  const [quote, setQuote] = useState<UCPQuote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<UCPAddress>({
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'IND',
  });

  const trustBlocksCheckout = !trust.loading && trust.state !== 'verified';

  useEffect(() => {
    if (!loading && session && itemCount === 0) {
      navigate('/cart');
    }
  }, [itemCount, loading, navigate, session]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (trustBlocksCheckout) {
      setSubmitError(trust.reason || 'Complete AadhaarChain verification before continuing.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const sessionId = localStorage.getItem('ondc-session-id');
      if (!sessionId) {
        throw new Error('No session found');
      }

      if (COMMERCE_DEMO_MODE) {
        if (!session) {
          throw new Error('No session found');
        }
        if (quote) {
          const order = createDemoOrder(sessionId, session, quote, deliveryAddress);
          navigate(`/orders/${order.id}`);
          return;
        }

        setQuote(createLocalQuote(session, deliveryAddress));
        setSubmitError(
          'Live checkout service is unavailable. Review the local demo quote, then place the order to complete checkout.',
        );
        return;
      }

      const response = await fetch(buildCommerceUrl('/api/checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          deliveryAddress,
          preferences: {},
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Checkout failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.order?.id) {
        navigate(`/orders/${data.order.id}`);
        return;
      }

      setQuote(data.quote);
    } catch (err) {
      if (session) {
        setQuote(createLocalQuote(session, deliveryAddress));
        setSubmitError('Live checkout service is unavailable. Showing a local demo quote instead.');
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Checkout failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !session) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <Spinner className="size-6" />
        <div className="text-sm text-muted-foreground">Loading checkout...</div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-md">
        <CardContent className="space-y-4 py-8 text-center">
          <div className="text-lg font-semibold">Unable to load checkout</div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate('/cart')}>
            Back to cart
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currency = session?.items[0]?.item.price?.currency || 'INR';
  const buyerReady = Boolean(session?.buyer?.name && session?.buyer?.contact?.email);
  const actionDisabled = submitting || trustBlocksCheckout || !buyerReady;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Checkout
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Trust-aware checkout</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          Confirm buyer information, generate a quote, and place the order once AadhaarChain
          verification allows elevated actions.
        </p>
      </section>

      <TrustNotice
        state={trust.state}
        loading={trust.loading}
        error={trust.error}
        reason={trust.reason}
        actionLabel="Resolve trust in AadhaarChain"
      />

      {submitError ? (
        <Card className="border-amber-200 bg-amber-50 text-amber-900 shadow-none">
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6">{submitError}</p>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setSubmitError(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <BillingForm session={session} onSave={refreshCart} />
            <DeliveryAddressForm address={deliveryAddress} onChange={setDeliveryAddress} />
            <PaymentSelector />
          </div>

          <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            {quote ? <QuoteDisplay quote={quote} currency={currency} /> : <CartSummary currency={currency} />}

            <Card className="border-border/70 bg-card/90">
              <CardContent className="space-y-4 py-6">
                <Button type="submit" className="w-full rounded-full" disabled={actionDisabled}>
                  {trustBlocksCheckout
                    ? 'Trust verification required'
                    : submitting
                      ? 'Processing...'
                      : quote
                        ? 'Place order'
                        : 'Get quote'}
                </Button>

                {actionDisabled ? (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="rounded-full">
                      Validation
                    </Badge>
                    <p>
                      {trustBlocksCheckout
                        ? trust.reason || 'Complete AadhaarChain verification to continue.'
                        : 'Please complete billing information before continuing.'}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

      <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate('/cart')}>
        Back to cart
      </Button>
    </div>
  );
}
