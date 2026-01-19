import { useNavigate } from 'react-router-dom';
import { useCart, CartItem, CartSummary } from '../types';
import { PageLayout, PageHeader, DRAMS, SPACING, TYPOGRAPHY, BUTTON, CARD, PILL_BUTTON, GRID } from '@ondc-sdk/shared/design-system';

const GRID_LAYOUT_STYLE = {
  ...GRID.twoColumnsWide,
  marginBottom: SPACING.xl,
};

const ITEMS_SECTION_STYLE = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: SPACING.lg,
};

const SUMMARY_SECTION_STYLE = {
  position: 'sticky' as const,
  top: SPACING.xl,
  alignSelf: 'start' as const,
};

const EMPTY_STATE_STYLE = {
  ...CARD.base,
  textAlign: 'center' as const,
  padding: `${SPACING['3xl']} ${SPACING.xl}`,
};

const FOOTER_STYLE = {
  textAlign: 'center' as const,
};

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
      <PageLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: SPACING['3xl'] }}>
          Loading cart...
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <p style={{ margin: 0, ...TYPOGRAPHY.label }}>Error</p>
          <p style={{ margin: `${SPACING.xs} 0 0 0` }}>{error}</p>
          <button onClick={clearError} style={BUTTON.secondary}>
            Dismiss
          </button>
        </div>
      </PageLayout>
    );
  }

  if (!session || itemCount === 0) {
    return (
      <PageLayout>
        <div style={EMPTY_STATE_STYLE}>
          <h2 style={{ ...TYPOGRAPHY.h2, color: DRAMS.textDark, margin: `0 0 ${SPACING.md} 0` }}>Your Cart is Empty</h2>
          <p style={{ ...TYPOGRAPHY.body, color: DRAMS.textLight, margin: `0 0 ${SPACING.xl} 0` }}>
            Add some items to get started!
          </p>
          <button onClick={() => navigate('/search')} style={PILL_BUTTON.orange}>
            Start Shopping
          </button>
        </div>
      </PageLayout>
    );
  }

  const currency = session.items[0]?.item.price?.currency || 'INR';
  const itemLabel = itemCount === 1 ? 'item' : 'items';

  return (
    <PageLayout>
      <PageHeader
        title="Shopping Cart"
        subtitle={`${itemCount} ${itemLabel} in your cart`}
      />

      <div style={GRID_LAYOUT_STYLE}>
        <div style={ITEMS_SECTION_STYLE}>
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

        <div style={SUMMARY_SECTION_STYLE}>
          <CartSummary
            subtotal={subtotal}
            currency={currency}
            onCheckout={handleCheckout}
            checkoutDisabled={loading || itemCount === 0}
          />
        </div>
      </div>

      <div style={FOOTER_STYLE}>
        <button onClick={() => navigate('/search')} style={BUTTON.secondary}>
          ← Continue Shopping
        </button>
      </div>
    </PageLayout>
  );
}
