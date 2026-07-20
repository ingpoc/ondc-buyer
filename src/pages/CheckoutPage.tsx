import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BillingForm } from '../components/BillingForm';
import { QuoteDisplay } from '../components/QuoteDisplay';
import { TrustNotice } from '../components/TrustStatus';
import { useCart, useSubject, useTrustState } from '../hooks';
import { COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import { createLocalQuote, updateLocalDeliveryAddress } from '../lib/localCart';
import { orderFromCommerceExecution } from '../lib/commerceClient';
import { isOndcNetworkSearchReady, ondcSelectInitConfirm } from '../lib/ondc/protocolClient';
import {
  compileBuyerMandate,
  clearPurchasedCart,
  confirmBuyerMandate,
  ensureBuyerAgent,
  evaluateBuyerCheckout,
  executeBuyerCheckout,
  verifyBuyerReceipt,
  type BuyerCheckoutDecision,
} from '../lib/agentGuardCheckout';
import {
  clearCheckoutOutcome,
  readCheckoutOutcome,
  writeCheckoutOutcome,
  type CheckoutOutcome,
} from '../lib/checkoutOutcome';
import { recordPurchasePreference } from '../lib/samanthaMemory';
import { loadSavedDeliveryArea, saveDeliveryAreaFromAddress } from '../lib/deliveryPreferences';
import {
  CHECKOUT_PREFILL_EVENT,
  type CheckoutPrefillDetail,
} from '../lib/checkoutPrefill';
import { customerReference, sellerDisplayName } from '../lib/displayText';
import { effectiveElevatedTrustState, elevatedTrustSatisfied } from '../lib/trust';
import type { UCPAddress, UCPItem, UCPQuote } from '../types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../components/ui/field';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { Spinner } from '../components/ui/spinner';

type CheckoutExecutionRequest = Parameters<typeof executeBuyerCheckout>[0] & {
  runOndc: boolean;
};

export function checkoutDecisionStep(
  decision: BuyerCheckoutDecision,
): 'deny' | 'review_exact_approval' | 'execute' {
  if (decision.decision === 'deny') return 'deny';
  if (decision.decision === 'need_approval') return 'review_exact_approval';
  return 'execute';
}

interface ExactApprovalReviewProps {
  amountInr: number;
  quantity: number;
  itemName: string;
  sellerName: string;
  submitting: boolean;
  approvalAvailable: boolean;
  onConfirm: () => void;
  onKeepReviewing: () => void;
}

export function ExactApprovalReview({
  amountInr,
  quantity,
  itemName,
  sellerName,
  submitting,
  approvalAvailable,
  onConfirm,
  onKeepReviewing,
}: ExactApprovalReviewProps) {
  return (
    <div
      className="space-y-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
      aria-label="Exact order approval"
      data-testid="buyer-exact-approval-review"
    >
      <p className="font-medium">
        Confirm INR {amountInr.toFixed(2)} for {quantity} × {itemName} from {sellerName}.
      </p>
      <p>
        Confirming creates the order and reserves this quantity. No bank, card, UPI, wallet, or
        cash details are collected in this step. This one-time approval cannot be reused for another
        order.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="rounded-full"
          disabled={submitting || !approvalAvailable}
          onClick={onConfirm}
        >
          {submitting ? 'Placing order...' : 'Confirm exact approval and place order'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={submitting}
          onClick={onKeepReviewing}
        >
          Keep reviewing
        </Button>
      </div>
    </div>
  );
}

interface DeliveryAddressFormProps {
  address: UCPAddress;
  onChange: (address: UCPAddress) => void;
}

export function DeliveryAddressForm({ address, onChange }: DeliveryAddressFormProps) {
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
              placeholder="6-digit PIN"
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
  const { session, loading, error, itemCount, refreshCart, clearCart } = useCart();
  const trust = useTrustState(walletAddress);
  const [quote, setQuote] = useState<UCPQuote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [agentGuardNote, setAgentGuardNote] = useState<string | null>(null);
  const [checkoutOutcome, setCheckoutOutcome] = useState<CheckoutOutcome | null>(() =>
    readCheckoutOutcome()
  );
  const [pendingApproval, setPendingApproval] = useState<CheckoutExecutionRequest | null>(null);
  const [checkoutAutoMax, setCheckoutAutoMax] = useState(10000);
  const [savedCheckoutAutoMax, setSavedCheckoutAutoMax] = useState<number | null>(null);
  const [mandateBusy, setMandateBusy] = useState(false);
  const [mandateStatus, setMandateStatus] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<UCPAddress>({
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'IND',
  });
  const hydratedDeliverySession = useRef<string | null>(null);

  useEffect(() => {
    if (!session || hydratedDeliverySession.current === session.id) return;
    hydratedDeliverySession.current = session.id;
    const savedArea = loadSavedDeliveryArea(subjectId || principalId);
    setDeliveryAddress({
      line1: session.buyer?.street || '',
      city: session.buyer?.city || savedArea?.city || '',
      state: session.buyer?.state || savedArea?.state || '',
      postalCode: session.buyer?.pincode || savedArea?.postalCode || '',
      country: session.buyer?.country || 'IND',
    });
  }, [principalId, session, subjectId]);

  const handleDeliveryAddressChange = useCallback((address: UCPAddress) => {
    setDeliveryAddress(address);
    saveDeliveryAreaFromAddress(subjectId || principalId, address);
    const sessionId = localStorage.getItem('ondc-session-id');
    if (sessionId) updateLocalDeliveryAddress(sessionId, address);
  }, [principalId, subjectId]);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<CheckoutPrefillDetail>).detail;
      if (!detail) return;
      setDeliveryAddress((prev) => {
        const next: UCPAddress = {
          line1: detail.line1 ?? prev.line1 ?? '',
          city: detail.city ?? prev.city ?? '',
          state: detail.state ?? prev.state ?? '',
          postalCode: detail.postalCode ?? prev.postalCode ?? '',
          country: detail.country ?? prev.country ?? 'IND',
        };
        saveDeliveryAreaFromAddress(subjectId || principalId, next);
        return next;
      });
      void refreshCart();
    };
    window.addEventListener(CHECKOUT_PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(CHECKOUT_PREFILL_EVENT, onPrefill);
  }, [principalId, refreshCart, subjectId]);

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
          const saved = Number(auto['buyer.checkout.commit']);
          setCheckoutAutoMax(saved);
          setSavedCheckoutAutoMax(saved);
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
      setSavedCheckoutAutoMax(checkoutAutoMax);
      setAgentGuardNote(`Shopping limit saved. Checkout auto-approve up to INR ${checkoutAutoMax}.`);
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

  async function completeAuthorizedCheckout(request: CheckoutExecutionRequest) {
    if (!session) throw new Error('No session found');

    const { runOndc, ...executionRequest } = request;
    const executed = await executeBuyerCheckout(executionRequest);
    const order = orderFromCommerceExecution(executed.execution);
    if (!order) {
      throw new Error('AgentGuard allowed checkout but the shared exchange did not return an order.');
    }
    if (!executed.receipt) {
      throw new Error('Checkout completed without a signed authorization reference.');
    }

    const verified = await verifyBuyerReceipt({ receiptId: executed.receipt.receipt_id });
    const outcome: CheckoutOutcome = {
      at: Date.now(),
      decision: 'allow',
      message: verified.valid
        ? 'Order authorized and the signed authorization reference was verified.'
        : 'Order authorized, but the signed authorization reference could not be verified.',
      receiptId: executed.receipt.receipt_id,
      amountInr: request.amountInr,
      orderId: order.id,
      approvalId: request.approvalId,
    };
    writeCheckoutOutcome(outcome);
    setCheckoutOutcome(outcome);
    setPendingApproval(null);
    setAgentGuardNote(
      `${outcome.message} Reference ${customerReference(executed.receipt.receipt_id)}.`,
    );

    await clearPurchasedCart({
      orderId: order.id,
      receiptId: executed.receipt.receipt_id,
      clearCart,
    });

    if (runOndc && (await isOndcNetworkSearchReady())) {
      try {
        const orderItems = session.items.map((entry) => ({
          id: entry.item.id,
          quantity: { count: String(entry.quantity) },
        }));
        await ondcSelectInitConfirm({
          bpp_id: 'ondcseller.aadharcha.in',
          bpp_uri: 'https://ondcseller.aadharcha.in/ondc',
          order: { items: orderItems },
        });
      } catch {
        setAgentGuardNote(
          `${outcome.message} Reference ${customerReference(executed.receipt.receipt_id)}. Network status confirmation is pending.`,
        );
      }
    }

    for (const entry of session.items) {
      const title = entry.item.descriptor?.name ?? entry.item.name ?? entry.item.id;
      if (title) recordPurchasePreference(request.walletAddress ?? request.subjectId, title);
    }
    navigate(`/orders/${order.id}`);
  }

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
      if (!sessionId || !session) throw new Error('No session found');

      const principal = COMMERCE_DEMO_MODE ? walletAddress : walletAddress ?? subjectId;
      if (!principal) throw new Error('Sign in before checkout.');

      const amountInr = Math.round(
        Number(quote?.total?.value ?? quote?.price?.value ?? 0) ||
          session.items.reduce(
            (sum, item) => sum + parseFloat(item.item.price?.value || '0') * item.quantity,
            0,
          ),
      );
      const firstCheckoutItem = session.items[0]?.item as UCPItem | undefined;
      const request: CheckoutExecutionRequest = {
        walletAddress: principal,
        subjectId,
        amountInr,
        sessionId,
        itemId: session.items[0]?.item?.id,
        itemName:
          session.items[0]?.item?.descriptor?.name ??
          session.items[0]?.item?.name ??
          session.items[0]?.item?.id,
        sellerName: sellerDisplayName(
          firstCheckoutItem?.provider?.name,
          firstCheckoutItem?._provider,
        ),
        quantity: session.items[0]?.quantity ?? 1,
        deliveryAddress: {
          name: session.buyer?.name ?? '',
          phone: session.buyer?.phone ?? '',
          email: session.buyer?.email,
          ...deliveryAddress,
        },
        runOndc: !COMMERCE_DEMO_MODE,
      };
      const decision = await evaluateBuyerCheckout(request);

      const decisionStep = checkoutDecisionStep(decision);
      if (decisionStep === 'deny') {
        setSubmitError(decision.reason);
        setAgentGuardNote(decision.reason);
        setCheckoutOutcome({
          at: Date.now(),
          decision: 'deny',
          message: decision.reason,
          amountInr,
        });
        return;
      }
      if (decisionStep === 'review_exact_approval') {
        if (!decision.approval) {
          throw new Error('Checkout requires exact approval, but no approval was issued.');
        }
        setPendingApproval({ ...request, approvalId: decision.approval.approval_id });
        setCheckoutOutcome({
          at: Date.now(),
          decision: 'need_approval',
          message: 'This total is above your automatic checkout limit. Confirm the exact order once to continue.',
          amountInr,
          approvalId: decision.approval.approval_id,
        });
        return;
      }

      await completeAuthorizedCheckout(request);
    } catch (err) {
      if (session && COMMERCE_DEMO_MODE) {
        setQuote(createLocalQuote(session, deliveryAddress));
        setSubmitError('Checkout service is unavailable. Showing a local quote instead.');
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Checkout failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmExactApproval() {
    if (!pendingApproval) {
      setSubmitError('This approval is no longer available. Review the order and try again.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await completeAuthorizedCheckout(pendingApproval);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Checkout failed');
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
  const shoppingLimitDirty =
    savedCheckoutAutoMax !== null && checkoutAutoMax !== savedCheckoutAutoMax;
  const buyerReady = Boolean(session?.buyer?.name && session?.buyer?.contact?.email);
  const actionDisabled = submitting || trustBlocksCheckout || !buyerReady;
  const checkoutItems = (session?.items ?? []).map((entry) => entry.item as UCPItem);
  const sellerNames = Array.from(
    new Set(checkoutItems.map((item) => sellerDisplayName(item.provider?.name, item._provider))),
  );
  const deliveryTerms = Array.from(
    new Set(checkoutItems.map((item) => item.deliveryEstimate || 'Estimate not supplied by seller')),
  );
  const returnTerms = Array.from(
    new Set(checkoutItems.map((item) => item.returnPolicy || 'Terms not supplied by seller')),
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {checkoutOutcome?.decision === 'allow' && checkoutOutcome.receiptId
            ? 'Checkout authorized'
            : checkoutOutcome?.decision === 'need_approval'
              ? 'Checkout needs approval'
              : checkoutOutcome?.decision === 'deny'
                ? 'Checkout denied'
                : 'Checkout'}
        </h1>
        <p className="max-w-[55ch] text-base leading-relaxed text-muted-foreground">
          {checkoutOutcome?.decision === 'allow' && checkoutOutcome.receiptId
            ? 'AgentGuard allowed this checkout. The authorization is recorded below.'
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
                ? 'Authorized'
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
                Authorization reference{' '}
                <span className="quant font-medium">
                  {customerReference(checkoutOutcome.receiptId)}
                </span>
              </p>
            ) : null}
            {checkoutOutcome.amountInr != null ? (
              <p>
                Amount INR <span className="quant">{checkoutOutcome.amountInr}</span>
              </p>
            ) : null}
            {checkoutOutcome.decision === 'allow' && checkoutOutcome.approvalId ? (
              <p data-testid="buyer-checkout-approval">
                One-time approval reference{' '}
                <span className="quant">{customerReference(checkoutOutcome.approvalId)}</span>
              </p>
            ) : null}
            {checkoutOutcome.decision === 'need_approval' ? (
              <ExactApprovalReview
                amountInr={checkoutOutcome.amountInr ?? 0}
                quantity={session?.items[0]?.quantity ?? 1}
                itemName={
                  session?.items[0]?.item?.descriptor?.name ??
                  session?.items[0]?.item?.name ??
                  'this item'
                }
                sellerName={sellerNames.join(', ') || 'the selected seller'}
                submitting={submitting}
                approvalAvailable={Boolean(pendingApproval)}
                onConfirm={() => void handleConfirmExactApproval()}
                onKeepReviewing={() => {
                  setPendingApproval(null);
                  clearCheckoutOutcome();
                  setCheckoutOutcome(null);
                }}
              />
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
              {checkoutOutcome.decision === 'need_approval' ? null : (
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
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {trustBlocksCheckout ? (
        <TrustNotice
          state={policyTrustState}
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

      {(checkoutOutcome?.decision === 'allow' && checkoutOutcome.receiptId) ||
      checkoutOutcome?.decision === 'need_approval' ? null : (
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <BillingForm session={session} onSave={refreshCart} />
              <DeliveryAddressForm address={deliveryAddress} onChange={handleDeliveryAddressChange} />
              <Card className="border-border/70 bg-card/90">
                <CardHeader className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Authorization
                  </div>
                  <CardTitle className="text-xl">Order authorization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                  <p>
                    Confirming authorizes the displayed total, creates the order, and reserves the
                    selected quantity. AgentGuard applies the limit shown beside the order summary.
                  </p>
                  <dl className="grid gap-3 rounded-3xl bg-muted/60 p-4">
                    <div>
                      <dt className="font-medium text-foreground">Seller</dt>
                      <dd>{sellerNames.join(', ') || 'Seller name unavailable'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Delivery</dt>
                      <dd>{deliveryTerms.join('; ')}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Returns and refunds</dt>
                      <dd>{returnTerms.join('; ')}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Payment details</dt>
                      <dd>No bank, card, UPI, wallet, or cash details are collected in this step.</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
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
                      step={1}
                      className="quant"
                      value={checkoutAutoMax}
                      onChange={(e) => setCheckoutAutoMax(Number(e.target.value) || 0)}
                      data-testid="buyer-checkout-max-input"
                    />
                  </label>
                  <p>Enter any whole-rupee limit from INR 0 upward.</p>
                  <p data-testid="buyer-mandate-summary">
                    Routine checkout up to INR{' '}
                    <span className="quant text-foreground">{checkoutAutoMax}</span> can proceed
                    without step-up. Higher carts need exact one-time approval; replay is rejected.
                  </p>
                  <p>AgentGuard records the authorization decision and signed receipt for this order.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        !subjectId ||
                        mandateBusy ||
                        (mandateStatus === 'active' && savedCheckoutAutoMax !== null && !shoppingLimitDirty)
                      }
                      onClick={() => void handleConfirmBuyerMandate()}
                      data-testid="buyer-confirm-mandate"
                    >
                      {mandateStatus === 'active' && !shoppingLimitDirty
                        ? 'Shopping limit saved'
                        : 'Save shopping limit'}
                    </Button>
                    <Badge
                      variant="outline"
                      className="rounded-full"
                      data-testid="buyer-mandate-status"
                    >
                      {shoppingLimitDirty
                        ? 'Unsaved changes'
                        : mandateStatus === 'active'
                          ? 'Limit saved'
                          : 'Not saved'}
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
                        : 'Authorize and place order'}
                  </Button>

                  {!actionDisabled ? (
                    <p className="text-sm text-muted-foreground">
                      You will receive an order number and receipt after successful checkout.
                    </p>
                  ) : null}

                  {actionDisabled && !submitting ? (
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
