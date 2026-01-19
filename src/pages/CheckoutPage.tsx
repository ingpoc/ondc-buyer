import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../types';
import type { UCPQuote, UCPAddress } from '../types';
import { PageLayout, PageHeader, DRAMS, COLORS, SPACING, TYPOGRAPHY, BUTTON, BADGE, CARD, PILL_BUTTON, GRID, DramsInput } from '@ondc-sdk/shared/design-system';
import { BillingForm } from '../components/BillingForm';
import { PaymentSelector } from '../components/PaymentSelector';
import { QuoteDisplay } from '../components/QuoteDisplay';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const ERROR_ALERT_STYLE = {
  ...BADGE.error,
  padding: SPACING.lg,
  marginBottom: SPACING.xl,
  position: 'relative' as const,
};

const ERROR_CLOSE_STYLE = {
  position: 'absolute' as const,
  top: SPACING.md,
  right: SPACING.md,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  ...TYPOGRAPHY.h3,
  color: COLORS.error,
  padding: '0',
  width: '24px',
  height: '24px',
};

const FORMS_SECTION_STYLE = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: SPACING.xl,
};

const SIDEBAR_STYLE = {
  position: 'sticky' as const,
  top: SPACING.xl,
  alignSelf: 'start' as const,
};

const BUTTON_PRIMARY_STYLE = {
  ...PILL_BUTTON.orange,
  width: '100%',
  marginTop: SPACING.lg,
};

const BUTTON_DISABLED_STYLE = {
  ...BUTTON.primary,
  width: '100%',
  backgroundColor: COLORS.textMuted,
  cursor: 'not-allowed',
  marginTop: SPACING.lg,
};

const VALIDATION_MESSAGE_STYLE = {
  ...TYPOGRAPHY.bodySmall,
  color: COLORS.error,
  marginTop: SPACING.sm,
};

const LOADING_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: SPACING['3xl'],
  color: DRAMS.textLight,
  ...TYPOGRAPHY.body,
};

const FOOTER_STYLE = {
  marginTop: SPACING.xl,
};

