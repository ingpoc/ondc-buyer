import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BillingForm } from '../components/BillingForm';
import { PaymentSelector, type PaymentMethod } from '../components/PaymentSelector';
import { QuoteDisplay } from '../components/QuoteDisplay';
import { TrustNotice } from '../components/TrustStatus';
import { useCart, useSubject, useTrustState } from '../hooks';
import { COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import { createLocalQuote } from '../lib/localCart';
import { createVerifiedDemoOrder, upsertDemoOrder } from '../lib/localOrders';
import { createCommerceOrder } from '../lib/commerceClient';
import { isOndcNetworkSearchReady, ondcSelectInitConfirm } from '../lib/ondc/protocolClient';
import {
  compileBuyerMandate,
  confirmBuyerMandate,
  consumeBuyerCheckoutApproval,
  ensureBuyerAgent,
  evaluateBuyerCheckout,
  executeBuyerCheckout,
  verifyBuyerReceipt,
} from '../lib/agentGuardCheckout';
import {
  clearCheckoutOutcome,
  readCheckoutOutcome,
  type CheckoutOutcome,
} from '../lib/checkoutOutcome';
import { recordPurchasePreference } from '../lib/samanthaMemory';
import { effectiveElevatedTrustState, elevatedTrustSatisfied } from '../lib/trust';
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
  const { walletAddress, subjectId, principalId } = useSubject();
  const { session, loading, error, itemCount, refreshCart } = useCart();
  const trust = useTrustState(walletAddress);
  const [quote, setQuote] = useState<UCPQuote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [agentGuardNote, setAgentGuardNote] = useState<string | null>(null);
  const [checkoutOutcome, setCheckoutOutcome] = useState<CheckoutOutcome | null>(() =>
    readCheckoutOutcome()
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [checkoutAutoMax, setCheckoutAutoMax] = useState(10000);
  const [mandateBusy, setMandateBusy] = useState(false);
  const [mandateStatus, setMandateStatus] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<UCPAddress>({
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'IND',
  });

  const trustBlocksCheckout = !trust.loading && !elevatedTrustSatisfied(trust.state, principalId);
  const policyTrustState = effectiveElevatedTrustState(trust.state, principalId);
  const holdingAgDecision =
    checkoutOutcome != null &&
    (checkoutOutcome.decision === 'need_approval' ||
      checkoutOutcome.decision === 'deny' ||
      (checkoutOutcome.decision === 'allow' && Boolean(checkoutOutcome.receiptId)));

  useEffect(() => {
    const outcome = readCheckoutOutcome();
    setCheckoutOutcome(outcome);
    if (outcome?.decision === 'allow' && outcome.orderId) {
      navigate(`/orders/${outcome.orderId}`, { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!subjectId) return;
    void (async () => {
      try {
        const ensured = await ensureBuyerAgent(walletAddress ?? subjectId);
        setMandateStatus(ensured.mandate?.status ?? null);
        const auto = ensured.mandate?.limits?.auto_approve_max_inr as
          | Record<string, number>
          | undefined;
        if (auto?.['buyer.checkout.commit'] != null) {
          setCheckoutAutoMax(Number(auto['buyer.checkout.commit']));
        }
      } catch {
        /* optional until signed in */
      }
    })();
  }, [subjectId, walletAddress]);

  async function handleConfirmBuyerMandate() {
    if (!subjectId) return;
    setMandateBusy(true);
    setSubmitError(null);
    try {
      const compiled = await compileBuyerMandate({
        walletAddress: walletAddress ?? subjectId,
        checkoutAutoMaxInr: checkoutAutoMax,
        allowedActions: [
          'buyer.checkout.commit',
          'buyer.order.cancel',
          'buyer.return.submit',
          'buyer.remedy.accept',
        ],
      });
      const confirmed = await confirmBuyerMandate({
        walletAddress: walletAddress ?? subjectId,
        mandateId: compiled.mandate.mandate_id,
      });
      setMandateStatus(confirmed.mandate.status ?? 'active');
      setAgentGuardNote(`Mandate confirmed. Checkout auto-approve up to INR ${checkoutAutoMax}.`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Mandate confirmation failed');
    } finally {
      setMandateBusy(false);
    }
  }
  useEffect(() => {
    if (holdingAgDecision) return;
    if (!loading && session && itemCount === 0) {
      navigate('/cart');
    }
  }, [holdingAgDecision, itemCount, loading, navigate, session]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (trustBlocksCheckout) {
      setSubmitError(trust.reason || 'Sign in before continuing.');
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
        if (!walletAddress) {
          throw new Error('Sign in before elevated checkout.');
        }
        const amountInr = Math.round(
          Number(quote?.total?.value ?? quote?.price?.value ?? 0) ||
            session.items.reduce(
              (sum, item) => sum + parseFloat(item.item.price?.value || '0') * item.quantity,
              0
            )
        );
        const decision = await evaluateBuyerCheckout({
          walletAddress,
          amountInr,
          sessionId,
        });
        if (decision.decision === 'deny') {
          setSubmitError(decision.reason);
          setAgentGuardNote(decision.reason);
          return;
        }
        if (decision.decision === 'need_approval' && decision.approval) {
          setAgentGuardNote(decision.reason);
          try {
            await consumeBuyerCheckoutApproval({
              walletAddress,
              approvalId: decision.approval.approval_id,
            });
            setAgentGuardNote(`Checkout approved once. Receipt recorded for INR ${amountInr}.`);
          } catch (consumeErr) {
            setSubmitError(
              consumeErr instanceof Error
                ? consumeErr.message
                : 'Checkout approval already consumed (replay rejected).'
            );
            return;
          }
        } else if (decision.decision === 'allow') {
          const executed = await executeBuyerCheckout({
            walletAddress,
            amountInr,
            sessionId,
            itemId: session.items[0]?.item?.id,
            quantity: session.items[0]?.quantity ?? 1,
          });
          if (executed.receipt) {
            setAgentGuardNote(`Checkout allowed. Receipt ${executed.receipt.receipt_id}.`);
            const verified = await verifyBuyerReceipt({
              receiptId: executed.receipt.receipt_id,
            });
            if (verified.valid) {
              setAgentGuardNote(
                `Checkout allowed. Receipt ${executed.receipt.receipt_id} verified.`
              );
            }
          }
        } else if (decision.receipt) {
          setAgentGuardNote(`Checkout allowed. Receipt ${decision.receipt.receipt_id}.`);
        }
        if (quote) {
          let order;
          try {
            order = await createCommerceOrder({
              sessionId,
              session,
              buyerId: walletAddress ?? subjectId,
            });
            upsertDemoOrder(order, walletAddress);
          } catch {
            order = createVerifiedDemoOrder(
              sessionId,
              session,
              quote,
              deliveryAddress,
              policyTrustState,
              walletAddress,
              paymentMethod
            );
          }
          for (const entry of session.items) {
            const title = entry.item.descriptor?.name ?? entry.item.name ?? entry.item.id;
            if (title) recordPurchasePreference(walletAddress ?? subjectId, title);
          }
          navigate(`/orders/${order.id}`);
          return;
        }

        setQuote(createLocalQuote(session, deliveryAddress));
        setSubmitError(
          'Live checkout service is unavailable. Review the local demo quote, then place the order to complete checkout.'
        );
        return;
      }

      // No-demo path: AgentGuard + ONDC select→init→confirm when network ready (no mock invent).
      if (!walletAddress && !subjectId) {
        throw new Error('Sign in before checkout.');
      }
      if (!session) {
        throw new Error('No session found');
      }
      const amountInr = Math.round(
        Number(quote?.total?.value ?? quote?.price?.value ?? 0) ||
          session.items.reduce(
            (sum, item) => sum + parseFloat(item.item.price?.value || '0') * item.quantity,
            0
          )
      );
      const principal = walletAddress ?? subjectId ?? '';
      const decision = await evaluateBuyerCheckout({
        walletAddress: principal,
        amountInr,
        sessionId,
      });
      if (decision.decision === 'deny') {
        setSubmitError(decision.reason);
        setAgentGuardNote(decision.reason);
        return;
      }
      if (decision.decision === 'need_approval' && decision.approval) {
        await consumeBuyerCheckoutApproval({
          walletAddress: principal,
          approvalId: decision.approval.approval_id,
        });
        setAgentGuardNote(`Checkout approved once. Receipt recorded for INR ${amountInr}.`);
      } else if (decision.decision === 'allow') {
        const executed = await executeBuyerCheckout({
          walletAddress: principal,
          amountInr,
          sessionId,
          itemId: session.items[0]?.item?.id,
          quantity: session.items[0]?.quantity ?? 1,
        });
        if (executed.receipt) {
          setAgentGuardNote(`Checkout allowed. Receipt ${executed.receipt.receipt_id}.`);
        }
      }

      let ondcTxn: string | undefined;
      if (await isOndcNetworkSearchReady()) {
        const orderItems = session.items.map((entry) => ({
          id: entry.item.id,
          quantity: { count: String(entry.quantity) },
        }));
        const ondc = await ondcSelectInitConfirm({
          bpp_id: 'ondcseller.aadharcha.in',
          bpp_uri: 'https://ondcseller.aadharcha.in/ondc',
          order: { items: orderItems },
        });
        ondcTxn = String(ondc.confirm.transaction_id || ondc.select.transaction_id || '');
        const ondcNote = `ONDC select→init→confirm ACK (txn ${ondcTxn}). Payment still simulated — not live UPI.`;
        setAgentGuardNote((prev) => (prev ? `${prev} ${ondcNote}` : ondcNote));
      }

      let order;
      try {
        order = await createCommerceOrder({
          sessionId,
          session,
          buyerId: principal,
        });
        upsertDemoOrder(order, principal);
      } catch {
        if (!quote) {
          throw new Error(
            ondcTxn
              ? `ONDC protocol ACK’d (txn ${ondcTxn}) but order persistence failed. Not inventing mock grocery.`
              : 'Checkout unavailable: ONDC network not ready and commerce order API failed.'
          );
        }
        order = createVerifiedDemoOrder(
          sessionId,
          session,
          quote,
          deliveryAddress,
          policyTrustState,
          principal,
          paymentMethod
        );
        upsertDemoOrder(order, principal);
      }
      for (const entry of session.items) {
        const title = entry.item.descriptor?.name ?? entry.item.name ?? entry.item.id;
        if (title) recordPurchasePreference(principal, title);
      }
      navigate(`/orders/${order.id}`);
      return;
    } catch (err) {
      if (session && COMMERCE_DEMO_MODE) {
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
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => navigate('/cart')}
          >
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
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {checkoutOutcome?.decision === 'allow' && checkoutOutcome.receiptId
            ? 'Payment succeeded'
            : checkoutOutcome?.decision === 'need_approval'
              ? 'Checkout needs approval'
              : checkoutOutcome?.decision === 'deny'
                ? 'Checkout denied'
                : 'Checkout'}
        </h1>
        <p className="max-w-[55ch] text-base leading-relaxed text-muted-foreground">
          {checkoutOutcome?.decision === 'allow' && checkoutOutcome.receiptId
            ? 'AgentGuard allowed this checkout. Receipt and paid status are recorded below.'
            : checkoutOutcome?.decision === 'need_approval' || checkoutOutcome?.decision === 'deny'
              ? 'AgentGuard blocked automatic checkout. Review the decision below.'
              : 'Confirm buyer details and place the order. AgentGuard authorizes protected checkout.'}
        </p>
      </section>

      {checkoutOutcome ? (
        <Card className="border-border/70 bg-card/95" data-testid="buyer-checkout-outcome">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">
              {checkoutOutcome.decision === 'allow'
                ? 'Paid'
                : checkoutOutcome.decision === 'need_approval'
                  ? 'Need approval'
                  : checkoutOutcome.decision === 'deny'
                    ? 'Denied'
                    : checkoutOutcome.decision}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p data-testid="buyer-checkout-outcome-message">{checkoutOutcome.message}</p>
            {checkoutOutcome.receiptId ? (
              <p data-testid="buyer-checkout-receipt">
                Receipt <span className="quant font-medium">{checkoutOutcome.receiptId}</span>
              </p>
            ) : null}
            {checkoutOutcome.amountInr != null ? (
              <p>
                Amount INR <span className="quant">{checkoutOutcome.amountInr}</span>
              </p>
            ) : null}
            {checkoutOutcome.approvalId ? (
              <p data-testid="buyer-checkout-approval">
                Approval <span className="quant">{checkoutOutcome.approvalId}</span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {checkoutOutcome.orderId ? (
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() => navigate(`/orders/${checkoutOutcome.orderId}`)}
                >
                  View order
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  clearCheckoutOutcome();
                  setCheckoutOutcome(null);
                }}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {trustBlocksCheckout ? (
        <TrustNotice
          state={trust.state}
          loading={trust.loading}
          error={trust.error}
          reason={trust.reason}
        />
      ) : null}

      {agentGuardNote ? (
        <p className="text-sm text-muted-foreground" data-testid="buyer-agentguard-note">
          {agentGuardNote}
        </p>
      ) : null}

      {submitError ? (
        <Card className="border-border/70 bg-secondary/80 text-foreground shadow-none">
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6">{submitError}</p>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setSubmitError(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {checkoutOutcome?.decision === 'allow' && checkoutOutcome.receiptId ? null : (
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <BillingForm session={session} onSave={refreshCart} />
              <DeliveryAddressForm address={deliveryAddress} onChange={setDeliveryAddress} />
              <PaymentSelector selected={paymentMethod} onSelect={setPaymentMethod} />
            </div>

            <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              {quote ? (
                <QuoteDisplay quote={quote} currency={currency} />
              ) : (
                <CartSummary currency={currency} />
              )}

              <Card className="border-border/70 bg-card/90" data-testid="buyer-authority-card">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl">Shopping agent limits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <label
                    className="block space-y-2 text-foreground"
                    data-testid="buyer-checkout-limit"
                  >
                    <span className="text-muted-foreground">Auto-approve checkout up to (INR)</span>
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      className="quant"
                      value={checkoutAutoMax}
                      onChange={(e) => setCheckoutAutoMax(Number(e.target.value) || 0)}
                      data-testid="buyer-checkout-max-input"
                    />
                  </label>
                  <p data-testid="buyer-mandate-summary">
                    Routine checkout up to INR{' '}
                    <span className="quant text-foreground">{checkoutAutoMax}</span> can proceed
                    without step-up. Higher carts need exact one-time approval; replay is rejected.
                  </p>
                  <p>
                    Payment, ONDC exchange, logistics, and settlement are simulated; AgentGuard
                    authorization and receipt creation are real local gateway checks.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!subjectId || mandateBusy}
                      onClick={() => void handleConfirmBuyerMandate()}
                      data-testid="buyer-confirm-mandate"
                    >
                      Confirm mandate
                    </Button>
                    <Badge
                      variant="outline"
                      className="rounded-full"
                      data-testid="buyer-mandate-status"
                    >
                      {mandateStatus ?? 'not confirmed'}
                    </Badge>
                    <Badge variant="outline" className="rounded-full">
                      Pause blocks the next protected checkout
                    </Badge>
                  </div>
                </CardContent>
              </Card>

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
                          ? trust.reason || 'Sign in to continue.'
                          : 'Please complete billing information before continuing.'}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      )}

      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        onClick={() => navigate('/cart')}
      >
        Back to cart
      </Button>
    </div>
  );
}
