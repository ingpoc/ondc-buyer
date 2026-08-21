import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BillingForm } from '../components/BillingForm';
import { QuoteDisplay } from '../components/QuoteDisplay';
import { TrustNotice } from '../components/TrustStatus';
import { useCart, useSubject, useTrustState } from '../hooks';
import { COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import { createLocalQuote, updateLocalDeliveryAddress } from '../lib/localCart';
import { orderFromCommerceExecution } from '../lib/commerceClient';
import { prepareDurableCheckout, type DurableQuote } from '../lib/commerceV1Client';
import { isOndcNetworkSearchReady, ondcSelectInitConfirm } from '../lib/ondc/protocolClient';
import {
  compileBuyerMandate,
  clearPurchasedCart,
  confirmBuyerMandate,
  syncBuyerAgentGuardStatus,
  evaluateBuyerCheckout,
  executeBuyerCheckout,
  verifyBuyerReceipt,
  type BuyerCheckoutDecision,
} from '../lib/agentGuardCheckout';
import type { AgentRef } from '@aadharchain/agentguard-contract';
import {
  buyerShoppingAgentLabel,
  getBuyerAgentAuthority,
  subscribeBuyerAgentAuthority,
} from '../lib/buyerAgentAuthority';
import { useAuthContext } from '../contexts/AuthContext';
import { useAuthProviders } from '../lib/authProviders';
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
import { customerReference, intentReceiptLabel, sellerDisplayName } from '../lib/displayText';
import {
  collectRazorpayTestPayment,
  fetchRazorpaySandboxStatus,
  shouldCollectRazorpayTestPayment,
} from '../lib/razorpayCheckout';
import { effectiveElevatedTrustState, elevatedTrustSatisfied } from '../lib/trust';
import type { UCPAddress, UCPItem, UCPQuote, UCPSession } from '../types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../components/ui/field';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { Spinner } from '../components/ui/spinner';

type CheckoutExecutionRequest = Parameters<typeof executeBuyerCheckout>[0] & {
  runOndc: boolean;
  amountInr: number;
  subjectId?: string | null;
};

interface PreparedCheckout {
  quote: DurableQuote;
  correlationId: string;
  attemptId: string;
}

function durableQuoteForDisplay(quote: DurableQuote): UCPQuote {
  const subtotal = quote.subtotal_paise / 100;
  const landedTotal = quote.landed_total_paise / 100;
  const fees = Math.max(0, landedTotal - subtotal);
  return {
    price: { currency: 'INR', value: landedTotal.toFixed(2) },
    total: { currency: 'INR', value: landedTotal.toFixed(2) },
    subtotal: { currency: 'INR', value: subtotal.toFixed(2) },
    deliveryCost: fees > 0 ? { currency: 'INR', value: fees.toFixed(2) } : undefined,
    breakup: [
      {
        title: 'Cart subtotal',
        type: 'item',
        price: { currency: 'INR', value: subtotal.toFixed(2) },
      },
      ...(fees > 0
        ? [{
            title: 'Delivery and fees',
            type: 'fee',
            price: { currency: 'INR', value: fees.toFixed(2) },
          }]
        : []),
    ],
    currency: 'INR',
    amount: { currency: 'INR', value: landedTotal.toFixed(2) },
  };
}

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
  razorpayTestMode?: boolean;
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
  razorpayTestMode = false,
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
        Confirming creates the order and reserves this quantity.{' '}
        {razorpayTestMode
          ? 'Razorpay Checkout Test Mode then opens for mock UPI or cards. No real money is collected.'
          : 'No bank, card, UPI, wallet, or cash details are collected in this step.'}{' '}
        This one-time approval cannot be reused for another order.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="rounded-full"
          disabled={submitting || !approvalAvailable}
          onClick={onConfirm}
        >
          {submitting
            ? razorpayTestMode
              ? 'Opening Razorpay Test Mode...'
              : 'Placing order...'
            : razorpayTestMode
              ? 'Confirm exact approval and pay in Test Mode'
              : 'Confirm exact approval and place order'}
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
  onPersist?: (address: UCPAddress) => void;
}