export function CheckoutPage() {
  const navigate = useNavigate();
  const { session, loading, error, itemCount, clearError, refreshCart } = useCart();
  const [quote, setQuote] = useState<UCPQuote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<UCPAddress>({
    name: session?.buyer?.name || '',
    phone: session?.buyer?.phone || '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'IND',
  });

  // Redirect to cart if empty (only after we've loaded the session)
  useEffect(() => {
    // Check session is not null to ensure we've actually loaded the cart
    if (!loading && session && itemCount === 0) {
      navigate('/cart');
    }
  }, [loading, itemCount, navigate, session]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const sessionId = localStorage.getItem('ondc-session-id');
      if (!sessionId) {
        throw new Error('No session found');
      }

      const response = await fetch(`${API_BASE}/api/checkout`, {
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
      setQuote(data.quote);

      // TODO: Navigate to order confirmation page when confirm endpoint is available
      // For now, show success message with quote
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !session) {
    return (
      <PageLayout>
        <div style={LOADING_STYLE}>
          Loading checkout...
        </div>
      </PageLayout>
    );
  }

  if (error && !session) {
    return (
      <PageLayout>
        <div style={{ ...BADGE.error, padding: SPACING.lg, textAlign: 'center' }}>
          <p style={{ margin: 0, ...TYPOGRAPHY.label }}>Error</p>
          <p style={{ margin: `${SPACING.xs} 0 0 0` }}>{error}</p>
          <button
            onClick={() => navigate('/cart')}
            style={BUTTON.secondary}
          >
            Back to Cart
          </button>
        </div>
      </PageLayout>
    );
  }

  const currency = session?.items[0]?.item.price?.currency || 'INR';

  return (
    <PageLayout>
      <PageHeader title="Checkout" />

      {submitError && (
        <div style={ERROR_ALERT_STYLE}>
          {submitError}
          <button
            onClick={() => setSubmitError(null)}
            style={ERROR_CLOSE_STYLE}
          >
            ×
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={GRID.twoColumnsWide}>
          <div style={FORMS_SECTION_STYLE}>
            <BillingForm session={session} onSave={refreshCart} />
            <DeliveryAddressForm
              address={deliveryAddress}
              onChange={setDeliveryAddress}
            />
            <PaymentSelector />
          </div>

          <div style={SIDEBAR_STYLE}>
            {quote ? (
              <QuoteDisplay quote={quote} currency={currency} />
            ) : (
              <CartSummary currency={currency} />
            )}

            <button
              type="submit"
              disabled={submitting || !session?.buyer?.name || !session?.buyer?.email}
              style={submitting ? BUTTON_DISABLED_STYLE : BUTTON_PRIMARY_STYLE}
            >
              {submitting ? 'Processing...' : quote ? 'Place Order' : 'Get Quote'}
            </button>

            {!session?.buyer?.name && (
              <p style={VALIDATION_MESSAGE_STYLE}>
                Please complete billing information to continue
              </p>
            )}
          </div>
        </div>
      </form>

      <div style={FOOTER_STYLE}>
        <button
          type="button"
          onClick={() => navigate('/cart')}
          style={BUTTON.secondary}
        >
          ← Back to Cart
        </button>
      </div>
    </PageLayout>
  );
}

interface DeliveryAddressFormProps {
  address: UCPAddress;
  onChange: (address: UCPAddress) => void;
}

function DeliveryAddressForm({ address, onChange }: DeliveryAddressFormProps) {
  const handleChange = (field: keyof UCPAddress, value: string) => {
    onChange({ ...address, [field]: value });
  };

  const LABEL_STYLE = {
    display: 'block',
    marginBottom: SPACING.sm,
    ...TYPOGRAPHY.label,
    color: DRAMS.textDark,
  };

  const INPUT_GRID_STYLE = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: SPACING.lg,
  };

  const FORM_GROUP_STYLE = {
    marginBottom: SPACING.lg,
  };

  return (
    <div style={CARD.base}>
      <h2 style={{ ...TYPOGRAPHY.h3, color: DRAMS.textDark, margin: `0 0 ${SPACING.lg} 0` }}>Delivery Address</h2>

      <div>
        <div style={FORM_GROUP_STYLE}>
          <label style={LABEL_STYLE}>
            Street Address *
          </label>
          <DramsInput
            type="text"
            required
            value={address.line1}
            onChange={(e) => handleChange('line1', e.target.value)}
            placeholder="123 Main Street, Apt 4B"
          />
        </div>

        <div style={INPUT_GRID_STYLE}>
          <div style={FORM_GROUP_STYLE}>
            <label style={LABEL_STYLE}>
              City *
            </label>
            <DramsInput
              type="text"
              required
              value={address.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="Bangalore"
            />
          </div>

          <div style={FORM_GROUP_STYLE}>
            <label style={LABEL_STYLE}>
              State *
            </label>
            <DramsInput
              type="text"
              required
              value={address.state}
              onChange={(e) => handleChange('state', e.target.value)}
              placeholder="Karnataka"
            />
          </div>
        </div>

        <div style={FORM_GROUP_STYLE}>
          <label style={LABEL_STYLE}>
            Postal Code *
          </label>
          <DramsInput
            type="text"
            required
            value={address.postalCode}
            onChange={(e) => handleChange('postalCode', e.target.value)}
            placeholder="560001"
            pattern="[0-9]{6}"
          />
        </div>
      </div>
    </div>
  );
}

interface CartSummaryProps {
  currency: string;
}

function CartSummary({ currency }: CartSummaryProps) {
  const { session, subtotal } = useCart();

  if (!session) return null;

  const ITEM_ROW_STYLE = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: `${SPACING.sm} 0`,
    borderBottom: `1px solid ${DRAMS.grayTrack}`,
  };

  const SUMMARY_SECTION_STYLE = {
    borderTop: `1px solid ${DRAMS.grayTrack}`,
    paddingTop: SPACING.lg,
  };

  const TOTAL_ROW_STYLE = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    ...TYPOGRAPHY.body,
  };

  const NOTE_STYLE = {
    ...TYPOGRAPHY.bodySmall,
    color: DRAMS.textLight,
    marginTop: SPACING.md,
    lineHeight: 1.5,
  };

  return (
    <div style={CARD.base}>
      <h2 style={{ ...TYPOGRAPHY.h3, color: DRAMS.textDark, margin: `0 0 ${SPACING.lg} 0` }}>Order Summary</h2>

      <div style={{ marginBottom: SPACING.lg }}>
        {session.items.map((item: any) => (
          <div
            key={item.item.id}
            style={ITEM_ROW_STYLE}
          >
            <span style={{ ...TYPOGRAPHY.body, color: DRAMS.textDark }}>
              {item.item.descriptor?.name || item.item.id} × {item.quantity}
            </span>
            <span style={{ ...TYPOGRAPHY.label, color: DRAMS.textDark }}>
              {currency}{' '}
              {((parseFloat(item.item.price?.value || '0') * item.quantity).toFixed(2))}
            </span>
          </div>
        ))}
      </div>

      <div style={SUMMARY_SECTION_STYLE}>
        <div style={TOTAL_ROW_STYLE}>
          <span style={{ color: DRAMS.textLight }}>Subtotal</span>
          <span style={{ ...TYPOGRAPHY.label, color: DRAMS.textDark }}>
            {currency} {subtotal.toFixed(2)}
          </span>
        </div>
        <p style={NOTE_STYLE}>
          Complete the form to get final pricing with delivery and tax
        </p>
      </div>
    </div>
  );
}
