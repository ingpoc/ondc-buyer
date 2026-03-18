import { SPACING, TYPOGRAPHY, BUTTON, CARD, DRAMS } from '@portfolio-ui';

export interface CartItemProps {
  item: {
    item: { id: string; descriptor?: { name: string }; price?: { value?: string; currency: string } };
    quantity: number;
  };
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void>;
  onRemove: (itemId: string) => Promise<void>;
  disabled: boolean;
}

export function CartItem({ item, onUpdateQuantity, onRemove, disabled }: CartItemProps): JSX.Element {
  const handleQuantityChange = async (delta: number) => {
    const newQuantity = item.quantity + delta;
    if (newQuantity > 0) {
      await onUpdateQuantity(item.item.id, newQuantity);
    }
  };

  const itemStyle = {
    ...CARD.base,
    display: 'flex',
    gap: SPACING.lg,
    alignItems: 'center',
  };

  const infoStyle = {
    flex: 1,
  };

  const quantityStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: SPACING.sm,
  };

  return (
    <div style={itemStyle}>
      <div style={infoStyle}>
        <h3 style={{ ...TYPOGRAPHY.body, margin: 0, color: DRAMS.textDark }}>
          {item.item.descriptor?.name || item.item.id}
        </h3>
        <p style={{ ...TYPOGRAPHY.bodySmall, margin: `${SPACING.xs} 0 0 0`, color: DRAMS.textLight }}>
          {item.item.price?.currency} {item.item.price?.value || '0'} × {item.quantity}
        </p>
      </div>
      <div style={quantityStyle}>
        <button
          onClick={() => handleQuantityChange(-1)}
          disabled={disabled}
          style={{ ...BUTTON.secondary, padding: `${SPACING.xs} ${SPACING.md}` }}
        >
          -
        </button>
        <span style={{ ...TYPOGRAPHY.body, minWidth: '24px', textAlign: 'center' }}>
          {item.quantity}
        </span>
        <button
          onClick={() => handleQuantityChange(1)}
          disabled={disabled}
          style={{ ...BUTTON.secondary, padding: `${SPACING.xs} ${SPACING.md}` }}
        >
          +
        </button>
        <button
          onClick={() => onRemove(item.item.id)}
          disabled={disabled}
          style={{ ...BUTTON.secondary, marginLeft: SPACING.md }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export interface CartSummaryProps {
  subtotal: number;
  currency: string;
  onCheckout: () => void;
  checkoutDisabled: boolean;
}

export function CartSummary({ subtotal, currency, onCheckout, checkoutDisabled }: CartSummaryProps): JSX.Element {
  const summaryStyle = {
    ...CARD.base,
    position: 'sticky' as const,
    top: SPACING.xl,
  };

  const rowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    ...TYPOGRAPHY.body,
  };

  const totalStyle = {
    ...CARD.base,
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTop: `1px solid ${DRAMS.grayTrack}`,
  };

  return (
    <div style={summaryStyle}>
      <h2 style={{ ...TYPOGRAPHY.h3, color: DRAMS.textDark, margin: `0 0 ${SPACING.lg} 0` }}>
        Order Summary
      </h2>
      <div style={rowStyle}>
        <span style={{ color: DRAMS.textLight }}>Subtotal</span>
        <span style={{ ...TYPOGRAPHY.label, color: DRAMS.textDark }}>
          {currency} {subtotal.toFixed(2)}
        </span>
      </div>
      <div style={totalStyle}>
        <div style={rowStyle}>
          <span style={{ ...TYPOGRAPHY.h3, color: DRAMS.textDark }}>Total</span>
          <span style={{ ...TYPOGRAPHY.h3, color: DRAMS.textDark }}>
            {currency} {subtotal.toFixed(2)}
          </span>
        </div>
      </div>
      <button
        onClick={onCheckout}
        disabled={checkoutDisabled}
        style={{
          ...BUTTON.primary,
          width: '100%',
          marginTop: SPACING.lg,
          opacity: checkoutDisabled ? 0.5 : 1,
          cursor: checkoutDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        Proceed to Checkout
      </button>
    </div>
  );
}