export function DeliveryAddressForm({ address, onChange, onPersist }: DeliveryAddressFormProps) {
  const handleChange = (field: keyof UCPAddress, value: string) => {
    const nextValue = field === 'state' || field === 'city' ? collapseDuplicatedRegion(value) : value;
    onChange({ ...address, [field]: nextValue });
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
              name="address-line1"
              autoComplete="address-line1"
              required
              value={address.line1 || ''}
              onChange={(event) => handleChange('line1', event.target.value)}
              onBlur={() => onPersist?.(address)}
              placeholder="123 Main Street, Apt 4B"
            />
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="delivery-city">City *</FieldLabel>
              <Input
                id="delivery-city"
                name="address-level2"
                autoComplete="address-level2"
                required
                value={address.city || ''}
                onChange={(event) => handleChange('city', event.target.value)}
                onBlur={() => onPersist?.(address)}
                placeholder="Bangalore"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="delivery-state">State *</FieldLabel>
              <Input
                id="delivery-state"
                name="address-level1"
                autoComplete="address-level1"
                required
                value={address.state || ''}
                onChange={(event) => handleChange('state', event.target.value)}
                onBlur={() => onPersist?.(address)}
                placeholder="Karnataka"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="delivery-postal-code">Postal code *</FieldLabel>
            <Input
              id="delivery-postal-code"
              name="postal-code"
              autoComplete="postal-code"
              required
              value={address.postalCode || ''}
              onChange={(event) => handleChange('postalCode', event.target.value)}
              onBlur={() => onPersist?.(address)}
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

export function checkoutFormReady(
  session: Pick<UCPSession, 'buyer'> | null,
  address: UCPAddress,
): boolean {
  const buyer = session?.buyer;
  return Boolean(
    buyer?.name?.trim() &&
      (buyer.contact?.email || buyer.email)?.trim() &&
      address.line1?.trim() &&
      address.city?.trim() &&
      address.state?.trim() &&
      /^\d{6}$/.test((address.postalCode || address.pincode || '').trim()),
  );
}

/** Collapse accidental doubled values like "KarnatakaKarnataka". */
export function collapseDuplicatedRegion(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 4 || trimmed.length % 2 !== 0) return trimmed;
  const mid = trimmed.length / 2;
  const left = trimmed.slice(0, mid);
  const right = trimmed.slice(mid);
  return left.toLowerCase() === right.toLowerCase() ? left : trimmed;
}

export function shouldRedirectEmptyCheckout(params: {
  authenticated: boolean;
  holdingDecision: boolean;
  loading: boolean;
  itemCount: number;
  hadItems: boolean;
}): boolean {
  if (!params.authenticated || params.holdingDecision || params.loading || params.hadItems) {
    return false;
  }
  return params.itemCount === 0;
}

export function checkoutActionDisabled({
  submitting,
  trustBlocksCheckout,
  formReady,
  authorizationReady,
}: {
  submitting: boolean;
  trustBlocksCheckout: boolean;
  formReady: boolean;
  authorizationReady: boolean;
}): boolean {
  return submitting || trustBlocksCheckout || !formReady || !authorizationReady;
}

export function checkoutPaymentDetailsCopy(razorpayTestMode: boolean): string {
  return razorpayTestMode
    ? 'Razorpay Checkout Test Mode. Mock UPI and cards only — no real money.'
    : 'No bank, card, UPI, wallet, or cash details are collected in this step.';
}

export function checkoutAuthorizeButtonLabel({
  trustBlocksCheckout,
  submitting,
  prepared,
  razorpayTestMode,
}: {
  trustBlocksCheckout: boolean;
  submitting: boolean;
  prepared: boolean;
  razorpayTestMode: boolean;
}): string {
  if (trustBlocksCheckout) return 'Trust verification required';
  if (submitting) {
    return razorpayTestMode ? 'Opening Razorpay Test Mode...' : 'Processing...';
  }
  if (!prepared) return 'Preview exact landed cost';
  return razorpayTestMode
    ? 'Pay with Razorpay Test Mode'
    : 'Authorize exact total and place order';
}

function CheckoutSignInLock() {
  const { loginAuth0, loginGoogle } = useAuthContext();
  const authProviders = useAuthProviders();

  return (
    <Card className="border-border/70 bg-card/95" data-testid="buyer-checkout-signin-lock">
      <CardHeader className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Checkout locked
        </div>
        <CardTitle className="text-2xl">Sign in to check out</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You can browse and add items while signed out. Sign in to authorize checkout. AgentGuard
          will apply your spending limit after you sign in.
        </p>
        <div className="flex flex-wrap gap-2">
          {authProviders.auth0 ? (
            <Button type="button" className="rounded-full" onClick={() => loginAuth0('/checkout')}>
              Sign in
            </Button>
          ) : null}
          {!authProviders.auth0 && authProviders.google ? (
            <Button type="button" className="rounded-full" onClick={() => loginGoogle('/checkout')}>
              Continue with Google
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function CartSummary({ currency, formReady }: { currency: string; formReady: boolean }) {
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
          {formReady
            ? 'Billing and delivery details are ready. Authorize below to create the order and receive the Intent Receipt.'
            : 'Complete billing and the delivery address to authorize this order.'}
        </p>
      </CardContent>
    </Card>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();
  const { walletAddress, subjectId, principalId } = useSubject();
  const { session, loading, error, itemCount, refreshCart, clearCart } = useCart();
  const trust = useTrustState(walletAddress);
  const [quote, setQuote] = useState<UCPQuote | null>(null);
  const [preparedCheckout, setPreparedCheckout] = useState<PreparedCheckout | null>(null);
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
  const [agent, setAgent] = useState<AgentRef | null>(null);
  const [razorpayTestMode, setRazorpayTestMode] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<UCPAddress>({
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'IND',
  });
  const hydratedDeliverySession = useRef<string | null>(null);
  const hadItemsRef = useRef(false);

  useEffect(() => {
    if (itemCount > 0) hadItemsRef.current = true;
  }, [itemCount]);

  useEffect(() => {
    let cancelled = false;
    void fetchRazorpaySandboxStatus().then((status) => {
      if (!cancelled) setRazorpayTestMode(status.configured);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session || hydratedDeliverySession.current === session.id) return;
    hydratedDeliverySession.current = session.id;
    const savedArea = loadSavedDeliveryArea(subjectId || principalId);
    setDeliveryAddress({
      line1: session.buyer?.street || '',
      city: session.buyer?.city || savedArea?.city || '',
      state: collapseDuplicatedRegion(session.buyer?.state || savedArea?.state || ''),
      postalCode: session.buyer?.pincode || savedArea?.postalCode || '',
      country: session.buyer?.country || 'IND',
    });
  }, [principalId, session, subjectId]);

  useEffect(() => {
    setPreparedCheckout(null);
    setQuote(null);
  }, [session?.id, session?.updatedAt]);

  const persistDeliveryAddress = useCallback((address: UCPAddress) => {
    const next = {
      ...address,
      city: collapseDuplicatedRegion(address.city || ''),
      state: collapseDuplicatedRegion(address.state || ''),
    };
    saveDeliveryAreaFromAddress(subjectId || principalId, next);
    const sessionId = localStorage.getItem('ondc-session-id');
    if (sessionId) updateLocalDeliveryAddress(sessionId, next);
  }, [principalId, subjectId]);

  const handleDeliveryAddressChange = useCallback((address: UCPAddress) => {
    setDeliveryAddress({
      ...address,
      city: collapseDuplicatedRegion(address.city || ''),
      state: collapseDuplicatedRegion(address.state || ''),
    });
  }, []);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<CheckoutPrefillDetail>).detail;
      if (!detail) return;
        setDeliveryAddress((prev) => {
          const next: UCPAddress = {
            line1: detail.line1 ?? prev.line1 ?? '',
            city: detail.city ?? prev.city ?? '',
            state: collapseDuplicatedRegion(detail.state ?? prev.state ?? ''),
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
    const apply = () => {
      const snapshot = getBuyerAgentAuthority();
      if (snapshot.agent) setAgent(snapshot.agent);
      if (snapshot.mandateStatus) setMandateStatus(snapshot.mandateStatus);
      if (snapshot.checkoutAutoMax != null) {
        setCheckoutAutoMax(snapshot.checkoutAutoMax);
        setSavedCheckoutAutoMax(snapshot.checkoutAutoMax);
      }
    };
    apply();
    return subscribeBuyerAgentAuthority(apply);
  }, []);

  useEffect(() => {
    if (!subjectId) return;
    void (async () => {
      try {
        const { snapshot } = await syncBuyerAgentGuardStatus(walletAddress);
        setAgent(snapshot.agent);
        setMandateStatus(snapshot.mandateStatus);
        if (snapshot.checkoutAutoMax != null) {
          setCheckoutAutoMax(snapshot.checkoutAutoMax);
          setSavedCheckoutAutoMax(snapshot.checkoutAutoMax);
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
    if (
      shouldRedirectEmptyCheckout({
        authenticated: isAuthenticated,
        holdingDecision: holdingAgDecision,
        loading,
        itemCount,
        hadItems: hadItemsRef.current,
      })
    ) {
      navigate('/cart');
    }
  }, [holdingAgDecision, isAuthenticated, itemCount, loading, navigate, session]);

  async function completeAuthorizedCheckout(request: CheckoutExecutionRequest) {
    if (!session) throw new Error('No session found');

    const { runOndc, ...executionRequest } = request;
    const executed = await executeBuyerCheckout(executionRequest);
    const order = orderFromCommerceExecution(executed.execution);
    if (!order) {
      throw new Error('AgentGuard allowed checkout but the shared exchange did not return an order.');
    }
    if (shouldCollectRazorpayTestPayment(executed.reason_code)) {
      await collectRazorpayTestPayment({
        commerceOrderId: order.id,
        correlationId: request.correlationId,
        prefill: {
          name: request.deliveryContext?.name,
          email: request.deliveryContext?.email,
          contact: request.deliveryContext?.phone,
        },
      });
    }
    if (!executed.receipt) {
      throw new Error('Checkout completed without an Intent Receipt.');
    }

    const verified = await verifyBuyerReceipt({ receiptId: executed.receipt.receipt_id });
    const outcome: CheckoutOutcome = {
      at: Date.now(),
      decision: 'allow',
      message: verified.valid
        ? 'Order authorized and the Intent Receipt was verified.'
        : 'Order authorized, but the Intent Receipt could not be verified.',
      receiptId: executed.receipt.receipt_id,
      amountInr: request.amountInr,
      orderId: order.id,
      approvalId: request.approvalId,
    };
    writeCheckoutOutcome(outcome);
    setCheckoutOutcome(outcome);
    setPendingApproval(null);
    setAgentGuardNote(
      `${outcome.message} ${intentReceiptLabel(executed.receipt.receipt_id)}.`,
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
          `${outcome.message} ${intentReceiptLabel(executed.receipt.receipt_id)}. Network status confirmation is pending.`,
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

      if (!preparedCheckout) {
        const attemptId = crypto.randomUUID();
        const prepared = await prepareDurableCheckout({ items: session.items, attemptId });
        setPreparedCheckout({
          quote: prepared.quote,
          correlationId: prepared.correlationId,
          attemptId,
        });
        setQuote(durableQuoteForDisplay(prepared.quote));
        setAgentGuardNote('Exact landed-cost preview ready. Review the total, then authorize this quote.');
        return;
      }

      const prepared = preparedCheckout;
      const amountInr = prepared.quote.landed_total_paise / 100;
      const deliveryContext = {
        name: session.buyer?.name?.trim() || '',
        email: (session.buyer?.contact?.email || session.buyer?.email || '').trim(),
        phone: (session.buyer?.contact?.phone || session.buyer?.phone || '').trim(),
        line1: deliveryAddress.line1?.trim() || '',
        line2: deliveryAddress.line2?.trim() || '',
        city: deliveryAddress.city?.trim() || '',
        state: deliveryAddress.state?.trim() || '',
        postalCode: (deliveryAddress.postalCode || deliveryAddress.pincode || '').trim(),
        country: deliveryAddress.country?.trim() || 'IND',
      };
      const decision = await evaluateBuyerCheckout({
        walletAddress: principal,
        actor: 'user',
        amountInr,
        quoteId: prepared.quote.quote_id,
        correlationId: prepared.correlationId,
        deliveryContext,
      });
      const request: CheckoutExecutionRequest = {
        walletAddress: principal,
        actor: 'user',
        subjectId,
        amountInr,
        quoteId: prepared.quote.quote_id,
        decisionId: decision.decision_id,
        correlationId: prepared.correlationId,
        idempotencyKey: `${prepared.attemptId}:execute`,
        deliveryContext,
        runOndc: !COMMERCE_DEMO_MODE,
      };

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

  if (!isAuthenticated) {
    return <CheckoutSignInLock />;
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
  const formReady = checkoutFormReady(session, deliveryAddress);
  const mandateReady =
    mandateStatus === 'active' && savedCheckoutAutoMax !== null && !shoppingLimitDirty;
  const mandateRequired = preparedCheckout !== null && !mandateReady;
  const actionDisabled = checkoutActionDisabled({
    submitting,
    trustBlocksCheckout,
    formReady,
    authorizationReady: !mandateRequired,
  });
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
              : razorpayTestMode
                ? 'Confirm buyer details, then pay in Razorpay Checkout Test Mode. Mock UPI and cards only — no real money. AgentGuard still authorizes protected checkout.'
                : 'Confirm buyer details and place the order. AgentGuard authorizes protected checkout.'}
        </p>
        {razorpayTestMode ? (
          <Badge
            variant="outline"
            className="rounded-full"
            data-testid="buyer-razorpay-test-mode"
          >
            Razorpay Test Mode · no real money
          </Badge>
        ) : null}
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
                {intentReceiptLabel(checkoutOutcome.receiptId)}
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
                razorpayTestMode={razorpayTestMode}
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
              <DeliveryAddressForm
                address={deliveryAddress}
                onChange={handleDeliveryAddressChange}
                onPersist={persistDeliveryAddress}
              />
              <Card className="border-border/70 bg-card/90">
                <CardHeader className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Authorization
                  </div>
                  <CardTitle className="text-xl">Order authorization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                  <p>
                    {razorpayTestMode
                      ? 'Confirming authorizes the displayed total with AgentGuard, then opens Razorpay Checkout Test Mode. Mock UPI and cards only — no real money.'
                      : 'Confirming authorizes the displayed total, creates the order, and reserves the selected quantity. AgentGuard applies the limit shown beside the order summary.'}
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
                      <dd>{checkoutPaymentDetailsCopy(razorpayTestMode)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              {quote ? (
                <div className="space-y-2" data-testid="buyer-durable-quote-preview">
                  <p className="text-sm text-muted-foreground">
                    Exact landed-cost preview. This total is bound to the authorization below.
                  </p>
                  <QuoteDisplay quote={quote} currency={currency} />
                </div>
              ) : (
                <CartSummary currency={currency} formReady={formReady} />
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
                  <p>AgentGuard records the authorization decision and Intent Receipt for this order.</p>
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
                    <Badge
                      variant={agent?.status === 'active' ? 'default' : 'outline'}
                      className="rounded-full"
                      data-testid="buyer-agent-status"
                    >
                      {buyerShoppingAgentLabel(agent?.status, 'checkout')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90">
                <CardContent className="space-y-4 py-6">
                  <Button type="submit" className="w-full rounded-full" disabled={actionDisabled}>
                    {checkoutAuthorizeButtonLabel({
                      trustBlocksCheckout,
                      submitting,
                      prepared: preparedCheckout !== null,
                      razorpayTestMode,
                    })}
                  </Button>

                  {!actionDisabled ? (
                    <p className="text-sm text-muted-foreground">
                      You will receive an order number and Intent Receipt after successful checkout.
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
                          : mandateRequired
                            ? 'Save the shopping limit before authorizing this exact total.'
                            : 'Please complete billing and the delivery address before continuing.'}
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
